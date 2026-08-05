import { allRecipes, getRecipe } from '../data/registry.js';
import {
  DAYS,
  DAY_NAMES,
  attendeesFor,
  portionsFor,
  type RuleContext,
} from '../rules/context.js';
import { DEFAULT_TARGETS, DEFAULT_WEIGHTS, type PlannerTargets } from '../rules/config.js';
import { hardRulesFor, isAllowed } from '../rules/hard.js';
import { evaluatePlan } from '../rules/index.js';
import type {
  DayIndex,
  MealPlan,
  MealSlot,
  PlanEvaluation,
  PlannedMeal,
  Recipe,
} from '../types.js';
import { makeRng, pickWeighted, shuffle } from './rng.js';

/**
 * The solver's job is scheduling, not invention.
 *
 * Hard rules prune the candidate set for each slot; soft rules score whole
 * plans. Construction is a randomised greedy pass, then hill-climbing swaps
 * clean it up. Best of N restarts wins. It's not an exact optimiser and
 * doesn't need to be — with ~30 recipes and 21 slots, "very good and
 * explainable in 50ms" beats "provably optimal".
 */

export interface SolveOptions {
  seed?: number;
  restarts?: number;
  /** Meals the user has fixed; the solver plans around them. */
  pinned?: PlannedMeal[];
  targets?: PlannerTargets;
  weights?: Record<string, number>;
}

export interface SlotRef {
  day: DayIndex;
  slot: MealSlot;
}

export interface SolveResult {
  plan: MealPlan;
  evaluation: PlanEvaluation;
  /** Slots no recipe could legally fill. Reported, never silently skipped. */
  unfilled: Array<SlotRef & { reason: string }>;
}

// ---------------------------------------------------------------------------

function slotsToFill(ctx: RuleContext): SlotRef[] {
  const out: SlotRef[] = [];
  for (const day of DAYS) {
    for (const slot of ctx.household.plannedSlots) {
      // Nobody home, nothing to cook.
      if (attendeesFor(ctx.household, day, slot).length === 0) continue;
      out.push({ day, slot });
    }
  }
  return out;
}

function candidatesFor(ref: SlotRef, ctx: RuleContext): Recipe[] {
  return allRecipes().filter((r) => isAllowed(r, ref.day, ref.slot, ctx));
}

function makeMeal(ref: SlotRef, recipe: Recipe, ctx: RuleContext): PlannedMeal {
  const attendees = attendeesFor(ctx.household, ref.day, ref.slot);
  return {
    day: ref.day,
    slot: ref.slot,
    recipeId: recipe.id,
    portions: portionsFor(attendees),
    attendeeIds: attendees.map((p) => p.id),
  };
}

function scoreOf(
  meals: PlannedMeal[],
  ctx: RuleContext,
  targets: PlannerTargets,
  weights: Record<string, number>,
): number {
  const evaluation = evaluatePlan(meals, ctx, targets, weights);
  // Hard violations should be impossible by construction, but if a pinned meal
  // introduces one we want the solver to route around it rather than embrace it.
  return evaluation.totalScore - evaluation.violations.length;
}

// ---------------------------------------------------------------------------

