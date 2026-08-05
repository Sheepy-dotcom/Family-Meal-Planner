import { findRecipe } from '../data/registry.js';
import { DAY_NAMES } from '../rules/context.js';
import type { MealPlan, PlannedMeal } from '../types.js';

/**
 * Guarding against a plan that references a recipe which no longer exists.
 *
 * This is reachable in two ordinary ways: someone deletes one of their own
 * recipes while it's still on this week's plan, or a plan saved in
 * localStorage outlives a recipe that has since been removed. Before this
 * check, either one threw from `getRecipe` deep inside the shopping list and
 * took the whole app down with a blank screen — the worst possible failure,
 * because nothing on screen tells you what went wrong or how to recover.
 */

export interface PlanIntegrity {
  ok: boolean;
  /** Meals whose recipe has gone missing. */
  orphaned: Array<{ meal: PlannedMeal; where: string }>;
}

export function checkPlanIntegrity(plan: MealPlan): PlanIntegrity {
  const orphaned = plan.meals
    .filter((meal) => !findRecipe(meal.recipeId))
    .map((meal) => ({
      meal,
      where: `${DAY_NAMES[meal.day]} ${meal.slot}`,
    }));
  return { ok: orphaned.length === 0, orphaned };
}

/**
 * Drop meals whose recipe has vanished, leaving the slot empty rather than the
 * app broken. The slot then shows up through the normal "nothing fits here"
 * path, which the user already knows how to resolve.
 */
export function dropOrphanedMeals(plan: MealPlan): MealPlan {
  return { ...plan, meals: plan.meals.filter((m) => findRecipe(m.recipeId)) };
}

/** Which planned meals use a given recipe — asked before deleting one. */
export function mealsUsing(plan: MealPlan, recipeId: string): PlannedMeal[] {
  return plan.meals.filter((m) => m.recipeId === recipeId);
}
