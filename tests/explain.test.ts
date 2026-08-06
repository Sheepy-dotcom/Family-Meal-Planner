/**
 * "Why is this dish here?" tests. The explanation must be grounded in the same
 * one-out analysis feasibility uses — never a reason that wasn't really binding.
 * Households are built with controlled absences and time budgets so each
 * scenario has exactly one honest answer.
 */
import { SEED_HOUSEHOLD } from '../src/core/data/household.js';
import { explainMeal } from '../src/core/planner/explain.js';
import type { AbsenceEntry, DayIndex, Household, MealPlan, MealSlot, PlannedMeal, TimeBudget } from '../src/core/types.js';

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

const ALL = SEED_HOUSEHOLD.people.map((p) => p.id);
function household(over: Partial<Household> = {}): Household {
  return { ...SEED_HOUSEHOLD, absences: [], timeBudgets: [], ...over };
}
function presentIds(h: Household, day: DayIndex, slot: MealSlot): string[] {
  const away = new Set(
    h.absences.filter((a) => a.day === day && a.slot === slot).map((a) => a.personId),
  );
  return h.people.filter((p) => !away.has(p.id)).map((p) => p.id);
}
function meal(day: DayIndex, slot: MealSlot, recipeId: string, attendeeIds: string[], extra: Partial<PlannedMeal> = {}): PlannedMeal {
  return { day, slot, recipeId, portions: 4, attendeeIds, ...extra };
}
function planOf(meals: PlannedMeal[]): MealPlan {
  return { weekStartISO: '2026-08-03', householdId: SEED_HOUSEHOLD.id, meals, seed: 1 };
}

console.log('\nExplain a meal');

// --- a dietary exclusion binds and shapes the dish ----------------------
{
  // No time budget and everyone present, so gluten is the only thing cutting.
  const h = household();
  const m = meal(0, 'dinner', 'salmon-traybake', ALL); // gluten-free, not red-meat
  const exp = explainMeal(m, planOf([m]), { household: h, history: [] });

  check('the pool was genuinely narrowed', exp.eligible < exp.total, `${exp.eligible}/${exp.total}`);
  check('the gluten exclusion is a binding rule', exp.binding.some((b) => b.ruleId === 'dietary-exclusions'));
  check('no time budget means time does not bind', !exp.binding.some((b) => b.ruleId === 'time-budget'));
  check('sentence opens with the day', exp.sentence.startsWith('Monday:'), exp.sentence);
  check('names who cannot have gluten', exp.sentence.includes("Katie can't have gluten"), exp.sentence);
  check('draws the conclusion about the dish', exp.sentence.includes('so this is') && exp.sentence.includes('gluten-free'), exp.sentence);
  check('does not invent a weekend-fish reason on a Monday', !exp.sentence.includes('fish is off the menu'), exp.sentence);
}

// --- a tight time budget binds and makes the dish "quick" ---------------
{
  // Katie out, so diet is quiet and the time budget is the only cutter.
  const h = household({
    absences: [{ personId: 'p-katie', day: 0, slot: 'dinner' }] as AbsenceEntry[],
    timeBudgets: [{ day: 0, slot: 'dinner', maxActiveMinutes: 15 }] as TimeBudget[],
  });
  const m = meal(0, 'dinner', 'steak-chips-salad', presentIds(h, 0, 'dinner'));
  const exp = explainMeal(m, planOf([m]), { household: h, history: [] });

  check('time budget is a binding rule', exp.binding.some((b) => b.ruleId === 'time-budget'), JSON.stringify(exp.binding));
  check('names the time constraint', exp.sentence.includes('15 minutes on the hob'), exp.sentence);
  check('and calls the dish quick', exp.sentence.includes('quick'), exp.sentence);
}