function construct(
  refs: SlotRef[],
  candidateMap: Map<string, Recipe[]>,
  pinned: PlannedMeal[],
  ctx: RuleContext,
  targets: PlannerTargets,
  weights: Record<string, number>,
  rng: () => number,
): PlannedMeal[] {
  const meals: PlannedMeal[] = pinned.map((m) => ({ ...m, pinned: true }));
  const pinnedKeys = new Set(pinned.map((m) => keyOf(m)));

  // Most-constrained slot first. Fill the Thursday-with-no-adults slot while
  // there are still options, not after the easy dishes have been spent.
  const order = shuffle(refs, rng)
    .filter((ref) => !pinnedKeys.has(`${ref.day}:${ref.slot}`))
    .sort(
      (a, b) =>
        (candidateMap.get(`${a.day}:${a.slot}`)?.length ?? 0) -
        (candidateMap.get(`${b.day}:${b.slot}`)?.length ?? 0),
    );

  for (const ref of order) {
    // The precomputed map handles dish-level rules; week-level rules such as
    // the repeat limit need re-checking against what's already been placed.
    const candidates = (candidateMap.get(`${ref.day}:${ref.slot}`) ?? []).filter((r) =>
      isAllowed(r, ref.day, ref.slot, ctx, meals),
    );
    if (candidates.length === 0) continue;

    const scored = candidates.map((recipe) => {
      const trial = [...meals, makeMeal(ref, recipe, ctx)];
      return { recipe, score: scoreOf(trial, ctx, targets, weights) };
    });
    scored.sort((a, b) => b.score - a.score);

    // Sample from the top few rather than always taking the best, so restarts
    // explore genuinely different weeks instead of re-deriving one answer.
    const top = scored.slice(0, Math.min(5, scored.length));
    const chosen = pickWeighted(
      top.map((s) => s.recipe),
      top.map((_, i) => 1 / (i + 1)),
      rng,
    );
    meals.push(makeMeal(ref, chosen, ctx));
  }

  return meals;
}

function keyOf(m: PlannedMeal | SlotRef): string {
  return `${m.day}:${m.slot}`;
}

/** Single-slot hill climbing until no swap improves the plan. */
function improve(
  meals: PlannedMeal[],
  candidateMap: Map<string, Recipe[]>,
  ctx: RuleContext,
  targets: PlannerTargets,
  weights: Record<string, number>,
  maxPasses = 4,
): PlannedMeal[] {
  let current = meals.slice();
  let currentScore = scoreOf(current, ctx, targets, weights);

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;

    for (let i = 0; i < current.length; i++) {
      if (current[i].pinned) continue;
      const ref = { day: current[i].day, slot: current[i].slot };
      const others = current.filter((_, j) => j !== i);
      const candidates = (candidateMap.get(keyOf(ref)) ?? []).filter((r) =>
        isAllowed(r, ref.day, ref.slot, ctx, others),
      );

      let bestRecipe: Recipe | null = null;
      let bestScore = currentScore;

      for (const recipe of candidates) {
        if (recipe.id === current[i].recipeId) continue;
        const trial = current.slice();
        trial[i] = makeMeal(ref, recipe, ctx);
        const score = scoreOf(trial, ctx, targets, weights);
        if (score > bestScore + 1e-9) {
          bestScore = score;
          bestRecipe = recipe;
        }
      }

      if (bestRecipe) {
        current[i] = makeMeal(ref, bestRecipe, ctx);
        currentScore = bestScore;
        improved = true;
      }
    }

    if (!improved) break;
  }

  return current;
}

// ---------------------------------------------------------------------------

export function generatePlan(
  ctx: RuleContext,
  weekStartISO: string,
  options: SolveOptions = {},
): SolveResult {
  const {
    seed = 1,
    restarts = 12,
    pinned = [],
    targets = DEFAULT_TARGETS,
    weights = DEFAULT_WEIGHTS,
  } = options;

  const refs = slotsToFill(ctx);
  const candidateMap = new Map<string, Recipe[]>();

  for (const ref of refs) {
    candidateMap.set(keyOf(ref), candidatesFor(ref, ctx));
  }

  let best: PlannedMeal[] | null = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < restarts; attempt++) {
    const rng = makeRng(seed + attempt * 7919);
    const built = construct(refs, candidateMap, pinned, ctx, targets, weights, rng);
    const polished = improve(built, candidateMap, ctx, targets, weights);
    const score = scoreOf(polished, ctx, targets, weights);
    if (score > bestScore) {
      bestScore = score;
      best = polished;
    }
  }

  const meals = (best ?? []).sort(
    (a, b) => a.day - b.day || slotOrder(a.slot) - slotOrder(b.slot),
  );

  return {
    plan: { weekStartISO, householdId: ctx.household.id, meals, seed },
    evaluation: evaluatePlan(meals, ctx, targets, weights),
    unfilled: diagnoseUnfilled(refs, meals, candidateMap),
  };
}

