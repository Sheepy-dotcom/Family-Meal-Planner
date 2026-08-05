/**
 * Capture-at-the-moment tests. The learning engine is unchanged; these cover
 * the two small derivations the capture UI leans on: when a slot is "past"
 * (so Today can offer a rating), and a person's stated dislikes surfaced on the
 * People tab (read off the same explicit verdicts favourites come from).
 */
import { SEED_HOUSEHOLD } from '../src/core/data/household.js';
import { buildToday, slotHasPassed } from '../src/core/planner/today.js';
import { buildPersonProfile } from '../src/core/people/profile.js';
import type { DayIndex, MealPlan, MealSlot, PlannedMeal } from '../src/core/types.js';
import type { FeedbackEvent } from '../src/core/learning/feedback.js';
import type { RuleContext } from '../src/core/rules/context.js';

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

const ctx: RuleContext = { household: SEED_HOUSEHOLD, history: [] };
const ALL = SEED_HOUSEHOLD.people.map((p) => p.id);
function meal(day: DayIndex, slot: MealSlot, recipeId: string): PlannedMeal {
  return { day, slot, recipeId, portions: 4, attendeeIds: ALL };
}
function planOf(meals: PlannedMeal[]): MealPlan {
  return { weekStartISO: '2026-08-03', householdId: SEED_HOUSEHOLD.id, meals, seed: 1 };
}
const at = (h: number) => new Date(2026, 7, 3, h, 0, 0); // Monday of the plan week

console.log('\nRating capture');

// --- slotHasPassed --------------------------------------------------------
check('breakfast is past by midday', slotHasPassed('breakfast', at(12)));
check('dinner is not past at midday', !slotHasPassed('dinner', at(12)));
check('dinner is past by 9pm', slotHasPassed('dinner', at(21)));
check('nothing is past first thing', !slotHasPassed('lunch', at(7)) && !slotHasPassed('breakfast', at(7)));

// --- past flag rides through buildToday ----------------------------------
{
  const view = buildToday(
    planOf([meal(0, 'breakfast', 'scrambled-eggs-toast'), meal(0, 'dinner', 'steak-chips-salad')]),
    SEED_HOUSEHOLD,
    at(15), // after lunch, before dinner
  );
  const bfast = view.meals.find((m) => m.slot === 'breakfast');
  const dinner = view.meals.find((m) => m.slot === 'dinner');
  check('breakfast reads as past by mid-afternoon', bfast?.past === true);
  check('dinner does not yet', dinner?.past === false);
}

// --- profile.dislikes, from explicit verdicts only -----------------------
{
  const feedback: FeedbackEvent[] = [
    { type: 'disliked', recipeId: 'steak-chips-salad', at: '2026-08-01', personId: 'p-jack' },
    { type: 'liked', recipeId: 'beef-chilli', at: '2026-08-01', personId: 'p-jack' },
  ];
  const profile = buildPersonProfile('p-jack', planOf([]), ctx, feedback);
  check('a stated dislike shows up', profile.dislikes.some((d) => d.recipeId === 'steak-chips-salad'));
  check('a like does not show as a dislike', !profile.dislikes.some((d) => d.recipeId === 'beef-chilli'));
  check('and still shows as a favourite', profile.favourites.some((f) => f.recipeId === 'beef-chilli'));
  check("someone else's verdict is not attributed here", buildPersonProfile('p-katie', planOf([]), ctx, feedback).dislikes.length === 0);
}

// --- latest verdict wins (changing your mind) ----------------------------
{
  const feedback: FeedbackEvent[] = [
    { type: 'disliked', recipeId: 'kedgeree', at: '2026-08-01', personId: 'p-ed' },
    { type: 'liked', recipeId: 'kedgeree', at: '2026-08-02', personId: 'p-ed' },
  ];
  const profile = buildPersonProfile('p-ed', planOf([]), ctx, feedback);
  check('a later like clears an earlier dislike', profile.dislikes.length === 0 && profile.favourites.some((f) => f.recipeId === 'kedgeree'));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
