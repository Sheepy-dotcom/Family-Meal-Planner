import { RECIPES as BUILT_IN } from './recipes.js';
import { RECIPE_GUIDES } from './guides.js';
import type { Recipe } from '../types.js';

/**
 * Attach a detailed guide from the guides file to any built-in recipe that
 * doesn't already carry one inline. Kept here so every consumer of the registry
 * — the recipe screen especially — sees guides without the catalogue file
 * having to hold them all.
 */
function withGuide(recipe: Recipe): Recipe {
  if (recipe.guide?.length) return recipe;
  const guide = RECIPE_GUIDES[recipe.id];
  return guide ? { ...recipe, guide } : recipe;
}

const BUILT_IN_GUIDED = BUILT_IN.map(withGuide);

/**
 * The recipe registry.
 *
 * Recipes were a static array while the book was fixed. Once a household can
 * add its own dishes there has to be one place that knows about both, because
 * the solver, the feasibility check and the learning module must all see the
 * same book — a user recipe the planner can schedule but the shopping list
 * can't price is worse than no user recipe at all.
 *
 * User recipes shadow built-ins with the same id, which is how "I make the
 * bolognese differently" works without forking the whole catalogue.
 */

let userRecipes: Recipe[] = [];
let merged: Recipe[] = BUILT_IN_GUIDED;
let index = new Map(BUILT_IN_GUIDED.map((r) => [r.id, r]));

function rebuild(): void {
  const byId = new Map(BUILT_IN_GUIDED.map((r) => [r.id, r]));
  for (const recipe of userRecipes) byId.set(recipe.id, recipe);
  index = byId;
  merged = [...byId.values()];
}

/**
 * Replace the user's recipes wholesale.
 *
 * Wholesale rather than incremental on purpose: the caller owns the list and
 * persists it, so there's exactly one source of truth and no way for the
 * registry to drift from what's in storage.
 */
export function setUserRecipes(recipes: Recipe[]): void {
  userRecipes = recipes;
  rebuild();
}

export function getUserRecipes(): Recipe[] {
  return userRecipes;
}

/** Every recipe the planner may use. */
export function allRecipes(): Recipe[] {
  return merged;
}

export function getRecipe(id: string): Recipe {
  const found = index.get(id);
  if (!found) throw new Error(`Unknown recipe id: ${id}`);
  return found;
}

export function findRecipe(id: string): Recipe | null {
  return index.get(id) ?? null;
}

export function isUserRecipe(id: string): boolean {
  return userRecipes.some((r) => r.id === id);
}

/** Built-ins can be reset to; user edits can be thrown away. */
export function isOverriddenBuiltIn(id: string): boolean {
  return isUserRecipe(id) && BUILT_IN.some((r) => r.id === id);
}
