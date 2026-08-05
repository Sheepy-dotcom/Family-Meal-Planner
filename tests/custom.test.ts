/**
 * Household-authored rules. The point of the design is that these compile into
 * the same interfaces the built-ins use, so the tests check both the compiled
 * behaviour and that the solver / feasibility / explain pick them up unchanged.
 */
import { SEED_HOUSEHOLD } from '../src/core/data/household.js';
import { getRecipe } from '../src/core/data/registry.js';
import {
  compileHardRules,
  compileSoftRules,
  supportsHard,
  effectiveEnforcement,
  availableEnforcements,
  describeRule,
  enforcementBlurb,
} from '../src/core/rules/custom.js';
import { isAllowed } from '../src/core/rules/hard.js';
import { evaluateSoftRules } from '../src/core/rules/soft.js';
import { checkFeasibility } from '../src/core/planner/feasibility.js';
import { reconcilePlan } from '../src/core/planner/reconcile.js';
import { explainMeal } from '../src/core/planner/explain.js';
import { previewImpact } from '../src/core/planner/rulePreview.js';
import { generatePlan } from '../src/core/planner/solver.js';
import type {
  AvoidRule,
  CustomRule,
  DayIndex,
  Household,
  MealPlan,
  MealSlot,
  NoConsecutiveRule,
  PersonProteinRule,
  PlannedMeal,
  TagCountRule,
} from '../src/core/types.js';
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

const ALL = SEED_HOUSEHOLD.people.map((p) => p.id);
function base(over: Partial<Household> = {}): Household {
  return { ...SEED_HOUSEHOLD, absences: [], timeBudgets: [], ...over };
}
function ctxWith(rules: CustomRule[], household: Household = base()): RuleContext {
  return { household: { ...household, customRules: rules }, history: [] };
}
function meal(day: DayIndex, slot: MealSlot, recipeId: string, attendeeIds = ALL): PlannedMeal {
  return { day, slot, recipeId, portions: 4, attendeeIds };
}
function planOf(meals: PlannedMeal[]): MealPlan {
  return { weekStartISO: '2026-08-03', householdId: SEED_HOUSEHOLD.id, meals, seed: 1 };
}

console.log('\nCustom household rules');

// --- which enforcements each shape supports -----------------------------
{
  const avoid: AvoidRule = { id: 'a', kind: 'avoid', enforcement: 'hard', proteins: ['fish'], days: [], slots: ['dinner'] };
  const person: PersonProteinRule = { id: 'p', kind: 'person-protein', enforcement: 'hard', personId: 'p-jack', proteins: ['red-meat'], minPerWeek: 1 };
  const tagMax: TagCountRule = { id: 't', kind: 'tag-count', enforcement: 'hard', tag: 'traybake', bound: 'at-most', count: 1 };
  const tagMin: TagCountRule = { id: 't2', kind: 'tag-count', enforcement: 'hard', tag: 'salad', bound: 'at-least', count: 2 };

  check('avoid can be hard', supportsHard(avoid));
  check('a weekly minimum cannot be hard', !supportsHard(person));
  check('at-most can be hard', supportsHard(tagMax));
  check('at-least cannot be hard', !supportsHard(tagMin));
  check('unsupported hard clamps to soft', effectiveEnforcement(person) === 'soft');
  check('available enforcements reflect support', availableEnforcements(person).join() === 'soft');
}

// --- avoid, hard: compiles to a veto the engine honours -----------------
{
  const rule: AvoidRule = { id: 'no-fish', kind: 'avoid', enforcement: 'hard', proteins: ['fish', 'shellfish'], days: [], slots: ['dinner'] };
  check('routes to the hard list', compileHardRules([rule]).length === 1 && compileSoftRules([rule]).length === 0);

  const ctx = ctxWith([rule]);
  check('a fish dinner is vetoed', !isAllowed(getRecipe('salmon-traybake'), 0, 'dinner', ctx));
  check('a non-fish dinner is allowed', isAllowed(getRecipe('steak-chips-salad'), 0, 'dinner', ctx));

  // End to end: the solver never places a fish dinner.
  const plan = generatePlan(ctx, '2026-08-03', { seed: 3 }).plan;
  const fishDinners = plan.meals.filter(
    (m) => m.slot === 'dinner' && getRecipe(m.recipeId).proteins.some((p) => p === 'fish' || p === 'shellfish'),
  );
  check('the solver plans no fish dinners', fishDinners.length === 0, `${fishDinners.length}`);
}

