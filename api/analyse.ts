/**
 * Serverless pattern-reader — the only place the Anthropic key is ever held.
 *
 * This file lives in `api/`, which is deliberately outside the client tsconfig
 * `include` and outside Vite's build graph (whose single entry is
 * `src/app/main.tsx`). Nothing here is bundled to the browser, so
 * `process.env.ANTHROPIC_API_KEY` can never reach the client. Set that key in
 * the Vercel project's Environment Variables — never in the repo.
 *
 * The client sends only anonymised data (recipe ids, tags, cuisines, verdicts,
 * days, slots, and opaque person tokens — never names). This function forwards
 * it to Claude with a schema-constrained request, asks for household patterns
 * the fixed rule engine can't express, and returns the raw proposals. The
 * client re-validates everything before a single one is shown, and nothing is
 * applied until a human accepts it — the model suggests, the engine still
 * decides.
 *
 * Types are intentionally loose: this module is compiled by Vercel, not by the
 * app's `tsc`, and pulling in `@vercel/node` would add a dependency the client
 * build has no reason to carry.
 */

const MODEL = 'claude-opus-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Per-session rate limit. Best-effort: serverless instances are ephemeral, so
// this bounds a warm instance rather than guaranteeing a global ceiling — which
// is the right shape for "stop one session hammering it", not billing control.
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_MAX = 5;
const hits = new Map<string, number[]>();

function rateLimited(sessionId: string, now: number): boolean {
  const recent = (hits.get(sessionId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(sessionId, recent);
    return true;
  }
  recent.push(now);
  hits.set(sessionId, recent);
  return false;
}

// The model may only propose rules the household can actually express, and only
// with subjects it can see in the payload. Ingredient rules are excluded because
// ingredient data is never sent — a subject the client couldn't ground would be
// dropped there anyway.
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    patterns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: {
            type: 'string',
            enum: ['block-recipe', 'favour-recipe', 'avoid-cuisine', 'avoid-tag'],
          },
          subject: {
            type: 'string',
            description:
              'A recipe id (for block/favour), a cuisine, or a tag — exactly as it appears in the data.',
          },
          person: {
            type: ['string', 'null'],
            description: 'A person token from the payload if the pattern is one person\'s; otherwise null.',
          },
          suggestion: {
            type: 'string',
            description: 'A plain, decline-able question, e.g. "Serve less Thai food?"',
          },
          evidence: {
            type: 'string',
            description: 'The checkable reason, e.g. "6 Thai dishes swapped out across different recipes."',
          },
        },
        required: ['kind', 'subject', 'person', 'suggestion', 'evidence'],
      },
    },
  },
  required: ['patterns'],
};

const SYSTEM = `You read a household's anonymised meal-planning feedback and surface patterns their rule system can't already express.

The data is fully anonymised: recipe ids, tags, cuisines, verdicts (rejected/cooked/liked/disliked), the day and slot a meal sat in, and opaque person tokens like "person-0". There are no names, and you must never invent one.

The household's rule engine already handles simple frequency patterns. Your value is spotting relationships it can't hold. But you may only RETURN patterns that map onto one of these unconditional rules:
- block-recipe: stop suggesting one dish (subject = its recipe id)
- favour-recipe: put one dish into regular rotation (subject = its recipe id)
- avoid-cuisine: serve less of a cuisine (subject = the cuisine)
- avoid-tag: fewer dishes of a style (subject = the tag)

Critical: these rules are UNCONDITIONAL. They cannot depend on the day or slot. If the real pattern is conditional — "curries get swapped on weeknights but kept at weekends" — the rule system genuinely cannot express it, so DROP it. Do not flatten it into "avoid curry", which would be false. Only return a pattern when the unconditional rule is actually true.

Attribute to a person (set "person" to their token) only when the evidence is clearly about that one person — they alone rejected it, or stated the verdict. Otherwise set person to null.

Use only subjects that appear in the data. Phrase each suggestion as a plain question the household can decline, and give evidence they can check. Return an empty list rather than reaching for weak or inexpressible patterns.`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Pattern reader is not configured.' });
    return;
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const sessionId = body?.sessionId;
  const payload = body?.payload;
  if (typeof sessionId !== 'string' || !sessionId || !payload || !Array.isArray(payload.events)) {
    res.status(400).json({ error: 'Bad request.' });
    return;
  }

  // Bound the payload so a session can't ask us to relay an unbounded blob.
  if (payload.events.length > 500) {
    res.status(400).json({ error: 'Too much history in one request.' });
    return;
  }

  if (rateLimited(sessionId, Date.now())) {
    res.status(429).json({ error: 'Rate limit reached for this session.' });
    return;
  }

  let anthropic: Response;
  try {
    anthropic = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM,
        output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: `Here is the anonymised feedback. Return patterns worth proposing.\n\n${JSON.stringify(
              payload,
            )}`,
          },
        ],
      }),
    });
  } catch {
    res.status(502).json({ error: 'Could not reach the model.' });
    return;
  }

  if (!anthropic.ok) {
    res.status(502).json({ error: 'The model request failed.' });
    return;
  }

  const data: any = await anthropic.json();

  // A safety refusal (or anything other than a clean stop) yields no proposals
  // rather than a guessed one.
  if (data.stop_reason === 'refusal') {
    res.status(200).json({ patterns: [] });
    return;
  }

  const text = Array.isArray(data.content)
    ? data.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    : '';
  const parsed = safeParse(text) ?? extractJson(text);
  const patterns = parsed && Array.isArray(parsed.patterns) ? parsed.patterns : [];

  res.status(200).json({ patterns });
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Last-ditch: pull the first {...} block out of a noisy response. */
function extractJson(text: string): any {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  return safeParse(text.slice(start, end + 1));
}
