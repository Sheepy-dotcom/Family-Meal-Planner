/**
 * Headless engine tests. No framework — `npm test` runs this file directly so
 * the rule engine can be verified before any UI exists.
 */
import { INGREDIENTS, getIngredient } from '../src/core/data/ingredients.js';
import { RECIPES } from '../src/core/data/recipes.js';
import { getRecipe, allRecipes, setUserRecipes } from '../src/core/data/registry.js';
import { validateRecipe, finaliseRecipe } from '../src/core/recipes/validate.js';
import { scaleRecipeForMeal, timingFor } from '../src/core/recipes/scale.js';
import { buildPersonProfile } from '../src/core/people/profile.js';
import {
  proteinWeightOf,
  isProteinForward,
  portionFactorFor,
  canSetGoal,
} from '../src/core/people/goals.js';
import { dishVerdicts, favouritesFor } from '../src/core/learning/feedback.js';
import { SEED_HOUSEHOLD } from '../src/core/data/household.js';
import { generatePlan, reroll } from '../src/core/planner/solver.js';
import { checkFeasibility, checkVariety } from '../src/core/planner/feasibility.js';
import { proposeRules, applyProposal } from '../src/core/learning/feedback.js';
import {
  suggestPlannedOvers,
  applyPlannedOver,
  clearPlannedOvers,
} from '../src/core/planner/leftovers.js';
import { deepLinkAdapters, RETAILERS } from '../src/core/basket/deeplink.js';
import {
  validateAnswers,
  buildHousehold,
  weightsForLean,
} from '../src/core/onboarding/questions.js';
import type { OnboardingAnswers } from '../src/core/onboarding/questions.js';
import { DEFAULT_WEIGHTS } from '../src/core/rules/config.js';
import { reconcilePlan, repairPlan } from '../src/core/planner/reconcile.js';
import {
  checkPlanIntegrity,
  dropOrphanedMeals,
  mealsUsing,
} from '../src/core/planner/integrity.js';
import { isAllowed } from '../src/core/rules/hard.js';
import { evaluateSoftRules } from '../src/core/rules/soft.js';
import { evaluatePlan, attendeesFor, type RuleContext } from '../src/core/rules/index.js';
import { buildShoppingList, allLines, aisleOrder } from '../src/core/shopping/list.js';
import {
  EMPTY_PANTRY,
  applyPantry,
  pantryForWeek,
  toggleHave,
  toggleAlwaysStocked,
  pantrySummary,
  coverageNote,
} from '../src/core/pantry/pantry.js';
import { flagShoppingList, screenPlan } from '../src/core/diet/screen.js';
import { manualExportAdapter } from '../src/core/basket/manual.js';
import { toBase, roundToPacks, convertBase } from '../src/core/units.js';
import type { DayIndex } from '../src/core/types.js';

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

function section(title: string) {
  console.log(`\n${title}`);
}

const ctx: RuleContext = { household: SEED_HOUSEHOLD, history: [] };

// ---------------------------------------------------------------------------
section('Data integrity');

const badIngredientRefs = RECIPES.flatMap((r) =>
  r.ingredients
    .filter((ri) => !INGREDIENTS.some((i) => i.id === ri.ingredientId))
    .map((ri) => `${r.id} -> ${ri.ingredientId}`),
);
check('every recipe ingredient resolves', badIngredientRefs.length === 0, badIngredientRefs.join(', '));

const dupRecipeIds = RECIPES.length - new Set(RECIPES.map((r) => r.id)).size;
check('no duplicate recipe ids', dupRecipeIds === 0);

const dupIngredientIds = INGREDIENTS.length - new Set(INGREDIENTS.map((i) => i.id)).size;
check('no duplicate ingredient ids', dupIngredientIds === 0);

check(
  'every recipe declares at least one slot',
  RECIPES.every((r) => r.slots.length > 0),
);

check(
  'active time never exceeds total time',
  RECIPES.every((r) => r.activeMinutes <= r.totalMinutes),
);

/**
 * Catches the recipe-author mistake that would otherwise blow up at shopping
 * time: counting an ingredient in one recipe and weighing it in another,
 * without telling us how heavy one of them is.
 */
const unitClashes: string[] = [];
for (const ingredient of INGREDIENTS) {
  const target = ingredient.pack?.unit;
  const usedUnits = new Set(
    RECIPES.flatMap((r) =>
      r.ingredients
        .filter((ri) => ri.ingredientId === ingredient.id)
        .map((ri) => toBase({ amount: 1, unit: ri.unit }).unit),
    ),
  );
  if (usedUnits.size === 0) continue;
  const canonical = target ?? [...usedUnits][0];
  for (const used of usedUnits) {
    const converted = convertBase(
      { amount: 1, unit: used },
      canonical,
      ingredient.gramsPerUnit,
      ingredient.gramsPerMl,
    );
    if (!converted) {
      unitClashes.push(`${ingredient.id}: used as ${used}, tracked as ${canonical}`);
    }
  }
}
check('ingredient units reconcile across recipes', unitClashes.length === 0, unitClashes.join('; '));

// ---------------------------------------------------------------------------
section('Units');

check('kg converts to grams', toBase({ amount: 1.5, unit: 'kg' }).amount === 1500);
check('tbsp converts to ml', toBase({ amount: 2, unit: 'tbsp' }).amount === 30);
check(
  'countables stay countable',
  toBase({ amount: 3, unit: 'unit' }).unit === 'unit',
);

const packRounding = roundToPacks({ amount: 450, unit: 'g' }, { amount: 400, unit: 'g' });
check(
  '450g of a 400g tin rounds up to 2 packs',
  packRounding.packsToBuy === 2 && packRounding.buy.amount === 800,
  JSON.stringify(packRounding),
);

// ---------------------------------------------------------------------------
section('Plan generation');

const result = generatePlan(ctx, '2026-08-03', { seed: 42 });
const { plan, evaluation, unfilled } = result;

check('plan fills every attended slot', unfilled.length === 0, JSON.stringify(unfilled));
check('plan produced meals', plan.meals.length > 0);
check(
  'no hard-rule violations',
  evaluation.violations.length === 0,
  evaluation.violations.map((v) => v.message).join(' | '),
);

// The rule that would be easiest to quietly break.
const weekendFish = plan.meals.filter(
  (m) =>
    m.slot === 'dinner' &&
    m.day >= 4 &&
    getRecipe(m.recipeId).proteins.some((p) => p === 'fish' || p === 'shellfish'),
);
check('no fish on Fri/Sat/Sun evenings', weekendFish.length === 0);

// Katie is coeliac in the seed data and eats every dinner.
const glutenWithKatie = plan.meals.filter((m) => {
  if (!m.attendeeIds.includes('p-katie')) return false;
  return getRecipe(m.recipeId).ingredients.some((ri) =>
    getIngredient(ri.ingredientId).allergens.includes('gluten'),
  );
});
check(
  'no gluten served when the coeliac diner is present',
  glutenWithKatie.length === 0,
  glutenWithKatie.map((m) => `day ${m.day} ${m.slot}`).join(', '),
);

// Thursday dinner: both adults out.
const thursdayDinner = plan.meals.find((m) => m.day === 3 && m.slot === 'dinner');
const thursdayRecipe = thursdayDinner ? getRecipe(thursdayDinner.recipeId) : null;
check(
  'adult-free Thursday gets a kid-manageable dish',
  !!thursdayRecipe &&
    (thursdayRecipe.tags.includes('kid-easy') || thursdayRecipe.tags.includes('make-ahead')),
  thursdayRecipe?.name,
);

// Time budgets.
const overBudget = plan.meals.filter((m) => {
  const budget = SEED_HOUSEHOLD.timeBudgets.find(
    (b) => b.day === m.day && b.slot === m.slot,
  );
  return budget ? getRecipe(m.recipeId).activeMinutes > budget.maxActiveMinutes : false;
});
check('every meal fits its time budget', overBudget.length === 0);

// Attendance-aware portioning.
const portionsCorrect = plan.meals.every((m) => {
  const expected = attendeesFor(SEED_HOUSEHOLD, m.day as DayIndex, m.slot).map((p) => p.id);
  return (
    m.attendeeIds.length === expected.length &&
    expected.every((id) => m.attendeeIds.includes(id))
  );
});
check('attendees match the absence schedule', portionsCorrect);