// --- no-weekend-fish + a due protein request (the Saturday example) ------
{
  const h = household({
    absences: [{ personId: 'p-katie', day: 5, slot: 'dinner' }] as AbsenceEntry[],
    timeBudgets: [{ day: 5, slot: 'dinner', maxActiveMinutes: 120 }] as TimeBudget[],
  });
  const m = meal(5, 'dinner', 'steak-chips-salad', presentIds(h, 5, 'dinner'));
  const exp = explainMeal(m, planOf([m]), { household: h, history: [] });

  check('weekend fish rule binds', exp.binding.some((b) => b.ruleId === 'no-weekend-fish'));
  check('with Katie out, gluten does not bind', !exp.binding.some((b) => b.ruleId === 'dietary-exclusions'));
  check('sentence opens with Saturday', exp.sentence.startsWith('Saturday:'), exp.sentence);
  check('names the weekend fish rule', exp.sentence.includes('fish is off the menu at weekends'), exp.sentence);
  check("Jack's protein request reads as due", exp.sentence.includes("Jack's red meat was due"), exp.sentence);
  check('does not mention gluten', !exp.sentence.includes('gluten'), exp.sentence);
}

// --- a request with slack is NOT called due -----------------------------
{
  const h = household({ absences: [{ personId: 'p-katie', day: 5, slot: 'dinner' }] as AbsenceEntry[] });
  const sat = meal(5, 'dinner', 'steak-chips-salad', presentIds(h, 5, 'dinner'));
  const fri = meal(4, 'dinner', 'smash-burgers', ALL); // a second red-meat dinner Jack eats
  const exp = explainMeal(sat, planOf([sat, fri]), { household: h, history: [] });

  check('two red-meat dinners means neither was forced', !exp.sentence.includes('was due'), exp.sentence);
  check('the weekend fish rule still binds', exp.sentence.includes('fish is off the menu at weekends'), exp.sentence);
}

// --- nothing meaningfully bound -> say so, do not confabulate ------------
{
  const h = household({ absences: [{ personId: 'p-katie', day: 2, slot: 'lunch' }] as AbsenceEntry[] });
  const m = meal(2, 'lunch', 'egg-fried-rice', presentIds(h, 2, 'lunch'));
  const exp = explainMeal(m, planOf([m]), { household: h, history: [] });

  check('no rule was binding', exp.binding.length === 0, JSON.stringify(exp.binding));
  check('every slot dish was eligible', exp.eligible === exp.total, `${exp.eligible}/${exp.total}`);
  check('it says plainly that nothing forced it', exp.sentence.includes('free pick'), exp.sentence);
  check('and still opens with the day', exp.sentence.startsWith('Wednesday:'), exp.sentence);
}

// --- kids-alone-easy binds when both adults are out ---------------------
{
  const h = household({
    absences: [
      { personId: 'p-ed', day: 3, slot: 'dinner' },
      { personId: 'p-louise', day: 3, slot: 'dinner' },
    ] as AbsenceEntry[],
  });
  const m = meal(3, 'dinner', 'beef-chilli', presentIds(h, 3, 'dinner'));
  const exp = explainMeal(m, planOf([m]), { household: h, history: [] });

  check('the kids-alone rule binds', exp.binding.some((b) => b.ruleId === 'kids-alone-easy'), JSON.stringify(exp.binding));
  check('sentence notes no adult is eating', exp.sentence.includes("no adult's eating"), exp.sentence);
}

// --- a planned-over explains itself as a reheat -------------------------
{
  const h = household();
  const m = meal(1, 'lunch', 'beef-chilli', ALL, { source: 'planned-over', cookedOn: { day: 0, slot: 'dinner' } });
  const exp = explainMeal(m, planOf([m]), { household: h, history: [] });

  check('a carried meal is explained as cooked-once-eaten-twice', exp.sentence.includes('cooked once, eaten twice'), exp.sentence);
  check('and points back to when it was cooked', exp.sentence.includes('Monday') && exp.sentence.startsWith('Tuesday:'), exp.sentence);
}

// --- total counts only slot-suitable dishes -----------------------------
{
  const h = household();
  const m = meal(0, 'dinner', 'steak-chips-salad', ALL);
  const exp = explainMeal(m, planOf([m]), { household: h, history: [] });
  check('total is a sensible slot pool', exp.total > 5 && exp.eligible <= exp.total, `${exp.eligible}/${exp.total}`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
