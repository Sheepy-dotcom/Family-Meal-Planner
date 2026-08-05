/**
 * Today-view projection tests. Pure domain logic: given a plan and a date,
 * what does the Today screen derive? Plans are hand-built here rather than
 * solved, so each scenario is unambiguous.
 */
import { SEED_HOUSEHOLD } from '../src/core/data/household.js';
import { buildToday, todayIndex } from '../src/core/planner/today.js';
import type { DayIndex, MealPlan, MealSlot, PlannedMeal } from '../src/core/types.js';

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

const WEEK = '2026-08-03'; // a Monday
// A fixed local time on each weekday of that plan week.
const noon = (day: number) => new Date(2026, 7, 3 + day, 12, 0, 0);

const allIds = SEED_HOUSEHOLD.people.map((p) => p.id);
function meal(
  day: DayIndex,
  slot: MealSlot,
  recipeId: string,
  extra: Partial<PlannedMeal> = {},
): PlannedMeal {
  return { day, slot, recipeId, portions: 4, attendeeIds: allIds, ...extra };
}
function plan(meals: PlannedMeal[]): MealPlan {
  return { weekStartISO: WEEK, householdId: SEED_HOUSEHOLD.id, meals, seed: 1 };
}

console.log('\nToday view');

// --- date mapping --------------------------------------------------------
check('Monday noon maps to day 0', todayIndex(WEEK, noon(0)) === 0);
check('Sunday noon maps to day 6', todayIndex(WEEK, noon(6)) === 6);
check('early-morning still maps to the same day', todayIndex(WEEK, new Date(2026, 7, 5, 0, 30)) === 2);
check('a day before the week is outside it', todayIndex(WEEK, new Date(2026, 7, 2, 12)) === null);
check('a day after the week is outside it', todayIndex(WEEK, new Date(2026, 7, 10, 12)) === null);

// --- basic day -----------------------------------------------------------
{
  const view = buildToday(
    plan([
      meal(0, 'dinner', 'steak-chips-salad'),
      meal(0, 'breakfast', 'scrambled-eggs-toast'),
      meal(0, 'lunch', 'egg-fried-rice'),
      meal(1, 'dinner', 'spag-bol'), // tomorrow, must not leak into today
    ]),
    SEED_HOUSEHOLD,
    noon(0),
  );
  check('status is ok', view.status === 'ok');
  check("only today's meals are shown", view.meals.length === 3, `${view.meals.length}`);
  check(
    'meals are ordered breakfast, lunch, dinner',
    view.meals.map((m) => m.slot).join(',') === 'breakfast,lunch,dinner',
    view.meals.map((m) => m.slot).join(','),
  );
  check('dinner is the hero', view.dinner?.recipe.id === 'steak-chips-salad');
  check('hero flag is set only on the dinner', view.meals.filter((m) => m.hero).length === 1);
  check(
    'attendees are resolved to people',
    view.dinner?.attendees.length === SEED_HOUSEHOLD.people.length,
  );
  check('hands-on time comes from the recipe', (view.dinner?.handsOnMinutes ?? 0) > 0);
}

// --- attendance reflects absences ---------------------------------------
{
  const household = {
    ...SEED_HOUSEHOLD,
    absences: [{ personId: 'p-katie', day: 0 as DayIndex, slot: 'dinner' as MealSlot }],
  };
  const view = buildToday(plan([meal(0, 'dinner', 'steak-chips-salad')]), household, noon(0));
  check(
    'an absence drops that person from who is eating',
    view.dinner?.attendees.every((p) => p.id !== 'p-katie') === true &&
      view.dinner?.attendees.length === SEED_HOUSEHOLD.people.length - 1,
  );
}