// No dinner twice in one week, and no dish on constant repeat.
const dinnerIds = plan.meals.filter((m) => m.slot === 'dinner').map((m) => m.recipeId);
check('no dinner repeats within the week', new Set(dinnerIds).size === dinnerIds.length);

const breakfastIds = plan.meals.filter((m) => m.slot === 'breakfast').map((m) => m.recipeId);
const maxBreakfastRepeat = Math.max(
  0,
  ...[...new Set(breakfastIds)].map((id) => breakfastIds.filter((x) => x === id).length),
);
check('no breakfast appears more than twice', maxBreakfastRepeat <= 2, `max ${maxBreakfastRepeat}`);

// ---------------------------------------------------------------------------
section('Infeasibility is reported, never hidden');

// Squeeze the time budget until nothing fits, and check we're told which slot
// and why rather than handed a week with a hole in it.
const impossible = {
  ...SEED_HOUSEHOLD,
  timeBudgets: [{ day: 0 as DayIndex, slot: 'dinner' as const, maxActiveMinutes: 1 }],
};
const squeezed = generatePlan({ ...ctx, household: impossible }, '2026-08-03', { seed: 42 });
const mondayDinnerMissing = !squeezed.plan.meals.some(
  (m) => m.day === 0 && m.slot === 'dinner',
);
check('impossible slot is left empty', mondayDinnerMissing);
check(
  'impossible slot is reported with a reason',
  squeezed.unfilled.some((u) => u.day === 0 && u.slot === 'dinner' && u.reason.length > 20),
  JSON.stringify(squeezed.unfilled),
);
check(
  'the rest of the week still gets planned',
  squeezed.plan.meals.length > 15,
  `${squeezed.plan.meals.length} meals`,
);

// ---------------------------------------------------------------------------
section('Determinism');

const again = generatePlan(ctx, '2026-08-03', { seed: 42 });
check(
  'same seed produces the same plan',
  JSON.stringify(again.plan.meals) === JSON.stringify(plan.meals),
);

const different = generatePlan(ctx, '2026-08-03', { seed: 7 });
check(
  'a different seed produces a different plan',
  JSON.stringify(different.plan.meals) !== JSON.stringify(plan.meals),
);

// ---------------------------------------------------------------------------
section('Single-meal reroll');

const target = { day: 1 as DayIndex, slot: 'dinner' as const };
const rerolled = reroll(plan, target, ctx);
const before = plan.meals.find((m) => m.day === 1 && m.slot === 'dinner')!;
const after = rerolled.plan.meals.find((m) => m.day === 1 && m.slot === 'dinner')!;

check('rerolled slot changes dish', before.recipeId !== after.recipeId);
check(
  'reroll leaves every other meal alone',
  plan.meals
    .filter((m) => !(m.day === 1 && m.slot === 'dinner'))
    .every((m) =>
      rerolled.plan.meals.some(
        (n) => n.day === m.day && n.slot === m.slot && n.recipeId === m.recipeId,
      ),
    ),
);
check('reroll keeps the plan legal', rerolled.evaluation.violations.length === 0);

// ---------------------------------------------------------------------------
section('Shopping list');

const list = buildShoppingList(plan);
const lines = allLines(list);

check('shopping list has lines', lines.length > 0);
check(
  'every line rounds up to at least what is needed',
  lines.every((l) => l.buy.amount >= l.needed.amount - 1e-9),
);
check(
  'staples are held back for a cupboard check',
  list.checkCupboard.length > 0 &&
    list.checkCupboard.every((l) => getIngredient(l.ingredientId).staple === true),
);
check(
  'no ingredient appears in two aisles',
  new Set(lines.map((l) => l.ingredientId)).size === lines.length,
);

// Ingredients used by more than one recipe must aggregate, not duplicate.
const multiUse = lines.filter((l) => l.usedBy.length > 1);
check('shared ingredients aggregate into one line', multiUse.length > 0);

// Portion scaling must actually move the numbers.
const bigHousehold = {
  ...SEED_HOUSEHOLD,
  people: SEED_HOUSEHOLD.people.map((p) => ({ ...p, portionFactor: p.portionFactor * 2 })),
};
const bigPlan = generatePlan({ ...ctx, household: bigHousehold }, '2026-08-03', { seed: 42 });
const bigList = buildShoppingList(bigPlan.plan);
check(
  'doubling portions increases the shop',
  allLines(bigList).reduce((s, l) => s + l.needed.amount, 0) >
    lines.reduce((s, l) => s + l.needed.amount, 0),
);

// ---------------------------------------------------------------------------
section('Dietary screening');

const screens = screenPlan(plan, SEED_HOUSEHOLD);
check(
  'no exclusion flags on a legal plan',
  screens.every((s) => s.flags.length === 0),
  screens.flatMap((s) => s.flags.map((f) => `${f.personName}/${f.allergen}`)).join(', '),
);

// A deliberately illegal plan must be caught, not quietly passed.
const glutenRecipe = RECIPES.find((r) =>
  r.slots.includes('dinner') &&
  r.ingredients.some((ri) => getIngredient(ri.ingredientId).allergens.includes('gluten')),
)!;
const badPlan = {
  ...plan,
  meals: [
    {
      day: 0 as DayIndex,
      slot: 'dinner' as const,
      recipeId: glutenRecipe.id,
      portions: 4,
      attendeeIds: SEED_HOUSEHOLD.people.map((p) => p.id),
    },
  ],
};
const badScreen = screenPlan(badPlan, SEED_HOUSEHOLD);
check('screen catches a planted exclusion', badScreen[0].flags.length > 0);
check(
  'evaluator marks the planted plan infeasible',
  !evaluatePlan(badPlan.meals, ctx).feasible,
);

const flaggedLines = flagShoppingList(buildShoppingList(badPlan), SEED_HOUSEHOLD);
check('shopping list flags the offending product', flaggedLines.length > 0);

// ---------------------------------------------------------------------------
section('Basket adapter');

const exported = await manualExportAdapter.send(list, flagShoppingList(list, SEED_HOUSEHOLD));
check('adapter exports text', exported.status === 'exported' && exported.text.length > 100);
check(
  'exported text is grouped by aisle',
  exported.text.includes('FRUIT & VEG') || exported.text.includes('MEAT & FISH'),
);

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
section('Feasibility pre-flight');

const feasible = checkFeasibility(ctx);
check('seed household is feasible', feasible.ok, JSON.stringify(feasible.impossible));
check(
  'every attended slot is analysed',
  feasible.slots.length > 15,
  `${feasible.slots.length} slots`,
);
check('no variety warnings for the seed household', checkVariety(ctx).length === 0, checkVariety(ctx).join('; '));

// Squeeze a time budget and confirm the binding rule is named, not just the failure.
const tightCtx = {
  ...ctx,
  household: {
    ...SEED_HOUSEHOLD,
    timeBudgets: [{ day: 0 as DayIndex, slot: 'dinner' as const, maxActiveMinutes: 1 }],
  },
};
const tightReport = checkFeasibility(tightCtx);
const mondayDinner = tightReport.slots.find((s) => s.day === 0 && s.slot === 'dinner')!;
check('impossible slot detected before planning', mondayDinner.pressure === 'impossible');
check(
  'the binding constraint is named',
  mondayDinner.bindingRuleId === 'time-budget',
  `got ${mondayDinner.bindingRuleId}`,
);
check('report is marked not ok', !tightReport.ok);

// An impossible exclusion should point at the dietary rule, not the clock.
const allergicCtx = {
  ...ctx,
  household: {
    ...SEED_HOUSEHOLD,
    people: SEED_HOUSEHOLD.people.map((p) => ({
      ...p,
      dietary: {
        ...p.dietary,
        avoidAllergens: ['gluten', 'milk', 'eggs', 'fish', 'soya', 'sesame'] as const as never,
      },
    })),
  },
};
const allergicReport = checkFeasibility(allergicCtx);
check(
  'a sweeping exclusion blames the dietary rule',
  allergicReport.slots.some((s) => s.bindingRuleId === 'dietary-exclusions'),
);
check(
  'variety warnings appear when the book runs thin',
  checkVariety(allergicCtx).length > 0,
);


// ---------------------------------------------------------------------------
section('Learned preferences');

const today = new Date('2026-08-04');
const iso = (daysAgo: number) =>
  new Date(today.getTime() - daysAgo * 86400000).toISOString();

