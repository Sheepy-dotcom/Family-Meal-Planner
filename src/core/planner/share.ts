import { getRecipe } from '../data/registry.js';
import { DAY_NAMES, slotOrder } from '../rules/context.js';
import type { MealPlan } from '../types.js';

/**
 * The week as shareable plain text.
 *
 * The shopping list can already be copied out; this does the same for the plan
 * itself, so "here's what we're eating" can go to whoever asks without them
 * needing the app. Plain text on purpose — it pastes cleanly into a message, a
 * note or an email, which is the whole point.
 *
 * Meals are grouped by day and ordered breakfast → dinner. A dish the book no
 * longer knows about is skipped rather than shown as a broken id.
 */
export function weekPlanToText(plan: MealPlan, title = 'This week'): string {
  const byDay = new Map<number, typeof plan.meals>();
  for (const meal of plan.meals) {
    const arr = byDay.get(meal.day) ?? [];
    arr.push(meal);
    byDay.set(meal.day, arr);
  }

  const out: string[] = [title, ''];
  for (let day = 0; day < 7; day++) {
    const meals = (byDay.get(day) ?? [])
      .slice()
      .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
    if (meals.length === 0) continue;

    const rows: string[] = [];
    for (const meal of meals) {
      let name: string;
      try {
        name = getRecipe(meal.recipeId).name;
      } catch {
        continue;
      }
      rows.push(`  ${meal.slot}: ${name}`);
    }
    if (rows.length === 0) continue;

    out.push(DAY_NAMES[day].toUpperCase(), ...rows, '');
  }

  return out.join('\n').trim();
}
