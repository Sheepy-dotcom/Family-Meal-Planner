import { getIngredient } from '../data/ingredients.js';
import { getRecipe } from '../data/registry.js';
import { attendeesFor } from '../rules/context.js';
import type {
  DietaryFlag,
  Household,
  MealPlan,
  MealScreen,
  ShoppingLine,
  ShoppingList,
} from '../types.js';
import { allLines } from '../shopping/list.js';

/**
 * ADVISORY ONLY.
 *
 * This screen reads our own ingredient catalogue. It does not know about
 * recipe reformulation, "may contain" advisory statements, shared production
 * lines, or what the picker substitutes into the box on delivery day. For
 * coeliac disease and for any true allergy, cross-contamination is the real
 * risk and it is not visible from an ingredient list.
 *
 * So: every string this module produces says "contains", never "safe for".
 * The distinction between a helpful filter and a safety claim is the whole
 * ballgame — see README, "Allergens are advisory".
 */

export function screenPlan(plan: MealPlan, household: Household): MealScreen[] {
  return plan.meals.map((meal) => {
    const recipe = getRecipe(meal.recipeId);
    const flags: DietaryFlag[] = [];

    for (const person of attendeesFor(household, meal.day, meal.slot)) {
      for (const ri of recipe.ingredients) {
        const ingredient = getIngredient(ri.ingredientId);
        for (const allergen of ingredient.allergens) {
          if (person.dietary.avoidAllergens.includes(allergen)) {
            flags.push({
              personId: person.id,
              personName: person.name,
              ingredientId: ingredient.id,
              ingredientName: ingredient.name,
              allergen,
              severity: 'exclusion',
            });
          }
        }
      }
    }

    return { day: meal.day, slot: meal.slot, recipeId: meal.recipeId, flags };
  });
}

export interface FlaggedLine {
  line: ShoppingLine;
  /** People in the household who exclude something this product contains. */
  affects: Array<{ personId: string; personName: string; allergens: string[] }>;
}

/**
 * Products on the list that clash with someone's exclusions.
 *
 * This is what a basket integration would consult before adding anything, and
 * what the user is asked to confirm on the pack. The check runs on the
 * shopping list rather than the plan because that's the layer that becomes an
 * order.
 */
export function flagShoppingList(
  list: ShoppingList,
  household: Household,
): FlaggedLine[] {
  const out: FlaggedLine[] = [];
  const everyLine = [...allLines(list), ...list.checkCupboard];

  for (const line of everyLine) {
    const affects = household.people
      .map((person) => ({
        personId: person.id,
        personName: person.name,
        allergens: line.allergens.filter((a) => person.dietary.avoidAllergens.includes(a)),
      }))
      .filter((a) => a.allergens.length > 0);

    if (affects.length > 0) out.push({ line, affects });
  }

  return out;
}

/** Wording used wherever a flag is surfaced. Kept in one place on purpose. */
export function flagSentence(flag: FlaggedLine): string {
  const names = flag.affects.map((a) => a.personName).join(' and ');
  const allergens = [...new Set(flag.affects.flatMap((a) => a.allergens))].join(', ');
  return `${flag.line.name} contains ${allergens} — ${names} avoids this. Check the pack before buying.`;
}