// --- avoid, hard: feasibility and explain both see it -------------------
{
  const rule: AvoidRule = { id: 'no-fish', kind: 'avoid', enforcement: 'hard', proteins: ['fish'], days: [], slots: ['dinner'] };
  const dinnerBefore = checkFeasibility(ctxWith([])).slots.find((s) => s.slot === 'dinner')!;
  const dinnerAfter = checkFeasibility(ctxWith([rule])).slots.find((s) => s.slot === 'dinner')!;
  check('feasibility eligibility drops', dinnerAfter.eligible < dinnerBefore.eligible, `${dinnerBefore.eligible}->${dinnerAfter.eligible}`);

  // With Katie out, the custom rule is the dominant cutter, so explain names it.
  const ctx = ctxWith([rule], base({ absences: [{ personId: 'p-katie', day: 0, slot: 'dinner' }] }));
  const m = meal(0, 'dinner', 'steak-chips-salad', ['p-ed', 'p-louise', 'p-jack']);
  const exp = explainMeal(m, planOf([m]), ctx);
  check('explain counts the custom rule as binding', exp.binding.some((b) => b.ruleId.startsWith('custom:')));
  check('and surfaces its clause with no special casing', exp.sentence.includes('fish is off the menu'), exp.sentence);
}

// --- avoid, soft: allowed but penalised ---------------------------------
{
  const rule: AvoidRule = { id: 'soft-fish', kind: 'avoid', enforcement: 'soft', weight: 3, proteins: ['fish'], days: [], slots: ['dinner'] };
  check('routes to the soft list', compileSoftRules([rule]).length === 1 && compileHardRules([rule]).length === 0);

  const ctx = ctxWith([rule]);
  check('soft never vetoes a dish', isAllowed(getRecipe('salmon-traybake'), 0, 'dinner', ctx));

  const soft = evaluateSoftRules(planOf([meal(0, 'dinner', 'salmon-traybake')]).meals, ctx);
  const entry = soft.find((r) => r.ruleId === 'custom:soft-fish');
  check('a served fish dinner costs score', !!entry && entry.score < 1, `${entry?.score}`);
  check('and carries the chosen weight', entry?.weight === 3, `${entry?.weight}`);
}

// --- person gets a protein N times: soft, scores the shortfall ----------
{
  const rule: PersonProteinRule = { id: 'jack-meat', kind: 'person-protein', enforcement: 'hard', personId: 'p-jack', proteins: ['red-meat'], minPerWeek: 2 };
  check('a minimum is compiled soft even when hard is asked', compileSoftRules([rule]).length === 1 && compileHardRules([rule]).length === 0);

  const ctx = ctxWith([rule]);
  const one = evaluateSoftRules(planOf([meal(0, 'dinner', 'steak-chips-salad')]).meals, ctx).find((r) => r.ruleId === 'custom:jack-meat');
  check('one of two needed scores half', Math.abs((one?.score ?? 0) - 0.5) < 1e-9, `${one?.score}`);
}

// --- tag at-most, hard: caps the week -----------------------------------
{
  const rule: TagCountRule = { id: 'cap-tray', kind: 'tag-count', enforcement: 'hard', tag: 'traybake', bound: 'at-most', count: 1 };
  const [hard] = compileHardRules([rule]);
  const ctx = ctxWith([rule]);
  const placedOne = [meal(0, 'dinner', 'salmon-traybake')]; // one traybake already
  check('a second traybake is blocked once the cap is hit', !hard.allows(getRecipe('sausage-traybake'), 1, 'dinner', ctx, placedOne));
  check('the first traybake is fine', hard.allows(getRecipe('sausage-traybake'), 1, 'dinner', ctx, []));
  check('a non-traybake is unaffected', hard.allows(getRecipe('steak-chips-salad'), 1, 'dinner', ctx, placedOne));
}

