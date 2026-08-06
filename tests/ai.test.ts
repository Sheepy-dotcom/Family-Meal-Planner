/**
 * AI-assisted learning — capture-side tests.
 *
 * The model call itself isn't exercised here (it needs a key and a network);
 * what's tested is the boundary either side of it: the payload never leaks a
 * name, and the reply is only trusted as far as it maps onto a rule the engine
 * can actually express. Everything else must be dropped, not approximated.
 */
import { SEED_HOUSEHOLD } from '../src/core/data/household.js';
import { getRecipe } from '../src/core/data/registry.js';
import { buildAnalysisPayload, parseAiProposals, type AiProposalRaw } from '../src/core/learning/ai.js';
import type { FeedbackEvent } from '../src/core/learning/feedback.js';
import type { Household } from '../src/core/types.js';

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\nAI-assisted learning');

const people = SEED_HOUSEHOLD.people;
const p0 = people[0];
const p1 = people[1];
const RECIPE = 'beef-chilli';
const recipe = getRecipe(RECIPE);
const CUISINE = recipe.cuisine;
const TAG = recipe.tags[0];

// --- anonymisation --------------------------------------------------------
{
  const feedback: FeedbackEvent[] = [
    {
      type: 'rejected',
      recipeId: RECIPE,
      at: '2026-08-01',
      attendeeIds: [p0.id, p1.id],
      personId: p0.id,
      day: 2,
      slot: 'dinner',
    },
  ];
  const { payload, tokenToPerson } = buildAnalysisPayload(feedback, SEED_HOUSEHOLD);
  const serialised = JSON.stringify(payload);

  check('no person name appears anywhere in the payload', !people.some((p) => serialised.includes(p.name)));
  check('person is sent as an opaque token', payload.events[0].person === 'person-0');
  check('attendees are tokens, not ids', JSON.stringify(payload.events[0].attendees) === JSON.stringify(['person-0', 'person-1']));
  check('recipe id, tags and cuisine are carried', payload.events[0].recipeId === RECIPE && payload.events[0].cuisine === CUISINE && payload.events[0].tags.length > 0);
  check('day and slot ride along', payload.events[0].day === 2 && payload.events[0].slot === 'dinner');
  check('the token map resolves back to the real person', tokenToPerson.get('person-0')?.id === p0.id);
}

// --- events for since-deleted recipes are dropped -------------------------
{
  const feedback: FeedbackEvent[] = [
    { type: 'rejected', recipeId: 'no-such-recipe', at: '2026-08-01' },
    { type: 'rejected', recipeId: RECIPE, at: '2026-08-01' },
  ];
  const { payload } = buildAnalysisPayload(feedback, SEED_HOUSEHOLD);
  check('an unknown recipe is left out of the payload', payload.events.length === 1 && payload.events[0].recipeId === RECIPE);
}

// --- validation of the reply ---------------------------------------------
const tokens = buildAnalysisPayload([], SEED_HOUSEHOLD).tokenToPerson;

{
  const raw: AiProposalRaw[] = [
    { kind: 'avoid-cuisine', subject: CUISINE, person: null, suggestion: 'Less of it?', evidence: 'Swapped out often.' },
    { kind: 'block-recipe', subject: RECIPE, person: null, suggestion: 'Stop it?', evidence: 'Rejected repeatedly.' },
  ];
  const out = parseAiProposals(raw, tokens, SEED_HOUSEHOLD);
  check('valid cuisine and recipe proposals survive', out.length === 2);
  check('ids are namespaced so they never collide with inferred ones', out.every((p) => p.id.startsWith('ai:')));
}

{
  const raw: AiProposalRaw[] = [
    { kind: 'make-the-week-vegan' as any, subject: CUISINE, person: null, suggestion: 's', evidence: 'e' },
    { kind: 'avoid-cuisine', subject: 'klingon', person: null, suggestion: 's', evidence: 'e' },
    { kind: 'block-recipe', subject: 'ghost-recipe', person: null, suggestion: 's', evidence: 'e' },
    { kind: 'avoid-tag', subject: TAG, person: null, suggestion: 'Fewer?', evidence: '' },
  ];
  const out = parseAiProposals(raw, tokens, SEED_HOUSEHOLD);
  check('an unknown rule kind is dropped', !out.some((p) => p.subject === CUISINE && p.kind !== 'avoid-cuisine'));
  check('an invalid cuisine subject is dropped', !out.some((p) => p.subject === 'klingon'));
  check('a hallucinated recipe subject is dropped', !out.some((p) => p.subject === 'ghost-recipe'));
  check('a proposal with no evidence is dropped', !out.some((p) => p.subject === TAG));
  check('nothing inexpressible slips through', out.length === 0);
}

// --- person tokens on the way back ---------------------------------------
{
  const raw: AiProposalRaw[] = [
    { kind: 'avoid-tag', subject: TAG, person: 'person-1', suggestion: 'Fewer for them?', evidence: 'All with them at the table.' },
  ];
  const out = parseAiProposals(raw, tokens, SEED_HOUSEHOLD);
  check('a valid token resolves to the real person', out.length === 1 && out[0].personId === p1.id && out[0].personName === p1.name);
}

{
  const raw: AiProposalRaw[] = [
    { kind: 'avoid-tag', subject: TAG, person: 'person-99', suggestion: 's', evidence: 'e' },
  ];
  const out = parseAiProposals(raw, tokens, SEED_HOUSEHOLD);
  check('a token for nobody voids the whole proposal', out.length === 0);
}

{
  // A person attribution on a kind that can't carry one is stripped, not fatal.
  const raw: AiProposalRaw[] = [
    { kind: 'avoid-cuisine', subject: CUISINE, person: 'person-0', suggestion: 'Less?', evidence: 'Often swapped.' },
  ];
  const out = parseAiProposals(raw, tokens, SEED_HOUSEHOLD);
  check('a stray attribution on a household-wide kind is dropped, not the rule', out.length === 1 && out[0].personId === undefined);
}

// --- already-applied rules aren't re-proposed ----------------------------
{
  const household: Household = { ...SEED_HOUSEHOLD, blockedRecipeIds: [RECIPE] };
  const raw: AiProposalRaw[] = [
    { kind: 'block-recipe', subject: RECIPE, person: null, suggestion: 'Stop it?', evidence: 'Rejected.' },
  ];
  const out = parseAiProposals(raw, tokens, household);
  check('an already-blocked recipe is not proposed again', out.length === 0);
}

// --- duplicates within one reply are collapsed ---------------------------
{
  const raw: AiProposalRaw[] = [
    { kind: 'avoid-cuisine', subject: CUISINE, person: null, suggestion: 'Less?', evidence: 'a' },
    { kind: 'avoid-cuisine', subject: CUISINE, person: null, suggestion: 'Less again?', evidence: 'b' },
  ];
  const out = parseAiProposals(raw, tokens, SEED_HOUSEHOLD);
  check('the same rule proposed twice is kept once', out.length === 1);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