const noEvidence = proposeRules(
  [
    { type: 'rejected', recipeId: 'spag-bol', at: iso(3) },
    { type: 'rejected', recipeId: 'spag-bol', at: iso(10) },
  ],
  SEED_HOUSEHOLD,
  today,
);
check('two rejections is not enough to propose a rule', noEvidence.length === 0);

const withEvidence = proposeRules(
  [
    { type: 'rejected', recipeId: 'spag-bol', at: iso(3) },
    { type: 'rejected', recipeId: 'spag-bol', at: iso(10) },
    { type: 'rejected', recipeId: 'spag-bol', at: iso(20) },
  ],
  SEED_HOUSEHOLD,
  today,
);
const blockProposal = withEvidence.find((p) => p.kind === 'block-recipe');
check('three rejections proposes retiring the dish', !!blockProposal);
check('the proposal cites checkable evidence', !!blockProposal?.evidence.includes('3'));

const stale = proposeRules(
  [
    { type: 'rejected', recipeId: 'spag-bol', at: iso(200) },
    { type: 'rejected', recipeId: 'spag-bol', at: iso(210) },
    { type: 'rejected', recipeId: 'spag-bol', at: iso(220) },
  ],
  SEED_HOUSEHOLD,
  today,
);
check('evidence ages out of the window', stale.length === 0);

// Accepting a proposal must actually change the plans that follow.
const blockedHousehold = applyProposal(SEED_HOUSEHOLD, blockProposal!);
check(
  'accepting adds the dish to the blocked list',
  (blockedHousehold.blockedRecipeIds ?? []).includes('spag-bol'),
);
const blockedPlan = generatePlan(
  { ...ctx, household: blockedHousehold },
  '2026-08-03',
  { seed: 42 },
);
check(
  'a retired dish never appears again',
  !blockedPlan.plan.meals.some((m) => m.recipeId === 'spag-bol'),
);
check(
  'the same proposal is not suggested twice',
  proposeRules(
    [
      { type: 'rejected', recipeId: 'spag-bol', at: iso(3) },
      { type: 'rejected', recipeId: 'spag-bol', at: iso(10) },
      { type: 'rejected', recipeId: 'spag-bol', at: iso(20) },
    ],
    blockedHousehold,
    today,
  ).every((p) => p.kind !== 'block-recipe'),
);

// Staples appear everywhere, so they must not generate ingredient proposals.
const stapleNoise = proposeRules(
  [
    { type: 'rejected', recipeId: 'spag-bol', at: iso(3) },
    { type: 'rejected', recipeId: 'penne-arrabbiata', at: iso(5) },
    { type: 'rejected', recipeId: 'chana-dhal', at: iso(9) },
  ],
  SEED_HOUSEHOLD,
  today,
);
check(
  'staples never become "avoid this ingredient"',
  !stapleNoise.some(
    (p) => p.kind === 'avoid-ingredient' && getIngredient(p.subject).staple === true,
  ),
);

// ---------------------------------------------------------------------------
section('Planned-overs');

const poPlan = generatePlan(ctx, '2026-08-03', { seed: 3 });
const suggestions = suggestPlannedOvers(poPlan.plan, ctx);
check('planned-overs are suggested', suggestions.length > 0, `${suggestions.length} found`);

if (suggestions.length > 0) {
  const suggestion = suggestions[0];
  const baseList = buildShoppingList(poPlan.plan);
  const applied = applyPlannedOver(poPlan.plan, suggestion);
  const appliedList = buildShoppingList(applied);

  const target = applied.meals.find(
    (m) => m.day === suggestion.targetDay && m.slot === suggestion.targetSlot,
  )!;
  check('the covered slot is marked as a planned-over', target.source === 'planned-over');
  check('it points back to where it was cooked', target.cookedOn?.day === suggestion.sourceDay);

  const source = applied.meals.find(
    (m) => m.day === suggestion.sourceDay && m.slot === suggestion.sourceSlot,
  )!;
  check('the source meal is scaled up', source.portions > (poPlan.plan.meals.find(
    (m) => m.day === suggestion.sourceDay && m.slot === suggestion.sourceSlot,
  )!.portions));

  // The bug this guards against: buying the ingredients twice.
  const sumOf = (l: ReturnType<typeof buildShoppingList>) =>
    allLines(l).reduce((s, x) => s + x.needed.amount, 0);
  check(
    'a planned-over does not double-buy ingredients',
    sumOf(appliedList) < sumOf(baseList) * 1.15,
    `${Math.round(sumOf(appliedList))} vs ${Math.round(sumOf(baseList))}`,
  );

  check(
    'the plan is still legal with a planned-over in it',
    evaluatePlan(applied.meals, ctx).violations.length === 0,
  );

  const cleared = clearPlannedOvers(applied, ctx);
  check(
    'clearing removes the carried meal',
    !cleared.meals.some((m) => m.source === 'planned-over'),
  );
  check(
    'clearing restores the original portions',
    cleared.meals.find(
      (m) => m.day === suggestion.sourceDay && m.slot === suggestion.sourceSlot,
    )!.portions === poPlan.plan.meals.find(
      (m) => m.day === suggestion.sourceDay && m.slot === suggestion.sourceSlot,
    )!.portions,
  );
}

// ---------------------------------------------------------------------------
section('Deep-link basket adapters');

const tesco = deepLinkAdapters.find((a) => a.id === 'deeplink:tesco')!;
const handoff = (await tesco.send(list, flagShoppingList(list, SEED_HOUSEHOLD))) as
  import('../src/core/basket/deeplink.js').DeepLinkResult;

check('handoff produces one item per line', handoff.items.length === allLines(list).length);
check('every item has a search URL', handoff.items.every((i) => i.url.startsWith('https://')));
check(
  'search terms are URL-encoded',
  handoff.items.every((i) => !i.url.includes(' ')),
);
check('status reflects a handoff', handoff.status === 'handed-off');
check(
  'all four retailers build valid URLs',
  RETAILERS.every((r) => r.searchUrl('smoked paprika').startsWith('https://')),
);