// --- no repeated cuisine on consecutive days, hard ----------------------
{
  const rule: NoConsecutiveRule = { id: 'no-run', kind: 'no-consecutive', enforcement: 'hard', by: 'cuisine', slot: 'dinner' };
  const [hard] = compileHardRules([rule]);
  const ctx = ctxWith([rule]);
  const monday = [meal(0, 'dinner', 'salmon-traybake')]; // italian on Monday
  check('the same cuisine the next day is blocked', !hard.allows(getRecipe('spag-bol'), 1, 'dinner', ctx, monday));
  check('a different cuisine the next day is fine', hard.allows(getRecipe('steak-chips-salad'), 1, 'dinner', ctx, monday));
  check('two days apart does not clash', hard.allows(getRecipe('spag-bol'), 2, 'dinner', ctx, monday));
}

// --- preview: quantify a hard avoid -------------------------------------
{
  const rule: AvoidRule = { id: 'no-fish', kind: 'avoid', enforcement: 'hard', proteins: ['fish'], days: [], slots: ['dinner'] };
  const impact = previewImpact(rule, ctxWith([]));
  check('a hard avoid stays feasible here', impact.ok);
  check('and reports how many dinners it rules out', /rules out \d+ of \d+ dinners/.test(impact.headline), impact.headline);
}

// --- preview: catch an impossible week ----------------------------------
{
  // Tuesday dinner already tight on time; ban every protein there and nothing is left.
  const household = base({
    absences: [{ personId: 'p-katie', day: 1, slot: 'dinner' }],
    timeBudgets: [{ day: 1, slot: 'dinner', maxActiveMinutes: 15 }],
  });
  const rule: AvoidRule = {
    id: 'ban-proteins', kind: 'avoid', enforcement: 'hard',
    proteins: ['fish', 'shellfish', 'chicken', 'red-meat', 'pork', 'egg', 'legume', 'dairy-protein', 'meat-substitute'],
    days: [1], slots: ['dinner'],
  };
  const impact = previewImpact(rule, ctxWith([], household));
  check('an impossible slot is caught, not saved silently', !impact.ok, impact.headline);
  check('and the interaction is named', impact.headline.includes('time budget') && impact.headline.includes('Tuesday'), impact.headline);
}

// --- preview: soft goal, and an unreachable minimum ---------------------
{
  const soft: AvoidRule = { id: 'soft-fish', kind: 'avoid', enforcement: 'soft', proteins: ['fish'], days: [], slots: ['dinner'] };
  check('a soft rule reads as a weighted goal', previewImpact(soft, ctxWith([])).headline.includes('Soft goal'));

  const greedy: PersonProteinRule = { id: 'jack-lots', kind: 'person-protein', enforcement: 'soft', personId: 'p-jack', proteins: ['red-meat'], minPerWeek: 30 };
  const impact = previewImpact(greedy, ctxWith([]));
  check('an unreachable minimum is flagged', impact.details.some((d) => d.includes("can't be met")), JSON.stringify(impact.details));
}

// --- reconcile catches meals broken by a custom rule --------------------
{
  // A plan carrying a fish dinner, then a hard "no fish at dinner" rule added.
  const rule: AvoidRule = { id: 'no-fish', kind: 'avoid', enforcement: 'hard', proteins: ['fish', 'shellfish'], days: [], slots: ['dinner'] };
  const plan = planOf([meal(0, 'dinner', 'salmon-traybake')]);
  const broken = reconcilePlan(plan, ctxWith([rule])).broken;
  check('reconcile flags a meal a custom rule now forbids', broken.some((v) => v.ruleId === 'custom:no-fish'), JSON.stringify(broken));

  // Without the rule, the same plan reconciles clean.
  const clean = reconcilePlan(plan, ctxWith([])).broken;
  check('and does not invent breakages when there is no such rule', !clean.some((v) => v.ruleId.startsWith('custom:')));
}

// --- descriptions read plainly ------------------------------------------
{
  const rule: AvoidRule = { id: 'x', kind: 'avoid', enforcement: 'hard', proteins: ['fish'], days: [4, 5, 6], slots: ['dinner'] };
  check('describeRule is plain', describeRule(rule) === 'Never serve fish on Fri/Sat/Sun at dinner', describeRule(rule));
  check('the enforcement difference is explained', enforcementBlurb('hard').startsWith('Hard') && enforcementBlurb('soft').startsWith('Soft'));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