/**
 * Any slot the solver couldn't fill gets named and explained.
 *
 * A slot can go unfilled two ways: no dish passes the dish-level rules at all,
 * or the only dishes that pass were used up elsewhere in the week. The second
 * is the interesting case — it means the household's rules have collided, and
 * the honest answer is to say which one ran out of room rather than to hand
 * back a week with a hole in it.
 */
function diagnoseUnfilled(
  refs: SlotRef[],
  meals: PlannedMeal[],
  candidateMap: Map<string, Recipe[]>,
): SolveResult['unfilled'] {
  const filled = new Set(meals.map(keyOf));
  const out: SolveResult['unfilled'] = [];

  for (const ref of refs) {
    if (filled.has(keyOf(ref))) continue;
    const candidates = candidateMap.get(keyOf(ref)) ?? [];
    const where = `${DAY_NAMES[ref.day]} ${ref.slot}`;

    if (candidates.length === 0) {
      out.push({
        ...ref,
        reason: `Nothing in the recipe book fits ${where} — the rules for this slot rule out every dish.`,
      });
    } else {
      const names = candidates.slice(0, 3).map((r) => r.name).join(', ');
      out.push({
        ...ref,
        reason:
          `Only ${candidates.length} dish${candidates.length === 1 ? '' : 'es'} can fill ${where} (${names}), ` +
          `and they're already used as often as they should be this week. Add another option, or relax the time budget.`,
      });
    }
  }

  return out;
}

/**
 * Regenerate a single meal without disturbing the rest of the week.
 * Everything else is pinned, so the shopping list only changes where it must.
 */
export function reroll(
  plan: MealPlan,
  ref: SlotRef,
  ctx: RuleContext,
  options: SolveOptions = {},
): SolveResult {
  const pinned = plan.meals
    .filter((m) => !(m.day === ref.day && m.slot === ref.slot))
    .map((m) => ({ ...m, pinned: true }));

  const excludeId = plan.meals.find(
    (m) => m.day === ref.day && m.slot === ref.slot,
  )?.recipeId;

  const targets = options.targets ?? DEFAULT_TARGETS;
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const candidates = candidatesFor(ref, ctx).filter(
    (r) => r.id !== excludeId && isAllowed(r, ref.day, ref.slot, ctx, pinned),
  );

  if (candidates.length === 0) {
    return {
      plan,
      evaluation: evaluatePlan(plan.meals, ctx, targets, weights),
      unfilled: [{ ...ref, reason: 'No alternative dish satisfies the hard rules for this slot' }],
    };
  }

  let bestMeals = plan.meals;
  let bestScore = -Infinity;
  for (const recipe of candidates) {
    const trial = [...pinned, makeMeal(ref, recipe, ctx)];
    const score = scoreOf(trial, ctx, targets, weights);
    if (score > bestScore) {
      bestScore = score;
      bestMeals = trial;
    }
  }

  const meals = bestMeals
    .map((m) => ({ ...m, pinned: false }))
    .sort((a, b) => a.day - b.day || slotOrder(a.slot) - slotOrder(b.slot));

  return {
    plan: { ...plan, meals },
    evaluation: evaluatePlan(meals, ctx, targets, weights),
    unfilled: [],
  };
}

/**
 * Explains why a specific dish can't go in a specific slot. Powers the "why
 * isn't this an option?" affordance in the swap sheet — a planner that says no
 * without saying why is a planner people stop trusting.
 */
export function explainRejection(
  recipeId: string,
  ref: SlotRef,
  ctx: RuleContext,
): string[] {
  const recipe = getRecipe(recipeId);
  return hardRulesFor(ctx)
    .filter((rule) => !rule.allows(recipe, ref.day, ref.slot, ctx))
    .map((rule) => rule.explain(recipe, ref.day, ref.slot, ctx));
}

const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
function slotOrder(slot: MealSlot): number {
  return SLOT_ORDER.indexOf(slot);
}
