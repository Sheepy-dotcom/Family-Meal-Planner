import { getIngredient } from '../data/ingredients.js';
import { getRecipe } from '../data/registry.js';
import {
  addBase,
  canonicalUnitFor,
  convertBase,
  roundToPacks,
  scaleBase,
  toBase,
} from '../units.js';
import type {
  Aisle,
  BaseQuantity,
  MealPlan,
  ShoppingLine,
  ShoppingList,
} from '../types.js';

const AISLE_ORDER: Aisle[] = [
  'produce',
  'meat-fish',
  'dairy-eggs',
  'bakery',
  'ambient',
  'world-foods',
  'herbs-spices',
  'frozen',
  'household',
];

export const AISLE_LABELS: Record<Aisle, string> = {
  produce: 'Fruit & veg',
  'meat-fish': 'Meat & fish',
  'dairy-eggs': 'Dairy & eggs',
  bakery: 'Bakery',
  ambient: 'Cupboard',
  'world-foods': 'World foods',
  'herbs-spices': 'Herbs & spices',
  frozen: 'Frozen',
  household: 'Household',
};

/**
 * Turn a plan into something you can actually walk round a shop with.
 *
 * Three things happen here that a naive implementation skips, and each is a
 * reason people abandon meal planners:
 *  1. quantities scale to the portions actually being cooked,
 *  2. amounts are summed in real units, not concatenated as strings,
 *  3. the result is rounded up to whole retail packs.
 */
export function buildShoppingList(plan: MealPlan): ShoppingList {
  const totals = new Map<string, { qty: BaseQuantity; usedBy: Set<string> }>();

  for (const meal of plan.meals) {
    // Planned-overs were bought and cooked with their source meal, whose
    // portions were scaled up to cover them. Counting them again would buy
    // the ingredients twice.
    if (meal.source === 'planned-over') continue;
    const recipe = getRecipe(meal.recipeId);
    const scale = meal.portions / recipe.servings;

    for (const ri of recipe.ingredients) {
      const ingredient = getIngredient(ri.ingredientId);
      const base = toBase({ amount: ri.amount, unit: ri.unit });
      // Oil for the pan doesn't double because two more people are eating.
      const raw = ri.fixed ? base : scaleBase(base, scale);

      const existing = totals.get(ri.ingredientId);
      const target = existing?.qty.unit ?? canonicalUnitFor(ingredient) ?? raw.unit;
      const contribution = convertBase(
        raw,
        target,
        ingredient.gramsPerUnit,
        ingredient.gramsPerMl,
      );

      if (!contribution) {
        throw new Error(
          `${ingredient.name} is measured in ${raw.unit} by "${recipe.name}" but tracked in ${target}. ` +
            `Add gramsPerUnit to the ingredient, or use consistent units in the recipe.`,
        );
      }

      if (existing) {
        existing.qty = addBase(existing.qty, contribution);
        existing.usedBy.add(recipe.name);
      } else {
        totals.set(ri.ingredientId, {
          qty: contribution,
          usedBy: new Set([recipe.name]),
        });
      }
    }
  }

  const linesByAisle = Object.fromEntries(
    AISLE_ORDER.map((a) => [a, [] as ShoppingLine[]]),
  ) as Record<Aisle, ShoppingLine[]>;
  const checkCupboard: ShoppingLine[] = [];

  for (const [ingredientId, { qty, usedBy }] of totals) {
    const ingredient = getIngredient(ingredientId);
    const { buy, packsToBuy } = roundToPacks(qty, ingredient.pack);
    const line: ShoppingLine = {
      ingredientId,
      name: ingredient.name,
      aisle: ingredient.aisle,
      needed: { amount: round2(qty.amount), unit: qty.unit },
      buy,
      packsToBuy,
      usedBy: [...usedBy].sort(),
      allergens: ingredient.allergens,
    };

    // Staples go on a separate "check you've got these" list. Putting salt on
    // the main list every week is how people stop reading the main list.
    if (ingredient.staple) checkCupboard.push(line);
    else linesByAisle[ingredient.aisle].push(line);
  }

  for (const aisle of AISLE_ORDER) {
    linesByAisle[aisle].sort((a, b) => a.name.localeCompare(b.name));
  }
  checkCupboard.sort((a, b) => a.name.localeCompare(b.name));

  return { weekStartISO: plan.weekStartISO, linesByAisle, checkCupboard };
}

export function allLines(list: ShoppingList): ShoppingLine[] {
  return AISLE_ORDER.flatMap((a) => list.linesByAisle[a]);
}

export function aisleOrder(): Aisle[] {
  return AISLE_ORDER;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
