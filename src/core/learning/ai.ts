import { allRecipes, getRecipe } from '../data/registry.js';
import { getIngredient } from '../data/ingredients.js';
import type { Cuisine, DayIndex, Household, MealSlot, RecipeTag } from '../types.js';
import type { FeedbackEvent, FeedbackType, ProposalKind, RuleProposal } from './feedback.js';

/**
 * AI-assisted learning — capture only.
 *
 * The rule engine already turns behaviour into proposals (`proposeRules`). This
 * module adds a second, optional reader: a language model that looks at the same
 * anonymised history and describes patterns the rule engine's fixed vocabulary
 * can't reach. Two hard boundaries make that safe to add:
 *
 *  - **The model only ever suggests.** Everything it returns comes back as a
 *    `RuleProposal`, surfaces in the same panel as the inferred ones, and does
 *    nothing until a human accepts it. It cannot bypass `validateRecipe` or the
 *    hard rules because it never touches the solver — it only proposes settings
 *    the household already controls.
 *  - **Nothing personal leaves the device.** The payload carries recipe ids,
 *    tags, cuisines, verdicts, days and slots, plus opaque person *tokens*
 *    (`person-0`, `person-1`). Real names never appear, and the tokens are
 *    resolved back to people here, on the client, after the response returns.
 *
 * The model's output is constrained — both by the server's JSON schema and,
 * defensively, by `parseAiProposals` here — to the exact rule shapes the
 * household can express. If it describes something the rule system can't hold
 * (a weekday-conditional pattern, an unknown dish), that proposal is dropped
 * rather than approximated into a rule that means something else.
 */

// ---------------------------------------------------------------------------
// Outbound: the anonymised payload
// ---------------------------------------------------------------------------

/** One feedback event, stripped of anything that could name a person. */
export interface PayloadEvent {
  recipeId: string;
  tags: RecipeTag[];
  cuisine: Cuisine;
  verdict: FeedbackType;
  day?: DayIndex;
  slot?: MealSlot;
  /** Opaque token for whose verdict this is, when stated. Never a name. */
  person?: string;
  /** Opaque tokens for who was at the table. Never names. */
  attendees?: string[];
}

export interface AnalysisPayload {
  events: PayloadEvent[];
  /** The tokens in play, so the model knows the cast without ever seeing names. */
  people: string[];
}

/**
 * Build the request body and the token map to read the reply back with.
 *
 * People are tokenised by their position in the household — stable within a
 * call, meaningless outside it. Events that reference a since-deleted recipe are
 * dropped, since the model can't reason about tags it can't see.
 */
export function buildAnalysisPayload(
  events: FeedbackEvent[],
  household: Household,
): { payload: AnalysisPayload; tokenToPerson: Map<string, { id: string; name: string }> } {
  const idToToken = new Map<string, string>();
  const tokenToPerson = new Map<string, { id: string; name: string }>();
  household.people.forEach((person, i) => {
    const token = `person-${i}`;
    idToToken.set(person.id, token);
    tokenToPerson.set(token, { id: person.id, name: person.name });
  });

  const payloadEvents: PayloadEvent[] = [];
  for (const event of events) {
    let recipe;
    try {
      recipe = getRecipe(event.recipeId);
    } catch {
      continue; // recipe gone from the book — nothing to describe
    }
    const attendees = event.attendeeIds
      ?.map((id) => idToToken.get(id))
      .filter((t): t is string => Boolean(t));
    payloadEvents.push({
      recipeId: event.recipeId,
      tags: recipe.tags,
      cuisine: recipe.cuisine,
      verdict: event.type,
      ...(event.day !== undefined ? { day: event.day } : {}),
      ...(event.slot !== undefined ? { slot: event.slot } : {}),
      ...(event.personId && idToToken.has(event.personId)
        ? { person: idToToken.get(event.personId) }
        : {}),
      ...(attendees && attendees.length > 0 ? { attendees } : {}),
    });
  }

  return {
    payload: { events: payloadEvents, people: [...tokenToPerson.keys()] },
    tokenToPerson,
  };
}

// ---------------------------------------------------------------------------
// Inbound: validating what the model returned
// ---------------------------------------------------------------------------

/** The raw shape the model is asked to return, before any trust is placed in it. */
export interface AiProposalRaw {
  kind: string;
  subject: string;
  /** A person token, when the pattern is one person's. */
  person?: string | null;
  suggestion?: string;
  evidence?: string;
}

const PROPOSAL_KINDS: ReadonlySet<ProposalKind> = new Set([
  'block-recipe',
  'avoid-tag',
  'avoid-cuisine',
  'avoid-ingredient',
  'favour-recipe',
]);

/** Cuisines and tags that actually exist on a real recipe — the only valid subjects. */
function knownSubjects(): { cuisines: Set<string>; tags: Set<string> } {
  const cuisines = new Set<string>();
  const tags = new Set<string>();
  for (const recipe of allRecipes()) {
    cuisines.add(recipe.cuisine);
    for (const tag of recipe.tags) tags.add(tag);
  }
  return { cuisines, tags };
}