// Privacy: nothing about the household may leak into a third-party URL.
// Substring matching gives false positives here ("Ed" is inside "Seeded"), so
// this checks whole words in the decoded query only.
const names = SEED_HOUSEHOLD.people.map((p) => p.name.toLowerCase());
const queryWords = (url: string) =>
  decodeURIComponent(url.split(/[?/=&]/).pop() ?? '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
check(
  'no household details appear in any URL',
  handoff.items.every((i) => !queryWords(i.url).some((w) => names.includes(w))),
);


// ---------------------------------------------------------------------------
section('Onboarding');

const answers: OnboardingAnswers = {
  people: [
    { name: 'Sam', ageBand: 'adult' },
    { name: 'Ali', ageBand: 'adult' },
    { name: 'Robin', ageBand: 'child' },
  ],
  exclusions: { 2: ['nuts', 'peanuts'] },
  weeknightMinutes: 25,
  plannedSlots: ['dinner'],
  lean: 'more-fish',
};

check('valid answers pass validation', validateAnswers(answers).ok);
check(
  'an empty household is rejected',
  !validateAnswers({ ...answers, people: [{ name: '  ', ageBand: 'adult' }] }).ok,
);
check(
  'duplicate names are caught',
  !validateAnswers({
    ...answers,
    people: [
      { name: 'Sam', ageBand: 'adult' },
      { name: 'sam', ageBand: 'adult' },
    ],
  }).ok,
);
check(
  'planning no meals at all is rejected',
  !validateAnswers({ ...answers, plannedSlots: [] }).ok,
);

const built = buildHousehold(answers);
check('household is built from answers', built.people.length === 3);
check('person ids are unique', new Set(built.people.map((p) => p.id)).size === 3);
check(
  'exclusions land on the right person',
  built.people[2].dietary.avoidAllergens.includes('nuts') &&
    built.people[0].dietary.avoidAllergens.length === 0,
);
check(
  'portion factors are derived from age',
  built.people[2].portionFactor < built.people[0].portionFactor,
);
check(
  'weeknight budgets are tighter than weekend ones',
  built.timeBudgets.find((b) => b.day === 1)!.maxActiveMinutes <
    built.timeBudgets.find((b) => b.day === 5)!.maxActiveMinutes,
);
check(
  'unplanned slots get no budget',
  !built.timeBudgets.some((b) => b.slot === 'breakfast'),
);
check(
  '"no limit" means no budget rows at all',
  buildHousehold({ ...answers, weeknightMinutes: 0 }).timeBudgets.length === 0,
);

// The real test: does a brand-new household actually get a workable week?
const freshCtx = { household: built, history: [] };
check('a freshly onboarded household is feasible', checkFeasibility(freshCtx).ok);
const freshPlan = generatePlan(freshCtx, '2026-08-03', { seed: 11 });
check('and produces a full week', freshPlan.unfilled.length === 0);
check(
  'with no rule violations',
  freshPlan.evaluation.violations.length === 0,
  freshPlan.evaluation.violations.map((v) => v.message).join(' | '),
);
check(
  'and no nuts anywhere near the child',
  !freshPlan.plan.meals.some(
    (m) =>
      m.attendeeIds.includes(built.people[2].id) &&
      getRecipe(m.recipeId).ingredients.some((ri) =>
        getIngredient(ri.ingredientId).allergens.some((a) =>
          ['nuts', 'peanuts'].includes(a),
        ),
      ),
  ),
);

// A lean should bend the plan, not bind it.
const fishWeights = weightsForLean('more-fish', DEFAULT_WEIGHTS);
check(
  'a lean raises the relevant weight',
  fishWeights['fish-frequency'] > DEFAULT_WEIGHTS['fish-frequency'],
);
check(
  'a lean leaves other weights alone',
  fishWeights['protein-every-meal'] === DEFAULT_WEIGHTS['protein-every-meal'],
);

// Single-person households are a real case and easy to break.
const solo = buildHousehold({
  ...answers,
  people: [{ name: 'Jo', ageBand: 'adult' }],
  exclusions: {},
});
const soloPlan = generatePlan({ household: solo, history: [] }, '2026-08-03', { seed: 5 });
check('a one-person household plans fine', soloPlan.unfilled.length === 0);
check(
  'and portions never drop below one',
  soloPlan.plan.meals.every((m) => m.portions >= 1),
);


// ---------------------------------------------------------------------------
section('Reconciling a plan when attendance changes');

const basePlan = generatePlan(ctx, '2026-08-03', { seed: 42 });

// Nothing changed: reconcile must be a no-op, not a quiet rewrite.
const noChange = reconcilePlan(basePlan.plan, ctx);
check(
  'reconciling an unchanged week changes nothing',
  noChange.reportioned.length === 0 &&
    noChange.broken.length === 0 &&
    JSON.stringify(noChange.plan.meals) === JSON.stringify(basePlan.plan.meals),
);

// Someone drops out of Wednesday dinner: portions must fall.
const oneAway = {
  ...SEED_HOUSEHOLD,
  absences: [
    ...SEED_HOUSEHOLD.absences,
    { personId: 'p-jack', day: 2 as DayIndex, slot: 'dinner' as const },
  ],
};
const awayResult = reconcilePlan(basePlan.plan, { ...ctx, household: oneAway });
const wed = awayResult.plan.meals.find((m) => m.day === 2 && m.slot === 'dinner')!;
const wedBefore = basePlan.plan.meals.find((m) => m.day === 2 && m.slot === 'dinner')!;
check('portions drop when someone is out', wed.portions < wedBefore.portions);
check('the attendee list is updated', !wed.attendeeIds.includes('p-jack'));
check(
  'the change is reported rather than silent',
  awayResult.reportioned.some((r) => r.day === 2 && r.slot === 'dinner'),
);
check('the dish itself is untouched', wed.recipeId === wedBefore.recipeId);

// Everyone drops out: the meal should disappear entirely.
const allAway = {
  ...SEED_HOUSEHOLD,
  absences: [
    ...SEED_HOUSEHOLD.absences,
    ...SEED_HOUSEHOLD.people.map((p) => ({
      personId: p.id,
      day: 2 as DayIndex,
      slot: 'dinner' as const,
    })),
  ],
};
const emptyResult = reconcilePlan(basePlan.plan, { ...ctx, household: allAway });
check(
  'a meal nobody is eating is removed',
  !emptyResult.plan.meals.some((m) => m.day === 2 && m.slot === 'dinner'),
);
check('and the removal is reported', emptyResult.emptied.length > 0);

// Both adults drop out of a dinner: the kids-alone rule should now bite.
//
// The dish is planted rather than taken from the generated plan. Relying on
// whatever the solver happened to pick made this test depend on the size of the
// recipe book — it broke the moment more kid-friendly dinners were added, which
// is a property of the fixture, not of the behaviour being tested.
const awkwardDish = RECIPES.find(
  (r) =>
    r.slots.includes('dinner') &&
    !r.tags.includes('kid-easy') &&
    !r.tags.includes('make-ahead') &&
    r.activeMinutes <= 25,
)!;
const plantedPlan = {
  ...basePlan.plan,
  meals: [
    {
      day: 0 as DayIndex,
      slot: 'dinner' as const,
      recipeId: awkwardDish.id,
      portions: 4,
      attendeeIds: SEED_HOUSEHOLD.people.map((p) => p.id),
    },
    ...basePlan.plan.meals.filter((m) => !(m.day === 0 && m.slot === 'dinner')),
  ],
};
const monday = plantedPlan.meals.find((m) => m.day === 0 && m.slot === 'dinner')!;
const adultsOut = {
  ...SEED_HOUSEHOLD,
  absences: [
    ...SEED_HOUSEHOLD.absences,
    { personId: 'p-ed', day: 0 as DayIndex, slot: 'dinner' as const },
    { personId: 'p-louise', day: 0 as DayIndex, slot: 'dinner' as const },
  ],
};
const adultsOutCtx = { ...ctx, household: adultsOut };
const brokenResult = reconcilePlan(plantedPlan, adultsOutCtx);
const mondayBreakage = brokenResult.broken.find((v) => v.day === 0 && v.slot === 'dinner');
check(
  'a meal made illegal by the change is flagged',
  !!mondayBreakage,
  brokenResult.broken.map((b) => b.ruleId).join(','),
);
check(
  'a broken meal is reported, not silently swapped',
  brokenResult.plan.meals.find((m) => m.day === 0 && m.slot === 'dinner')!.recipeId ===
    monday.recipeId,
);

// Repair fixes only what broke.
const repaired = repairPlan(brokenResult.plan, adultsOutCtx, brokenResult.broken);
check('repair changes the broken meal', repaired.changes.length > 0);
check(
  'repair leaves every other meal alone',
  brokenResult.plan.meals
    .filter((m) => !(m.day === 0 && m.slot === 'dinner'))
    .every((m) =>
      repaired.plan.meals.some(
        (n) => n.day === m.day && n.slot === m.slot && n.recipeId === m.recipeId,
      ),
    ),
);
check(
  'the repaired plan is legal',
  reconcilePlan(repaired.plan, adultsOutCtx).broken.length === 0,
);
check(
  'the swap is explained',
  repaired.changes.every((c) => c.from.length > 0 && c.to.length > 0 && c.from !== c.to),
);


// ---------------------------------------------------------------------------
section('Whose preference is it?');

const everyone = SEED_HOUSEHOLD.people.map((p) => p.id);
const withoutJack = everyone.filter((id) => id !== 'p-jack');

// Three mushroom dishes swapped out, Jack present every time, others sometimes
// absent. That contrast is what makes attribution possible.
const TEST_INGREDIENT = 'broccoli';
const mushroomDishes = RECIPES.filter((r) =>
  r.ingredients.some((ri) => ri.ingredientId === TEST_INGREDIENT),
).slice(0, 3);
check('enough test dishes exist', mushroomDishes.length === 3);

const attributable = proposeRules(
  mushroomDishes.map((r, i) => ({
    type: 'rejected' as const,
    recipeId: r.id,
    at: iso(i * 5 + 2),
    // Jack at every one; Katie and Louise each miss one.
    attendeeIds: i === 0 ? ['p-ed', 'p-jack'] : i === 1 ? ['p-louise', 'p-jack'] : ['p-katie', 'p-jack'],
  })),
  { ...SEED_HOUSEHOLD, people: SEED_HOUSEHOLD.people.map((p) => ({ ...p, dietary: { ...p.dietary, dislikedIngredients: [] } })) },
  today,
);
const mushroomProposal = attributable.find(
  (p) => p.kind === 'avoid-ingredient' && p.subject === TEST_INGREDIENT,
);
check('an ingredient pattern is attributed to one person', mushroomProposal?.personId === 'p-jack', mushroomProposal?.personId);
check(
  'and the suggestion names them',
  !!mushroomProposal?.suggestion.includes('Jack'),
  mushroomProposal?.suggestion,
);
check(
  'the evidence explains the attribution',
  !!mushroomProposal?.evidence.includes('at the table'),
);

// Everyone always eats together: attribution is impossible and must not be faked.
const noContrast = proposeRules(
  mushroomDishes.map((r, i) => ({
    type: 'rejected' as const,
    recipeId: r.id,
    at: iso(i * 5 + 2),
    attendeeIds: everyone,
  })),
  SEED_HOUSEHOLD,
  today,
);
const householdWide = noContrast.find(
  (p) => p.kind === 'avoid-ingredient' && p.subject === TEST_INGREDIENT,
);
check('with no contrast, no person is blamed', householdWide?.personId === undefined);
check(
  'and the wording stays household-wide',
  !!householdWide && !householdWide.suggestion.includes("'s plate"),
);

// Missing attendance data must not produce a confident guess.
const noAttendance = proposeRules(
  mushroomDishes.map((r, i) => ({
    type: 'rejected' as const,
    recipeId: r.id,
    at: iso(i * 5 + 2),
  })),
  SEED_HOUSEHOLD,
  today,
);
check(
  'no attendance recorded means no attribution',
  noAttendance.find((p) => p.subject === TEST_INGREDIENT)?.personId === undefined,
);

// Liking the thing overrides being present when it was swapped.
const likedItAnyway = proposeRules(
  [
    ...mushroomDishes.map((r, i) => ({
      type: 'rejected' as const,
      recipeId: r.id,
      at: iso(i * 5 + 2),
      attendeeIds: i === 0 ? ['p-ed', 'p-jack'] : i === 1 ? ['p-louise', 'p-jack'] : ['p-katie', 'p-jack'],
    })),
    { type: 'liked' as const, recipeId: mushroomDishes[0].id, at: iso(1), attendeeIds: ['p-jack'] },
  ],
  SEED_HOUSEHOLD,
  today,
);
check(
  'a recorded "liked" blocks attribution to that person',
  likedItAnyway.find((p) => p.kind === 'avoid-ingredient' && p.subject === TEST_INGREDIENT)
    ?.personId === undefined,
);

// Applying an attributed proposal must touch exactly one person.
const attributedHousehold = applyProposal(SEED_HOUSEHOLD, {
  ...mushroomProposal!,
  personId: 'p-jack',
  personName: 'Jack',
});
check(
  'an attributed rule lands on that person only',
  attributedHousehold.people.find((p) => p.id === 'p-jack')!.dietary
    .dislikedIngredients.includes(TEST_INGREDIENT) &&
    attributedHousehold.people
      .filter((p) => p.id !== 'p-jack')
      .every((p) => !p.dietary.dislikedIngredients.includes(TEST_INGREDIENT)),
);

const unattributedHousehold = applyProposal(SEED_HOUSEHOLD, {
  ...householdWide!,
  personId: undefined,
  personName: undefined,
});
check(
  'an unattributed rule applies to everyone',
  unattributedHousehold.people.every((p) =>
    p.dietary.dislikedIngredients.includes(TEST_INGREDIENT),
  ),
);

/**
 * The payoff, and the whole reason attribution is worth the complexity.
 *
 * A dislike is a soft rule, so it never bans a dish — it costs score. An
 * *attributed* dislike should only cost that score on meals the person is
 * actually at. The same dish on a day they're out should be free.
 */
const testDish = mushroomDishes.find((r) => r.slots.includes('dinner'))!;
const attributedCtx = { household: attributedHousehold, history: [] };
const scoreOfDislikes = (attendeeIds: string[]) => {
  const household = {
    ...attributedHousehold,
    absences: attributedHousehold.people
      .filter((p) => !attendeeIds.includes(p.id))
      .map((p) => ({ personId: p.id, day: 0 as DayIndex, slot: 'dinner' as const })),
  };
  return evaluateSoftRules(
    [
      {
        day: 0 as DayIndex,
        slot: 'dinner' as const,
        recipeId: testDish.id,
        portions: 4,
        attendeeIds,
      },
    ],
    { household, history: [] },
  ).find((r) => r.ruleId === 'respect-dislikes')!.score;
};

check(
  'the dish costs score when that person is eating',
  scoreOfDislikes(everyone) < 1,
);
check(
  'but is free on a day they are out',
  scoreOfDislikes(withoutJack) === 1,
);
// Adding the dislike must not change hard filtering at all — a preference is
// not an exclusion, and conflating the two is how a planner ends up with
// nothing left to cook.
check(
  'a dislike never changes what is hard-allowed',
  RECIPES.every(
    (r) =>
      isAllowed(r, 0, 'dinner', attributedCtx) ===
      isAllowed(r, 0, 'dinner', { household: SEED_HOUSEHOLD, history: [] }),
  ),
);


// ---------------------------------------------------------------------------
section('User recipes');

const goodDraft = {
  name: 'Test tomato pasta',
  slots: ['dinner'] as const as never,
  cuisine: 'italian' as const,
  proteins: ['dairy-protein'] as const as never,
  tags: ['pasta'] as const as never,
  servings: 4,
  activeMinutes: 15,
  totalMinutes: 25,
  ingredients: [
    { ingredientId: 'pasta-penne', amount: 400, unit: 'g' as const },
    { ingredientId: 'passata', amount: 500, unit: 'g' as const },
    { ingredientId: 'parmesan', amount: 50, unit: 'g' as const },
  ],
  method: ['Cook the pasta.', 'Warm the sauce.', 'Combine.'],
};

check('a well-formed recipe validates', validateRecipe(goodDraft).ok);

check(
  'a nameless recipe is rejected',
  !validateRecipe({ ...goodDraft, name: '  ' }).ok,
);
check(
  'a recipe with no slots is rejected',
  !validateRecipe({ ...goodDraft, slots: [] as never }).ok,
);
check(
  'hands-on longer than total time is rejected',
  !validateRecipe({ ...goodDraft, activeMinutes: 40, totalMinutes: 25 }).ok,
);
check(
  'an unknown ingredient is rejected',
  !validateRecipe({
    ...goodDraft,
    ingredients: [{ ingredientId: 'unicorn-steak', amount: 1, unit: 'unit' as const }],
  }).ok,
);
check(
  'a zero amount is rejected',
  !validateRecipe({
    ...goodDraft,
    ingredients: [{ ingredientId: 'passata', amount: 0, unit: 'g' as const }],
  }).ok,
);

// The check that caught 16 defects in the built-in book, now applied at save time.
check(
  'an unreconcilable unit is rejected',
  !validateRecipe({
    ...goodDraft,
    ingredients: [{ ingredientId: 'passata', amount: 2, unit: 'unit' as const }],
  }).ok,
);
check(
  'and the message says what to use instead',
  validateRecipe({
    ...goodDraft,
    ingredients: [{ ingredientId: 'passata', amount: 2, unit: 'unit' as const }],
  }).problems.some((p) => p.message.includes('g')),
);

// Warnings inform without blocking.
const noProtein = validateRecipe({ ...goodDraft, proteins: [] as never });
check('missing protein is a warning, not an error', noProtein.ok);
check(
  'and it explains the consequence',
  noProtein.problems.some((p) => p.severity === 'warning' && p.field === 'proteins'),
);

// A finalised recipe must be usable by the whole engine, not just storable.
const finalised = finaliseRecipe(goodDraft);
check('finalising produces a stable id', finalised.id.startsWith('my-'));
setUserRecipes([finalised]);
check('the registry serves it', getRecipe(finalised.id).name === 'Test tomato pasta');
check('and it appears in the full book', allRecipes().some((r) => r.id === finalised.id));
check(
  'duplicate names get distinct ids',
  finaliseRecipe(goodDraft).id !== finalised.id,
);

// The real test: can the planner and the shopping list actually use it?
const userPlan = generatePlan(ctx, '2026-08-03', { seed: 42 });
check('planning still works with a user recipe loaded', userPlan.unfilled.length === 0);
const forced = {
  ...userPlan.plan,
  meals: [
    {
      day: 0 as DayIndex,
      slot: 'dinner' as const,
      recipeId: finalised.id,
      portions: 4,
      attendeeIds: ['p-ed'],
    },
  ],
};
const userList = buildShoppingList(forced);
check(
  'a user recipe produces shopping lines',
  allLines(userList).length === 3,
  `${allLines(userList).length}`,
);
check(
  'with quantities scaled from its own servings',
  allLines(userList).find((l) => l.ingredientId === 'pasta-penne')!.needed.amount === 400,
);

// A user recipe may shadow a built-in of the same id.
const override = finaliseRecipe({ ...goodDraft, id: 'spag-bol', name: 'Our bolognese' });
setUserRecipes([finalised, override]);
check('a user recipe can override a built-in', getRecipe('spag-bol').name === 'Our bolognese');
check('and the book does not grow when overriding', !allRecipes().filter((r) => r.id === 'spag-bol')[1]);

setUserRecipes([]);
check('clearing user recipes restores the built-in', getRecipe('spag-bol').name === 'Spaghetti bolognese');


// ---------------------------------------------------------------------------
section('Reading the recipe');

const readPlan = generatePlan(ctx, '2026-08-03', { seed: 42 });
const anyDinner = readPlan.plan.meals.find((m) => m.slot === 'dinner')!;
const scaledDinner = scaleRecipeForMeal(anyDinner, ctx);

check('every ingredient gets a display amount', scaledDinner.ingredients.every((i) => i.display.length > 0));
check('the method comes through', scaledDinner.method.length > 0);
check('it names who is eating', scaledDinner.eating.length > 0);
check('a full-size cook is not marked as scaled', scaledDinner.portions === anyDinner.portions);

// Scaling down must actually change the numbers on the page.
const halfMeal = { ...anyDinner, portions: getRecipe(anyDinner.recipeId).servings / 2 };
const halved = scaleRecipeForMeal(halfMeal, ctx);
check('halving the portions halves the scale', Math.abs(halved.scale - 0.5) < 0.01);
check('and marks the recipe as scaled', halved.scaled);

const firstScalable = getRecipe(anyDinner.recipeId).ingredients.find((i) => !i.fixed)!;
const fullAmount = scaledDinner.ingredients.find((i) => i.ingredientId === firstScalable.ingredientId)!;
const halfAmount = halved.ingredients.find((i) => i.ingredientId === firstScalable.ingredientId)!;
check(
  'a scalable ingredient shrinks',
  numeric(halfAmount.display) < numeric(fullAmount.display),
  `${halfAmount.display} vs ${fullAmount.display}`,
);

// Fixed items must not scale — oil for the pan doesn't double for two more people.
const withFixed = RECIPES.find((r) => r.ingredients.some((i) => i.fixed))!;
const fixedFull = scaleRecipeForMeal(
  { day: 0 as DayIndex, slot: 'dinner', recipeId: withFixed.id, portions: withFixed.servings, attendeeIds: [] },
  ctx,
);
const fixedDouble = scaleRecipeForMeal(
  { day: 0 as DayIndex, slot: 'dinner', recipeId: withFixed.id, portions: withFixed.servings * 2, attendeeIds: [] },
  ctx,
);
const fixedId = withFixed.ingredients.find((i) => i.fixed)!.ingredientId;
check(
  'fixed ingredients do not scale',
  fixedFull.ingredients.find((i) => i.ingredientId === fixedId)!.display ===
    fixedDouble.ingredients.find((i) => i.ingredientId === fixedId)!.display,
);
check(
  'but scalable ones in the same recipe do',
  fixedFull.ingredients.filter((i) => !i.fixed).some(
    (i) => i.display !== fixedDouble.ingredients.find((x) => x.ingredientId === i.ingredientId)!.display,
  ),
);

// Countables round to something a cook can act on.
const countable = scaleRecipeForMeal(
  { day: 0 as DayIndex, slot: 'dinner', recipeId: 'spag-bol', portions: 2, attendeeIds: [] },
  ctx,
);
const onion = countable.ingredients.find((i) => i.ingredientId === 'onion')!;
check(
  'a countable never rounds down to zero',
  numeric(onion.display) >= 0.5,
  onion.display,
);
check(
  'and lands on a half or a whole',
  (numeric(onion.display) * 2) % 1 === 0,
  onion.display,
);

// Allergen warnings follow the people at that meal, and stay advisory.
const glutenDish = RECIPES.find(
  (r) =>
    r.slots.includes('dinner') &&
    r.ingredients.some((ri) => getIngredient(ri.ingredientId).allergens.includes('gluten')),
)!;
const withKatie = scaleRecipeForMeal(
  {
    day: 0 as DayIndex,
    slot: 'dinner',
    recipeId: glutenDish.id,
    portions: 4,
    attendeeIds: SEED_HOUSEHOLD.people.map((p) => p.id),
  },
  ctx,
);
check('an allergen clash is surfaced when reading', withKatie.warnings.length > 0);
check(
  'and the wording stays advisory',
  withKatie.warnings.every((w) => w.includes('Check the pack') && !w.includes('safe')),
);

// A planned-over is a reheat, not a cook.
const carried = scaleRecipeForMeal({ ...anyDinner, source: 'planned-over' as const }, ctx);
check('a planned-over is marked reheat-only', carried.reheatOnly);
check(
  'and its timing reflects reheating, not the original cook',
  timingFor(carried).activeMinutes < timingFor(scaledDinner).activeMinutes ||
    getRecipe(anyDinner.recipeId).activeMinutes <= 5,
);

function numeric(display: string): number {
  return parseFloat(display.replace(/[^0-9.]/g, '')) || 0;
}


// ---------------------------------------------------------------------------
section('Pantry');

const pantryPlan = generatePlan(ctx, '2026-08-03', { seed: 42 });
const pantryList = buildShoppingList(pantryPlan.plan);
const firstLine = allLines(pantryList)[0];

// No pantry: the list must pass through untouched.
const untouched = applyPantry(pantryList, { ...EMPTY_PANTRY, weekStartISO: '2026-08-03' });
check(
  'an empty pantry changes nothing',
  countAdjusted(untouched) === allLines(pantryList).length &&
    untouched.skipped.length === 0,
);

// "Always stocked" removes an item permanently.
const stockedPantry = toggleAlwaysStocked(
  { ...EMPTY_PANTRY, weekStartISO: '2026-08-03' },
  firstLine.ingredientId,
);
const withStocked = applyPantry(pantryList, stockedPantry);
check(
  'an always-stocked item leaves the list',
  !countLines(withStocked).some((l) => l.ingredientId === firstLine.ingredientId),
);
check(
  'but the removal is visible, not silent',
  withStocked.skipped.some((l) => l.ingredientId === firstLine.ingredientId),
);
check(
  'and it says why',
  coverageNote(withStocked.skipped.find((l) => l.ingredientId === firstLine.ingredientId)!) ===
    'Always in the cupboard',
);

// "Got it, enough of it" for one week only.
const haveEnough = toggleHave(
  { ...EMPTY_PANTRY, weekStartISO: '2026-08-03' },
  firstLine.ingredientId,
);
const withEnough = applyPantry(pantryList, haveEnough);
check(
  'ticking an item off removes it for the week',
  withEnough.skipped.some((l) => l.reason === 'have-enough'),
);

// Partial amounts reduce rather than remove — the interesting case.
const weighed = allLines(pantryList).find((l) => l.needed.unit === 'g' && l.needed.amount > 200)!;
const partial: typeof EMPTY_PANTRY = {
  alwaysStocked: [],
  haveThisWeek: [
    {
      ingredientId: weighed.ingredientId,
      amount: { amount: Math.floor(weighed.needed.amount / 2), unit: 'g' },
    },
  ],
  weekStartISO: '2026-08-03',
};
const withPartial = applyPantry(pantryList, partial);
const reducedLine = withPartial.reduced.find((l) => l.ingredientId === weighed.ingredientId)!;
check('having some of something reduces the line', !!reducedLine);
check(
  'the remaining need is smaller than the original',
  reducedLine.needed.amount < weighed.needed.amount,
);
check(
  'and the amount to buy is recalculated, not just relabelled',
  reducedLine.buy.amount <= weighed.buy.amount,
);
check(
  'the note explains what is already in',
  (coverageNote(reducedLine) ?? '').includes('already in'),
);

// Having more than enough removes the line entirely.
const surplus = applyPantry(pantryList, {
  alwaysStocked: [],
  haveThisWeek: [
    { ingredientId: weighed.ingredientId, amount: { amount: weighed.needed.amount * 3, unit: 'g' } },
  ],
  weekStartISO: '2026-08-03',
});
check(
  'having plenty removes the line',
  surplus.skipped.some((l) => l.ingredientId === weighed.ingredientId),
);

/**
 * The rot-prevention test. This-week ticks must not survive into a new week —
 * carrying them forward is what makes every inventory feature go stale and
 * start removing things people actually need.
 */
const lastWeek = {
  alwaysStocked: ['olive-oil'],
  haveThisWeek: [{ ingredientId: 'passata' }],
  weekStartISO: '2026-07-27',
};
const rolled = pantryForWeek(lastWeek, '2026-08-03');
check('a new week wipes the weekly ticks', rolled.haveThisWeek.length === 0);
check('but keeps the always-stocked list', rolled.alwaysStocked.includes('olive-oil'));
check(
  'and rolling within the same week is a no-op',
  pantryForWeek(rolled, '2026-08-03') === rolled,
);

// Unconvertible units must keep the line rather than guess at coverage.
const countedLine = allLines(pantryList).find((l) => l.needed.unit === 'unit');
if (countedLine) {
  const mismatched = applyPantry(pantryList, {
    alwaysStocked: [],
    haveThisWeek: [
      { ingredientId: countedLine.ingredientId, amount: { amount: 500, unit: 'ml' } },
    ],
    weekStartISO: '2026-08-03',
  });
  check(
    'an unconvertible amount leaves the line alone',
    countLines(mismatched).some((l) => l.ingredientId === countedLine.ingredientId),
  );
}

check(
  'the summary reports what changed',
  pantrySummary(withStocked).includes('already have'),
  pantrySummary(withStocked),
);

function countLines(a: ReturnType<typeof applyPantry>) {
  return aisleOrder().flatMap((x) => a.linesByAisle[x]);
}
function countAdjusted(a: ReturnType<typeof applyPantry>) {
  return countLines(a).length;
}


// ---------------------------------------------------------------------------
section('Per-person view');

const profilePlan = generatePlan(ctx, '2026-08-03', { seed: 42 });
const katie = buildPersonProfile('p-katie', profilePlan.plan, ctx);
const ed = buildPersonProfile('p-ed', profilePlan.plan, ctx);

check('a profile is built for each person', katie.person.name === 'Katie');
check('meals they attend are listed', katie.meals.length > 0);
check(
  'and every one of them actually includes them',
  katie.meals.every((m) =>
    profilePlan.plan.meals.find((x) => x.day === m.day && x.slot === m.slot)!
      .attendeeIds.includes('p-katie'),
  ),
);

// The children are out at weekday lunches in the seed data.
check('meals they miss are counted', katie.missed.length > 0);
check(
  'attended and missed together account for the whole plan',
  katie.meals.length + katie.missed.length === profilePlan.plan.meals.length,
);
check(
  'different people see different weeks',
  ed.meals.length !== katie.meals.length,
  `${ed.meals.length} vs ${katie.meals.length}`,
);

// Rules, with this week's status rather than just their text.
check('their exclusions appear as rules', katie.rules.some((r) => r.label === 'No gluten'));
check(
  'and a satisfied rule is marked met',
  katie.rules.find((r) => r.label === 'No gluten')!.met,
);
check('no advisory flags on a legal plan', katie.flags.length === 0);

// Jack's standing request should show up on his profile with a live count.
const jack = buildPersonProfile('p-jack', profilePlan.plan, ctx);
const request = jack.rules.find((r) => r.label.includes('red meat'));
check('a standing request appears on their profile', !!request, jack.rules.map(r=>r.label).join(' | '));
check('and reports how the week is doing against it', !!request?.detail.includes('this week'));

// A broken rule must read as broken.
const glutenDish2 = RECIPES.find(
  (r) =>
    r.slots.includes('dinner') &&
    r.ingredients.some((ri) => getIngredient(ri.ingredientId).allergens.includes('gluten')),
)!;
const breachPlan = {
  ...profilePlan.plan,
  meals: [
    {
      day: 0 as DayIndex,
      slot: 'dinner' as const,
      recipeId: glutenDish2.id,
      portions: 4,
      attendeeIds: SEED_HOUSEHOLD.people.map((p) => p.id),
    },
  ],
};
const breached = buildPersonProfile('p-katie', breachPlan, ctx);
check('a broken rule is marked unmet', !breached.rules.find((r) => r.label === 'No gluten')!.met);
check('and the meal is flagged', breached.flags.length > 0);
check(
  'with advisory wording',
  breached.flags.every((f) => f.message.includes('check the pack')),
);

// Repetition is the thing the week view hides.
const repetitive = {
  ...profilePlan.plan,
  meals: [0, 1, 2, 3].map((day) => ({
    day: day as DayIndex,
    slot: 'dinner' as const,
    recipeId: 'jacket-potato-beans',
    portions: 4,
    attendeeIds: ['p-ed'],
  })),
};
const bored = buildPersonProfile('p-ed', repetitive, ctx);
check('repetition is detected', bored.distinctDishes === 1);
check(
  'and called out in the headline',
  bored.headline.includes('only 1 different'),
  bored.headline,
);
check(
  'a varied week is not called repetitive',
  !ed.headline.includes('only'),
  ed.headline,
);

// Protein and cuisine mix, sorted by frequency.
check('protein mix is summarised', ed.proteinMix.length > 0);
check(
  'and sorted commonest first',
  ed.proteinMix.every((p, i) => i === 0 || ed.proteinMix[i - 1].count >= p.count),
);
check('"none" is excluded from the protein mix', !ed.proteinMix.some((p) => p.protein === 'none'));

// Attributed suggestions surface on the right person, and only them.
const jackFeedback = RECIPES.filter((r) =>
  r.ingredients.some((ri) => ri.ingredientId === 'broccoli'),
)
  .slice(0, 3)
  .map((r, i) => ({
    type: 'rejected' as const,
    recipeId: r.id,
    at: iso(i * 5 + 2),
    attendeeIds: i === 0 ? ['p-ed', 'p-jack'] : i === 1 ? ['p-louise', 'p-jack'] : ['p-katie', 'p-jack'],
  }));
const jackWithFeedback = buildPersonProfile('p-jack', profilePlan.plan, ctx, jackFeedback);
const edWithFeedback = buildPersonProfile('p-ed', profilePlan.plan, ctx, jackFeedback);
check(
  'a suggestion attributed to them shows on their profile',
  jackWithFeedback.attributedSuggestions.length > 0,
);
check(
  'and not on anyone else\u2019s',
  edWithFeedback.attributedSuggestions.length === 0,
);

// Someone away all week shouldn't produce a nonsense profile.
const awayHousehold = {
  ...SEED_HOUSEHOLD,
  absences: SEED_HOUSEHOLD.plannedSlots.flatMap((slot) =>
    [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      personId: 'p-ed',
      day: day as DayIndex,
      slot,
    })),
  ),
};
const awayPlan = generatePlan({ ...ctx, household: awayHousehold }, '2026-08-03', { seed: 42 });
const absent = buildPersonProfile('p-ed', awayPlan.plan, { ...ctx, household: awayHousehold });
check('someone away all week gets a sensible headline', absent.headline.includes("isn't eating at home"));
check('and no phantom meals', absent.meals.length === 0);