// --- coming up: make-ahead ----------------------------------------------
{
  const view = buildToday(
    plan([
      meal(0, 'dinner', 'steak-chips-salad'),
      meal(1, 'breakfast', 'overnight-oats-berries'), // make-ahead tomorrow
    ]),
    SEED_HOUSEHOLD,
    noon(0),
  );
  check('a make-ahead tomorrow surfaces a note', view.comingUp.length === 1);
  check('and it is tagged make-ahead', view.comingUp[0]?.kind === 'make-ahead');
  check('naming the dish', view.comingUp[0]?.recipeId === 'overnight-oats-berries');
}

// --- coming up: planned-over --------------------------------------------
{
  const view = buildToday(
    plan([
      meal(0, 'dinner', 'beef-chilli', { portions: 8 }), // cooked big tonight
      meal(1, 'lunch', 'beef-chilli', {
        source: 'planned-over',
        cookedOn: { day: 0, slot: 'dinner' },
      }),
    ]),
    SEED_HOUSEHOLD,
    noon(0),
  );
  check('a planned-over covering tomorrow surfaces a note', view.comingUp.length === 1);
  check('tagged planned-over', view.comingUp[0]?.kind === 'planned-over');
  check("for tomorrow's lunch", view.comingUp[0]?.targetSlot === 'lunch');
}

// --- coming up: planned-overs sort ahead of make-aheads -----------------
{
  const view = buildToday(
    plan([
      meal(0, 'dinner', 'beef-chilli', { portions: 8 }),
      meal(1, 'breakfast', 'overnight-oats-berries'),
      meal(1, 'lunch', 'beef-chilli', {
        source: 'planned-over',
        cookedOn: { day: 0, slot: 'dinner' },
      }),
    ]),
    SEED_HOUSEHOLD,
    noon(0),
  );
  check('both notes appear', view.comingUp.length === 2);
  check('planned-over comes first', view.comingUp[0]?.kind === 'planned-over');
}

// --- coming up: many make-aheads collapse to one, dinner preferred ------
{
  const view = buildToday(
    plan([
      meal(0, 'dinner', 'steak-chips-salad'),
      meal(1, 'breakfast', 'overnight-oats-berries'), // make-ahead
      meal(1, 'lunch', 'tuna-sweetcorn-wraps'), // make-ahead
      meal(1, 'dinner', 'beef-chilli'), // make-ahead
    ]),
    SEED_HOUSEHOLD,
    noon(0),
  );
  check('three make-aheads collapse to a single note', view.comingUp.length === 1, `${view.comingUp.length}`);
  check('and the dinner is the one kept', view.comingUp[0]?.targetSlot === 'dinner', view.comingUp[0]?.targetSlot);
}

// --- a planned-over today reads as a reheat, not a cook -----------------
{
  const view = buildToday(
    plan([
      meal(1, 'dinner', 'beef-chilli', {
        source: 'planned-over',
        cookedOn: { day: 0, slot: 'dinner' },
      }),
    ]),
    SEED_HOUSEHOLD,
    noon(1),
  );
  check("today's planned-over is marked carried", view.meals[0]?.carried === true);
}

// --- no tomorrow on Sunday ----------------------------------------------
{
  const view = buildToday(
    plan([meal(6, 'dinner', 'steak-chips-salad')]),
    SEED_HOUSEHOLD,
    noon(6),
  );
  check('Sunday has no coming-up (no tomorrow in the week)', view.comingUp.length === 0);
}

// --- empty states --------------------------------------------------------
{
  const noPlan = buildToday(null, SEED_HOUSEHOLD, noon(0));
  check('no plan is reported', noPlan.status === 'no-plan' && noPlan.meals.length === 0);

  const outside = buildToday(plan([meal(0, 'dinner', 'steak-chips-salad')]), SEED_HOUSEHOLD, new Date(2026, 7, 2, 12));
  check('today outside the plan week is reported', outside.status === 'today-outside-week');

  const bare = buildToday(plan([meal(1, 'dinner', 'steak-chips-salad')]), SEED_HOUSEHOLD, noon(0));
  check('a day with no meals is reported', bare.status === 'no-meals-today' && bare.dayName === 'Monday');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