function subjectIsValid(kind: ProposalKind, subject: string): boolean {
  const { cuisines, tags } = knownSubjects();
  switch (kind) {
    case 'block-recipe':
    case 'favour-recipe':
      try {
        getRecipe(subject);
        return true;
      } catch {
        return false;
      }
    case 'avoid-cuisine':
      return cuisines.has(subject);
    case 'avoid-tag':
      return tags.has(subject);
    case 'avoid-ingredient':
      try {
        getIngredient(subject);
        return true;
      } catch {
        return false;
      }
  }
}

/** Is this rule already in force? If so there's nothing to propose. */
function alreadyApplied(
  household: Household,
  kind: ProposalKind,
  subject: string,
  personId?: string,
): boolean {
  switch (kind) {
    case 'block-recipe':
      return (household.blockedRecipeIds ?? []).includes(subject);
    case 'favour-recipe':
      return (household.favouredRecipeIds ?? []).includes(subject);
    case 'avoid-cuisine':
      return (household.avoidedCuisines ?? []).includes(subject as Cuisine);
    case 'avoid-tag': {
      const people = personId
        ? household.people.filter((p) => p.id === personId)
        : household.people;
      return people.length > 0 && people.every((p) => p.dietary.dislikedTags.includes(subject as RecipeTag));
    }
    case 'avoid-ingredient': {
      const people = personId
        ? household.people.filter((p) => p.id === personId)
        : household.people;
      return people.length > 0 && people.every((p) => p.dietary.dislikedIngredients.includes(subject));
    }
  }
}

/**
 * Turn the model's reply into proposals the household can accept — dropping
 * anything that doesn't map cleanly onto a rule the engine can express.
 *
 * The filtering is deliberately unforgiving. A proposal survives only if its
 * kind is one of the five the household controls, its subject is a real recipe,
 * tag, cuisine or ingredient, and any person token resolves to a real member.
 * Everything else — a hallucinated dish, a weekday condition smuggled into the
 * text, a token for nobody — is discarded, because a wrong rule applied is worse
 * than a pattern left unspoken.
 */
export function parseAiProposals(
  raw: AiProposalRaw[],
  tokenToPerson: Map<string, { id: string; name: string }>,
  household: Household,
): RuleProposal[] {
  const out: RuleProposal[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const kind = item.kind as ProposalKind;
    if (!PROPOSAL_KINDS.has(kind)) continue;
    if (typeof item.subject !== 'string' || !subjectIsValid(kind, item.subject)) continue;

    const suggestion = typeof item.suggestion === 'string' ? item.suggestion.trim() : '';
    const evidence = typeof item.evidence === 'string' ? item.evidence.trim() : '';
    if (!suggestion || !evidence) continue;

    // A person token, if given, must name a real member. A token for nobody
    // means the model invented an attribution, so the whole proposal is suspect.
    let person: { id: string; name: string } | undefined;
    if (item.person != null && item.person !== '') {
      const resolved = tokenToPerson.get(item.person);
      if (!resolved) continue;
      person = resolved;
    }
    // Only two kinds can carry a person; drop a stray attribution on the rest.
    if (person && kind !== 'avoid-tag' && kind !== 'avoid-ingredient') person = undefined;

    if (alreadyApplied(household, kind, item.subject, person?.id)) continue;

    const id = `ai:${kind}:${item.subject}${person ? `:${person.id}` : ''}`;
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      kind,
      subject: item.subject,
      personId: person?.id,
      personName: person?.name,
      suggestion,
      evidence,
      // The model doesn't count evidence the way the inference engine does; a
      // nominal strength keeps these below strongly-evidenced inferred rules
      // when both are sorted together.
      strength: 1,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// The call itself (thin — the logic above is what's tested)
// ---------------------------------------------------------------------------

export interface AnalyseResult {
  proposals: RuleProposal[];
  /** Set when the request couldn't be completed, for a plain message to the user. */
  error?: string;
}

/**
 * Ask the serverless function for patterns, then validate them here.
 *
 * The key lives only on the server; this just posts the anonymised payload and
 * a session id (which the server rate-limits on) and trusts nothing that comes
 * back until `parseAiProposals` has vetted it.
 */
export async function analysePatterns(
  events: FeedbackEvent[],
  household: Household,
  sessionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnalyseResult> {
  const { payload, tokenToPerson } = buildAnalysisPayload(events, household);

  let response: Response;
  try {
    response = await fetchImpl('/api/analyse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, payload }),
    });
  } catch {
    return { proposals: [], error: "Couldn't reach the pattern reader. Try again later." };
  }

  if (response.status === 429) {
    return { proposals: [], error: 'Give it a few minutes before asking again.' };
  }
  if (!response.ok) {
    return { proposals: [], error: "The pattern reader didn't answer. Try again later." };
  }

  let body: { patterns?: AiProposalRaw[] };
  try {
    body = await response.json();
  } catch {
    return { proposals: [], error: "The pattern reader's reply was unreadable." };
  }

  const proposals = parseAiProposals(body.patterns ?? [], tokenToPerson, household);
  return { proposals };
}
