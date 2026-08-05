import { getIngredient } from '../data/ingredients.js';
import { getRecipe } from '../data/registry.js';
import { attendeesFor } from '../rules/context.js';
import type { RuleContext } from '../rules/context.js';
import { formatQuantity, toBase } from '../units.js';
import type { Allergen, PlannedMeal, Recipe } from '../types.js';

/**
 * Preparing a recipe for someone about to cook it.
 *
 * The whole reason to read the recipe *here* rather than on a website is that
 * the app knows how many portions are actually needed tonight. Three people
 * eating a dish written for four means the quantities on the page should say
 * three, not four with a note to do the arithmetic at the hob.
 *
 * Two things this deliberately does not do:
 *  - round to "nice" numbers, because 187g of pasta is correct and 200g is a
 *    different dish when you have scaled down far enough for it to matter
 *  - scale fixed items, because a tablespoon of oil for the pan does not
 *    double when two more people are eating
 */

export interface ScaledIngredient {
  ingredientId: string;
  name: string;
  /** Already scaled and formatted, e.g. "375g" or "3 cloves". */
  display: string;
  note?: string;
  /** True if this wasn't scaled — oil for the pan, a pinch of salt. */
  fixed: boolean;
  allergens: Allergen[];
}

export interface ScaledRecipe {
  recipe: Recipe;
  /** Portions being cooked, which may differ from the recipe's own servings. */
  portions: number;
  /** The multiplier applied. 1 means the recipe is being cooked as written. */
  scale: number;
  scaled: boolean;
  ingredients: ScaledIngredient[];
  method: string[];
  /** People eating this meal, for the header. */
  eating: string[];
  /** Advisory allergen notes for the people at this meal. */
  warnings: string[];
  /** Set when this meal is leftovers rather than a cook. */
  reheatOnly: boolean;
}

export function scaleRecipeForMeal(
  meal: PlannedMeal,
  ctx: RuleContext,
): ScaledRecipe {
  const recipe = getRecipe(meal.recipeId);
  const scale = meal.portions / recipe.servings;
  const eating = attendeesFor(ctx.household, meal.day, meal.slot);

  const ingredients: ScaledIngredient[] = recipe.ingredients.map((item) => {
    const ingredient = getIngredient(item.ingredientId);
    const amount = item.fixed ? item.amount : item.amount * scale;

    return {
      ingredientId: ingredient.id,
      name: ingredient.name,
      display: displayAmount(amount, item.unit, item.note),
      note: item.note,
      fixed: !!item.fixed,
      allergens: ingredient.allergens,
    };
  });

  // Advisory only — the same wording rule as everywhere else in the app.
  const warnings: string[] = [];
  for (const person of eating) {
    const clashes = new Set<Allergen>();
    for (const item of recipe.ingredients) {
      for (const allergen of getIngredient(item.ingredientId).allergens) {
        if (person.dietary.avoidAllergens.includes(allergen)) clashes.add(allergen);
      }
    }
    if (clashes.size > 0) {
      warnings.push(
        `Contains ${[...clashes].join(', ')} — ${person.name} avoids this. Check the pack.`,
      );
    }
  }

  return {
    recipe,
    portions: meal.portions,
    scale,
    scaled: Math.abs(scale - 1) > 0.01,
    ingredients,
    method: recipe.method,
    eating: eating.map((p) => p.name),
    warnings,
    reheatOnly: meal.source === 'planned-over',
  };
}

/**
 * Render a scaled amount the way a cook would write it.
 *
 * Countables get fractions rounded to halves — "1.5 onions" is usable where
 * "1.33 onions" is not. Weights and volumes keep their precision, since 187g is
 * a real instruction and rounding it defeats the point of scaling at all.
 */
function displayAmount(amount: number, unit: string, note?: string): string {
  if (unit === 'unit') {
    const rounded = Math.round(amount * 2) / 2;
    const shown = rounded < 0.5 ? 0.5 : rounded;
    return note ? `${trim(shown)}` : `${trim(shown)}`;
  }
  if (unit === 'pinch') return amount > 1.5 ? `${trim(amount)} pinches` : 'a pinch';
  if (unit === 'tsp' || unit === 'tbsp' || unit === 'cup') {
    return `${trim(Math.round(amount * 4) / 4)} ${unit}`;
  }
  const base = toBase({ amount, unit: unit as never });
  return formatQuantity({
    amount: Math.round(base.amount),
    unit: base.unit,
  });
}

function trim(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * Total hands-on and wall-clock time, adjusted for a planned-over.
 * Reheating leftovers is not a 40-minute job just because the original was.
 */
export function timingFor(scaled: ScaledRecipe): {
  activeMinutes: number;
  totalMinutes: number;
} {
  if (scaled.reheatOnly) return { activeMinutes: 5, totalMinutes: 12 };
  return {
    activeMinutes: scaled.recipe.activeMinutes,
    totalMinutes: scaled.recipe.totalMinutes,
  };
}