// ---------------------------------------------------------------------------
section('Eating goals');

check(
  'a two-protein dish is protein-forward',
  proteinWeightOf(getRecipe('cod-chorizo-beans')) === 'protein-forward',
);
check(
  'a pasta dish carried by cheese is not',
  proteinWeightOf(getRecipe('penne-arrabbiata')) === 'light',
  proteinWeightOf(getRecipe('penne-arrabbiata')),
);

// Goals adjust the plate, not a calorie budget.
const adultGoal = { ...SEED_HOUSEHOLD.people[0], goal: 'more-protein' as const };
check('a protein goal raises the portion factor', portionFactorFor(adultGoal) > SEED_HOUSEHOLD.people[0].portionFactor);
const lighterGoal = { ...SEED_HOUSEHOLD.people[0], goal: 'lighter' as const };
check('a lighter goal lowers it', portionFactorFor(lighterGoal) < SEED_HOUSEHOLD.people[0].portionFactor);
check(
  'but only modestly — a goal shifts a plate, it does not restrict it',
  portionFactorFor(lighterGoal) > SEED_HOUSEHOLD.people[0].portionFactor * 0.8,
);

/**
 * The safeguard that matters most here. A child must never carry an eating
 * goal, whatever gets written into the data.
 */
const childWithGoal = {
  ...SEED_HOUSEHOLD.people.find((p) => p.ageBand === 'child')!,
  goal: 'lighter' as const,
};
check('a goal cannot be offered to a child', !canSetGoal(childWithGoal));
check(
  'and a goal set on a child has no effect on their portion',
  portionFactorFor(childWithGoal) === childWithGoal.portionFactor,
);

