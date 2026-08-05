import { getIngredient } from '../data/ingredients.js';
import { getRecipe } from '../data/registry.js';
import { portionFactorFor } from '../people/goals.js';
import type {
  Allergen,
  DayIndex,
  Household,
  MealSlot,
  PlanHistoryEntry,
  PlannedMeal,
  Person,
  Recipe,
} from '../types.js';

export const DAYS: DayIndex[] = [0, 1, 2, 3, 4, 5, 6];
export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/**
 * Everything the rules are allowed to see. Passing a context rather than
 * globals means rules stay pure functions, which is what makes the solver
 * able to score thousands of candidate plans without side effects.
 */
export interface RuleContext {
  household: Household;
  history: PlanHistoryEntry[];
  /** Ad-hoc constraints for this week, entered by the user. */
  weekNotes?: {
    useUpIngredientIds?: string[];
    avoidIngredientIds?: string[];
  };
}

export function attendeesFor(
  household: Household,
  day: DayIndex,
  slot: MealSlot,
): Person[] {
  const away = new Set(
    household.absences
      .filter((a) => a.day === day && a.slot === slot)
      .map((a) => a.personId),
  );
  return household.people.filter((p) => !away.has(p.id));
}

/** Portions to cook, from attendance and per-person portion factors. */
export function portionsFor(people: Person[]): number {
  const raw = people.reduce((sum, p) => sum + portionFactorFor(p), 0);
  // Round to the nearest half portion. Cooking to two decimal places is a
  // fiction, and over-precision is how you end up with a fridge of leftovers.
  return Math.max(1, Math.round(raw * 2) / 2);
}

/** Every allergen present in a recipe, from the ingredient catalogue. */
export function allergensIn(recipe: Recipe): Set<Allergen> {
  const set = new Set<Allergen>();
  for (const ri of recipe.ingredients) {
    for (const a of getIngredient(ri.ingredientId).allergens) set.add(a);
  }
  return set;
}

export function ingredientIdsIn(recipe: Recipe): Set<string> {
  return new Set(recipe.ingredients.map((ri) => ri.ingredientId));
}

/** Meals sorted into day order, for rules that care about adjacency. */
export function dinnersInOrder(meals: PlannedMeal[]): PlannedMeal[] {
  return meals
    .filter((m) => m.slot === 'dinner')
    .slice()
    .sort((a, b) => a.day - b.day);
}

export function recipesOf(meals: PlannedMeal[]): Recipe[] {
  return meals.map((m) => getRecipe(m.recipeId));
}

/** Recipe ids cooked in the last `weeks` history entries. */
export function recentRecipeIds(history: PlanHistoryEntry[], weeks: number): Set<string> {
  const recent = history.slice(-weeks);
  return new Set(recent.flatMap((h) => h.recipeIds));
}

export function countWhere(meals: PlannedMeal[], pred: (r: Recipe) => boolean): number {
  return meals.filter((m) => pred(getRecipe(m.recipeId))).length;
}
