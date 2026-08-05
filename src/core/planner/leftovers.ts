import { getRecipe } from '../data/registry.js';
import { isAllowedAsPlannedOver } from '../rules/hard.js';
import { DAY_NAMES, attendeesFor, portionsFor } from '../rules/context.js';
import type { RuleContext } from '../rules/context.js';
import type { DayIndex, MealPlan, MealSlot, PlannedMeal } from '../types.js';

/**
 * Planned-overs — cooking Sunday's dinner big enough to cover Monday's lunch.
 *
 * This is different from "minimise leftovers", which is what most planners
 * offer. Leftovers are an accident you manage; a planned-over is a decision you
 * make, and it's the single biggest reduction in weeknight cooking available.
 *
 * The rules that must not be fooled by it:
 *  - the repeat limit, because this isn't cooking the same dish twice
 *  - the shopping list, because the ingredients were already bought once
 * Both check `source`, so a planned-over is free rather than double-counted.
 */

export interface PlannedOverSuggestion {
  /** The meal that gets cooked bigger. */
  sourceDay: DayIndex;
  sourceSlot: MealSlot;
  /** The slot it covers. */
  targetDay: DayIndex;
  targetSlot: MealSlot;
  recipeId: string;
  recipeName: string;
  extraPortions: number;
  /** Hands-on minutes saved on the target day. */
  minutesSaved: number;
  message: string;
}

const CARRY_SLOTS: MealSlot[] = ['lunch', 'dinner'];

/**
 * A dish has to be worth carrying: it must batch-cook or keep well, and the
 * portions have to be plausible. Doubling a steak is not a planned-over.
 */
function canCarry(recipeId: string): boolean {
  const recipe = getRecipe(recipeId);
  return recipe.tags.includes('batch-cooks') || recipe.tags.includes('make-ahead');
}

export function suggestPlannedOvers(
  plan: MealPlan,
  ctx: RuleContext,
): PlannedOverSuggestion[] {
  const suggestions: PlannedOverSuggestion[] = [];
  const taken = new Set<string>();

  const sorted = [...plan.meals].sort((a, b) => a.day - b.day);

  for (const meal of sorted) {
    if (meal.source === 'planned-over') continue;
    // Breakfast doesn't carry — the point is saving time on an evening.
    if (!CARRY_SLOTS.includes(meal.slot)) continue;
    if (!canCarry(meal.recipeId)) continue;

    const recipe = getRecipe(meal.recipeId);

    // Only the next day. Beyond that it's a food-safety question we shouldn't
    // be making on someone's behalf.
    const nextDay = (meal.day + 1) as DayIndex;
    if (nextDay > 6) continue;

    for (const slot of CARRY_SLOTS) {
      const key = `${nextDay}:${slot}`;
      if (taken.has(key)) continue;

      const target = plan.meals.find((m) => m.day === nextDay && m.slot === slot);
      if (!target || target.source === 'planned-over') continue;
      if (target.recipeId === meal.recipeId) continue;

      const attendees = attendeesFor(ctx.household, nextDay, slot);
      if (attendees.length === 0) continue;

      // The dish still has to suit the slot and everyone eating it. Carrying
      // breakfast into lunch, or gluten to a coeliac on a different day, are
      // the two ways this feature goes wrong.
      if (!isAllowedAsPlannedOver(recipe, nextDay, slot, ctx)) continue;

      // Don't propose a dish the people eating it can't have.
      const targetRecipe = getRecipe(target.recipeId);
      if (targetRecipe.activeMinutes <= 8) continue; // nothing much to save

      const extraPortions = portionsFor(attendees);
      taken.add(key);
      suggestions.push({
        sourceDay: meal.day,
        sourceSlot: meal.slot,
        targetDay: nextDay,
        targetSlot: slot,
        recipeId: meal.recipeId,
        recipeName: recipe.name,
        extraPortions,
        minutesSaved: targetRecipe.activeMinutes,
        message:
          `Cook ${extraPortions} extra portions of ${recipe.name} on ${DAY_NAMES[meal.day]} ` +
          `and ${DAY_NAMES[nextDay]} ${slot} is done — saves ${targetRecipe.activeMinutes} minutes at the hob.`,
      });
      break;
    }
  }

  return suggestions;
}

/**
 * Apply a suggestion: scale up the source meal and convert the target.
 *
 * The target keeps its own attendee list and portion count so the plan still
 * reads correctly, but carries `source: 'planned-over'` and a pointer back to
 * where it was cooked.
 */
export function applyPlannedOver(
  plan: MealPlan,
  suggestion: PlannedOverSuggestion,
): MealPlan {
  const meals: PlannedMeal[] = plan.meals.map((meal) => {
    if (meal.day === suggestion.sourceDay && meal.slot === suggestion.sourceSlot) {
      return { ...meal, portions: meal.portions + suggestion.extraPortions };
    }
    if (meal.day === suggestion.targetDay && meal.slot === suggestion.targetSlot) {
      return {
        ...meal,
        recipeId: suggestion.recipeId,
        source: 'planned-over',
        cookedOn: { day: suggestion.sourceDay, slot: suggestion.sourceSlot },
      };
    }
    return meal;
  });

  return { ...plan, meals };
}

/** Undo — restores the source portions and leaves the target needing a dish. */
export function clearPlannedOvers(plan: MealPlan, ctx: RuleContext): MealPlan {
  const carried = plan.meals.filter((m) => m.source === 'planned-over');
  if (carried.length === 0) return plan;

  const meals = plan.meals
    .map((meal) => {
      const covered = carried.find(
        (c) =>
          c.cookedOn && c.cookedOn.day === meal.day && c.cookedOn.slot === meal.slot,
      );
      if (!covered) return meal;
      const attendees = attendeesFor(ctx.household, covered.day, covered.slot);
      return { ...meal, portions: meal.portions - portionsFor(attendees) };
    })
    .filter((m) => m.source !== 'planned-over');

  return { ...plan, meals };
}