// The planner should respond to a goal without being taken over by it.
const proteinHousehold = {
  ...SEED_HOUSEHOLD,
  people: SEED_HOUSEHOLD.people.map((p) =>
    p.id === 'p-ed' ? { ...p, goal: 'more-protein' as const } : p,
  ),
};
const proteinCtx = { household: proteinHousehold, history: [] };
const proteinPlan = generatePlan(proteinCtx, '2026-08-03', { seed: 42 });
const edMeals = proteinPlan.plan.meals.filter((m) => m.attendeeIds.includes('p-ed'));
const forward = edMeals.filter((m) => isProteinForward(m.recipeId)).length;
check(
  'a protein goal shifts the week towards protein-forward meals',
  forward / edMeals.length >= 0.4,
  `${forward}/${edMeals.length}`,
);
check('and the plan is still legal', proteinPlan.evaluation.violations.length === 0);
check('and still fills the week', proteinPlan.unfilled.length === 0);

// ---------------------------------------------------------------------------
section('Who likes what');

const at = new Date().toISOString();
const verdictEvents = [
  { type: 'liked' as const, recipeId: 'spag-bol', at, personId: 'p-jack' },
  { type: 'liked' as const, recipeId: 'spag-bol', at, personId: 'p-katie' },
  { type: 'liked' as const, recipeId: 'spag-bol', at, personId: 'p-ed' },
  { type: 'liked' as const, recipeId: 'spag-bol', at, personId: 'p-louise' },
  { type: 'disliked' as const, recipeId: 'chana-dhal', at, personId: 'p-katie' },
  { type: 'liked' as const, recipeId: 'chana-dhal', at, personId: 'p-ed' },
];
const verdicts = dishVerdicts(verdictEvents, SEED_HOUSEHOLD);

