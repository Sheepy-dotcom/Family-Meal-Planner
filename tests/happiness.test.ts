/**
 * "Is everyone happy?" tests.
 *
 * The read must only ever speak from what people actually said, and the one
 * thing it must never miss is a disliked dish still on this week's plan for
 * someone who has to eat it.
 */
import { SEED_HOUSEHOLD } from '../src/core/data/household.js';
import { getRecipe } from '../src/core/data/registry.js';
import { householdHappiness } from '../src/core/people/happiness.js';
import type { FeedbackEvent } from '../src/core/learning/feedback.js';
import type { MealPlan, PlannedMeal } from '../src/core/types.js';

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

console.log('\nIs everyone happy?');

const people = SEED_HOUSEHOLD.people;
const p0 = people[0];
const p1 = people[1];
const ALL = people.map((p) => p.id);
const RECIPE = 'beef-chilli';
const OTHER = 'steak-chips-salad';
const at = '2026-08-01';

function meal(recipeId: string, attendeeIds = ALL): PlannedMeal {
  return { day: 0, slot: 'dinner', recipeId, portions: 4, attendeeIds };
}
function planOf(meals: PlannedMeal[]): MealPlan {
  return { weekStartISO: '2026-08-03', householdId: SEED_HOUSEHOLD.id, meals, seed: 1 };
}
const now = new Date('2026-08-05');

// --- no data: everyone quiet ---------------------------------------------
{
  const h = householdHappiness([], SEED_HOUSEHOLD, null, now);
  check('with no feedback, everyone reads as quiet', h.people.every((p) => p.status === 'quiet'));
  check('household headline points at rating', /rating|how was it/i.test(h.headline));
}

// --- a like, nothing disliked: happy -------------------------------------
{
  const feedback: FeedbackEvent[] = [
    { type: 'liked', recipeId: RECIPE, at, personId: p0.id },
  ];
  const h = householdHappiness(feedback, SEED_HOUSEHOLD, null, now);
  const me = h.people.find((p) => p.personId === p0.id)!;
  check('a stated like with no dislikes reads as happy', me.status === 'happy' && me.liked === 1);
}

// --- disliked dish ON this week's plan: attention ------------------------
{
  const feedback: FeedbackEvent[] = [
    { type: 'disliked', recipeId: RECIPE, at, personId: p0.id },
  ];
  const plan = planOf([meal(RECIPE, [p0.id, p1.id])]);
  const h = householdHappiness(feedback, SEED_HOUSEHOLD, plan, now);
  const me = h.people.find((p) => p.personId === p0.id)!;
  check('a disliked dish on the plan raises attention', me.status === 'attention');
  check('the headline names the dish and suggests a swap', me.headline.includes(getRecipe(RECIPE).name) && /swap/i.test(me.headline));
  check('household headline flags the person', h.headline.includes(p0.name));
  // someone not eating it isn't dragged into attention
  const other = h.people.find((p) => p.personId === people[2].id)!;
  check('a person not at that meal is not flagged', other.status !== 'attention');
}

// --- disliked but NOT on the plan, plus a like: mixed --------------------
{
  const feedback: FeedbackEvent[] = [
    { type: 'disliked', recipeId: RECIPE, at, personId: p0.id },
    { type: 'liked', recipeId: OTHER, at, personId: p0.id },
  ];
  const plan = planOf([meal(OTHER, [p0.id])]); // only the liked one is on the plan
  const h = householdHappiness(feedback, SEED_HOUSEHOLD, plan, now);
  const me = h.people.find((p) => p.personId === p0.id)!;
  check('a dislike not on the plan reads as mixed, not attention', me.status === 'mixed' && me.liked === 1 && me.disliked === 1);
}

// --- stale verdicts age out ----------------------------------------------
{
  const feedback: FeedbackEvent[] = [
    { type: 'liked', recipeId: RECIPE, at: '2025-01-01', personId: p0.id },
  ];
  const h = householdHappiness(feedback, SEED_HOUSEHOLD, null, now);
  const me = h.people.find((p) => p.personId === p0.id)!;
  check('a verdict from long ago no longer counts', me.status === 'quiet');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
