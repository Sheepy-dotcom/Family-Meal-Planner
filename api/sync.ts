/**
 * Serverless sync store — one JSON blob per household code.
 *
 * Like api/analyse.ts this lives outside the client build, so its credentials
 * never reach the browser. It talks to Vercel KV (Upstash Redis) over the REST
 * API with plain fetch, so there's no npm dependency to add: set up KV in the
 * Vercel dashboard (Storage → Create → KV) and it provides KV_REST_API_URL and
 * KV_REST_API_TOKEN automatically.
 *
 * The code in the request is the only key: whoever holds it can read and write
 * that household's state, by design. So the one thing this must not do is let a
 * code smuggle anything into the datastore key space — hence the strict format
 * check before the code is ever used to build a Redis key.
 */

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const CODE_RE = /^MEAL-[2-9A-HJ-NP-Z]{5}$/;
const MAX_BLOB_BYTES = 900_000; // a household's state is a few KB; this is slack

interface Stored {
  version: number;
  updatedAt: string;
  blob: Record<string, string>;
}

async function kvGet(key: string): Promise<Stored | null> {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error('kv-get-failed');
  const body: any = await res.json();
  if (body.result == null) return null;
  try {
    return JSON.parse(body.result) as Stored;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: Stored): Promise<void> {
  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error('kv-set-failed');
}

// --- rate limiting --------------------------------------------------------
// The code is only 5 characters, so without a ceiling the codespace is small
// enough to scan — and a hit returns a household's names and allergens. A
// per-IP limit, counted in KV so it holds across serverless instances (an
// in-memory counter wouldn't, since each cold start forgets), makes a sweep
// cost far more than the data is worth while never getting in a real family's
// way. Fail-open: if the counter itself errors, sync still works.
const RATE_MAX = 40; // requests per IP per window — generous for real use
const RATE_WINDOW_SEC = 60;

function clientIp(req: any): string {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

async function rateExceeded(ip: string, bucket: number): Promise<boolean> {
  const key = `rl:sync:${ip}:${bucket}`;
  try {
    const res = await fetch(`${KV_URL}/incr/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!res.ok) return false;
    const body: any = await res.json();
    const count = Number(body.result ?? 0);
    // First hit in this window: set the key to expire so counters don't pile up.
    if (count === 1) {
      await fetch(`${KV_URL}/expire/${encodeURIComponent(key)}/${RATE_WINDOW_SEC}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${KV_TOKEN}` },
      });
    }
    return count > RATE_MAX;
  } catch {
    return false; // never let the limiter take the feature down
  }
}

export default async function handler(req: any, res: any) {
  if (!KV_URL || !KV_TOKEN) {
    res.status(500).json({ error: 'Sync is not configured.' });
    return;
  }

  // Bucketed per window; the timestamp comes from the server clock, which is
  // fine here — this is coarse abuse control, not billing.
  const bucket = Math.floor(Date.now() / (RATE_WINDOW_SEC * 1000));
  if (await rateExceeded(clientIp(req), bucket)) {
    res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
    return;
  }

  // --- read ---------------------------------------------------------------
  if (req.method === 'GET') {
    const code = String(req.query?.code ?? '');
    if (!CODE_RE.test(code)) {
      res.status(400).json({ error: 'Bad code.' });
      return;
    }
    let stored: Stored | null;
    try {
      stored = await kvGet(`sync:${code}`);
    } catch {
      res.status(502).json({ error: 'Sync store unavailable.' });
      return;
    }
    if (!stored) {
      res.status(404).json({ error: 'No data for that code yet.' });
      return;
    }
    res.status(200).json({ version: stored.version, blob: stored.blob });
    return;
  }

  // --- write --------------------------------------------------------------
  if (req.method === 'PUT') {
    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
    const code = String(body?.code ?? '');
    const baseVersion = Number(body?.baseVersion ?? 0);
    const blob = body?.blob;

    if (!CODE_RE.test(code)) {
      res.status(400).json({ error: 'Bad code.' });
      return;
    }
    if (!blob || typeof blob !== 'object' || Array.isArray(blob)) {
      res.status(400).json({ error: 'Bad payload.' });
      return;
    }
    if (JSON.stringify(blob).length > MAX_BLOB_BYTES) {
      res.status(413).json({ error: 'Too much data to sync.' });
      return;
    }

    const key = `sync:${code}`;
    let current: Stored | null;
    try {
      current = await kvGet(key);
    } catch {
      res.status(502).json({ error: 'Sync store unavailable.' });
      return;
    }

    // Someone else wrote since this device last synced: hand back their version
    // rather than clobber it. The client adopts it and the user sees the merge.
    if (current && current.version !== baseVersion) {
      res.status(409).json({ version: current.version, blob: current.blob });
      return;
    }

    const next: Stored = {
      version: (current?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      blob,
    };
    try {
      await kvSet(key, next);
    } catch {
      res.status(502).json({ error: 'Sync store unavailable.' });
      return;
    }
    res.status(200).json({ version: next.version });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