const bol = verdicts.find((v) => v.recipeId === 'spag-bol')!;
check('a dish everyone rated positively is universal', bol.universal);
check('and lists who said so', bol.likedBy.length === 4);

const dhal = verdicts.find((v) => v.recipeId === 'chana-dhal')!;
check('a split verdict is not universal', !dhal.universal);
check('and records both sides', dhal.likedBy.includes('p-ed') && dhal.dislikedBy.includes('p-katie'));

// Silence is not approval — this is the trap in "everyone loves it".
const oneVoice = dishVerdicts(
  [{ type: 'liked' as const, recipeId: 'spag-bol', at, personId: 'p-ed' }],
  SEED_HOUSEHOLD,
);
check(
  'one person liking it is not "everyone loves it"',
  !oneVoice.find((v) => v.recipeId === 'spag-bol')!.universal,
);

// People change their minds; the latest verdict should win.
const changedMind = dishVerdicts(
  [
    { type: 'disliked' as const, recipeId: 'spag-bol', at, personId: 'p-jack' },
    { type: 'liked' as const, recipeId: 'spag-bol', at, personId: 'p-jack' },
  ],
  SEED_HOUSEHOLD,
);
const flipped = changedMind.find((v) => v.recipeId === 'spag-bol')!;
check('a later verdict replaces an earlier one', flipped.likedBy.includes('p-jack'));
check('and does not leave the old one behind', !flipped.dislikedBy.includes('p-jack'));

check(
  'favourites are listed per person',
  favouritesFor(verdictEvents, 'p-ed').includes('chana-dhal') &&
    !favouritesFor(verdictEvents, 'p-katie').includes('chana-dhal'),
);
check(
  'inferred attendance is never treated as a stated verdict',
  dishVerdicts(
    [{ type: 'liked' as const, recipeId: 'spag-bol', at, attendeeIds: ['p-ed', 'p-jack'] }],
    SEED_HOUSEHOLD,
  ).length === 0,
);

// A stated dislike beats the attendance-based guess.
const statedDislike = proposeRules(
  RECIPES.filter((r) => r.ingredients.some((ri) => ri.ingredientId === 'broccoli'))
    .slice(0, 3)
    .map((r, i) => ({
      type: 'rejected' as const,
      recipeId: r.id,
      at: iso(i * 4 + 2),
      personId: 'p-katie',
      attendeeIds: ['p-ed', 'p-jack', 'p-katie'],
    })),
  SEED_HOUSEHOLD,
  today,
);
check(
  'an explicit verdict attributes to that person, not the inferred one',
  statedDislike.find((p) => p.subject === 'broccoli')?.personId === 'p-katie',
  statedDislike.find((p) => p.subject === 'broccoli')?.personId,
);

// Favourites feed the planner.
//
// The favourites have to be dishes this household can actually eat — the seed
// household includes a coeliac diner, so a gluten-containing favourite is
// correctly never served and the rule has nothing to work with. That is right
// behaviour, but it makes for a useless fixture.
const servableFavourites = RECIPES.filter(
  (r) =>
    r.slots.includes('dinner') &&
    r.activeMinutes <= 20 &&
    !r.ingredients.some((ri) => getIngredient(ri.ingredientId).allergens.includes('gluten')),
).slice(0, 3);
check('the fixture has servable favourites', servableFavourites.length === 3);
const favHousehold = {
  ...SEED_HOUSEHOLD,
  favouritesByPerson: {
    'p-ed': servableFavourites.map((r) => r.id),
    'p-jack': servableFavourites.map((r) => r.id),
  },
};
const favPlan = generatePlan({ household: favHousehold, history: [] }, '2026-08-03', { seed: 42 });
const favRule = favPlan.evaluation.soft.find((r) => r.ruleId === 'stated-favourites')!;
check('stated favourites are scored by the planner', favRule.score > 0);
check(
  'and the week still satisfies every hard rule',
  favPlan.evaluation.violations.length === 0,
);


check(
  'stated favourites appear on the person view',
  buildPersonProfile('p-ed', profilePlan.plan, ctx, verdictEvents).favourites.some(
    (f) => f.recipeId === 'chana-dhal',
  ),
);
check(
  'and only for the person who stated them',
  buildPersonProfile('p-katie', profilePlan.plan, ctx, verdictEvents).favourites.every(
    (f) => f.recipeId !== 'chana-dhal',
  ),
);
check(
  'a child never carries a goal on their profile',
  buildPersonProfile('p-katie', profilePlan.plan, ctx).goal === undefined,
);


// ---------------------------------------------------------------------------
section('Resilience: a plan that outlives its recipes');

const tempRecipe = finaliseRecipe({
  name: 'Temporary test dish',
  slots: ['dinner'],
  cuisine: 'british',
  proteins: ['legume'] as never,
  tags: [] as never,
  servings: 4,
  activeMinutes: 10,
  totalMinutes: 20,
  ingredients: [{ ingredientId: 'chickpeas', amount: 400, unit: 'g' as const }],
  method: ['Cook it.'],
});
setUserRecipes([tempRecipe]);

const fragilePlan = {
  weekStartISO: '2026-08-03',
  householdId: 'household-1',
  seed: 1,
  meals: [
    {
      day: 0 as DayIndex,
      slot: 'dinner' as const,
      recipeId: tempRecipe.id,
      portions: 4,
      attendeeIds: ['p-ed'],
    },
    ...generatePlan(ctx, '2026-08-03', { seed: 42 }).plan.meals.filter(
      (m) => !(m.day === 0 && m.slot === 'dinner'),
    ),
  ],
};

check('integrity passes while the recipe exists', checkPlanIntegrity(fragilePlan).ok);
check('and the plan can be shopped for', allLines(buildShoppingList(fragilePlan)).length > 0);
check(
  'the recipe is reported as in use',
  mealsUsing(fragilePlan, tempRecipe.id).length === 1,
);

// Now delete it out from under the plan — the exact thing that white-screened
// the app before this check existed.
setUserRecipes([]);
const broken = checkPlanIntegrity(fragilePlan);
check('integrity now fails', !broken.ok);
check('and names where the problem is', broken.orphaned[0].where.includes('Monday'));

const pruned = dropOrphanedMeals(fragilePlan);
check('dropping orphans leaves a usable plan', checkPlanIntegrity(pruned).ok);
check(
  'and the shopping list builds again',
  allLines(buildShoppingList(pruned)).length > 0,
);
check(
  'only the orphaned meal is lost',
  pruned.meals.length === fragilePlan.meals.length - 1,
);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
