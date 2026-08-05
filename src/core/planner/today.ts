/**
 * Today — the single screen for "what am I cooking right now".
 *
 * The week board answers "is the week sound". This answers "what happens
 * today", which is a different question with a different shape: one day, the
 * evening meal foremost, and a short list of things that have to happen *today*
 * so tomorrow isn't a scramble. It's a pure projection of the plan the solver
 * already produced — no new stored state, so nothing here can drift out of sync
 * with the board or the shopping list.
 */

import { getRecipe } from '../data/registry.js';
import { attendeesFor, DAY_NAMES, SLOT_ORDER } from '../rules/context.js';
import type {
  DayIndex,
  Household,
  MealPlan,
  MealSlot,
  Person,
  PlannedMeal,
  Recipe,
} from '../types.js';

export interface TodayMeal {
  slot: MealSlot;
  meal: PlannedMeal;
  recipe: Recipe;
  /** People actually at the table, resolved so the UI can name them. */
  attendees: Person[];
  /** Hands-on minutes. Zero-ish for a reheat, but kept honest from the recipe. */
  handsOnMinutes: number;
  /** The dinner — the one meal the day is really about. */
  hero: boolean;
  /** A planned-over cooked earlier in the week: reheat, don't cook again. */
  carried: boolean;
  /** The slot's eating window has passed, so it's a good moment to rate it. */
  past: boolean;
}

/**
 * Roughly when each slot's eating window closes. Used to decide when a meal is
 * behind us and worth rating — not to schedule anything, so approximate is fine.
 */
const SLOT_END_HOUR: Record<MealSlot, number> = {
  breakfast: 10,
  lunch: 14,
  dinner: 20,
  snack: 17,
};

/** Has this slot's window passed, at the given moment? */
export function slotHasPassed(slot: MealSlot, now: Date): boolean {
  return now.getHours() >= SLOT_END_HOUR[slot];
}

/**
 * Something that has to happen *today* for *tomorrow* to work. Two kinds:
 *  - 'make-ahead': tomorrow's dish is one you can get a head start on tonight.
 *  - 'planned-over': tonight's pot is scaled to also cover a meal tomorrow, so
 *    it needs cooking big.
 */
export interface ComingUp {
  kind: 'make-ahead' | 'planned-over';
  /** The dish to act on. */
  recipeId: string;
  recipeName: string;
  /** The slot tomorrow this is about. */
  targetSlot: MealSlot;
  message: string;
}

export type TodayStatus = 'ok' | 'no-plan' | 'today-outside-week' | 'no-meals-today';

export interface TodayView {
  status: TodayStatus;
  /** Where today falls in the plan week, or null if today isn't in it. */
  dayIndex: DayIndex | null;
  dayName: string | null;
  meals: TodayMeal[];
  /** The dinner, pulled out for prominence; null if none is planned. */
  dinner: TodayMeal | null;
  comingUp: ComingUp[];
}

/**
 * Which day of the plan week `now` is, or null when today sits outside it.
 *
 * The plan's week always starts on a Monday (`weekStartISO`). We compare whole
 * calendar days so the answer never depends on the time of day.
 */
export function todayIndex(weekStartISO: string, now: Date): DayIndex | null {
  const [y, m, d] = weekStartISO.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today - start) / 86_400_000);
  return diff >= 0 && diff <= 6 ? (diff as DayIndex) : null;
}

/** Build the whole Today view from the plan. Pure — safe to call on render. */
export function buildToday(
  plan: MealPlan | null,
  household: Household,
  now: Date,
): TodayView {
  if (!plan) {
    return emptyView('no-plan', null);
  }

  const day = todayIndex(plan.weekStartISO, now);
  if (day === null) {
    return emptyView('today-outside-week', null);
  }

  const meals: TodayMeal[] = plan.meals
    .filter((m) => m.day === day)
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
    .map((meal) => {
      const recipe = getRecipe(meal.recipeId);
      return {
        slot: meal.slot,
        meal,
        recipe,
        attendees: attendeesFor(household, meal.day, meal.slot),
        handsOnMinutes: recipe.activeMinutes,
        hero: meal.slot === 'dinner',
        carried: meal.source === 'planned-over',
        past: slotHasPassed(meal.slot, now),
      };
    });

  if (meals.length === 0) {
    return { ...emptyView('no-meals-today', day), dayName: DAY_NAMES[day] };
  }

  return {
    status: 'ok',
    dayIndex: day,
    dayName: DAY_NAMES[day],
    meals,
    dinner: meals.find((m) => m.hero) ?? null,
    comingUp: comingUpFor(plan, day),
  };
}

/**
 * Things happening today for tomorrow's sake.
 *
 * Planned-overs come first: they change what you do at tonight's hob, so
 * they're the more urgent nudge. Then a *single* make-ahead — most make-ahead
 * tags are breakfasts and lunches, and three "you can start it tonight" lines
 * is noise, not help. The dinner is the one worth getting ahead on, so it wins;
 * otherwise the earliest make-ahead stands in.
 */
function comingUpFor(plan: MealPlan, day: DayIndex): ComingUp[] {
  const tomorrow = (day + 1) as DayIndex;
  if (tomorrow > 6) return [];

  const tomorrowMeals = plan.meals
    .filter((m) => m.day === tomorrow)
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));

  const plannedOvers: ComingUp[] = [];
  const makeAheads: ComingUp[] = [];

  for (const meal of tomorrowMeals) {
    const recipe = getRecipe(meal.recipeId);

    // A planned-over tomorrow that was cooked *today*: tonight's pot is doing
    // double duty, so it has to be cooked big.
    if (meal.source === 'planned-over' && meal.cookedOn?.day === day) {
      plannedOvers.push({
        kind: 'planned-over',
        recipeId: meal.recipeId,
        recipeName: recipe.name,
        targetSlot: meal.slot,
        message:
          `Tonight's ${recipe.name} also covers tomorrow's ${meal.slot} — ` +
          `cook it big enough to carry over.`,
      });
      continue;
    }

    // A fresh make-ahead tomorrow: you can get it started tonight. Reheats
    // (planned-overs) are excluded above, so this is always a real cook.
    if (recipe.tags.includes('make-ahead')) {
      makeAheads.push({
        kind: 'make-ahead',
        recipeId: meal.recipeId,
        recipeName: recipe.name,
        targetSlot: meal.slot,
        message:
          `Tomorrow's ${meal.slot} is ${recipe.name}, a make-ahead — ` +
          `you can start it tonight.`,
      });
    }
  }

  // One make-ahead is a prompt; three is a chore list. Prefer the dinner.
  const makeAhead = makeAheads.find((m) => m.targetSlot === 'dinner') ?? makeAheads[0];
  return [...plannedOvers, ...(makeAhead ? [makeAhead] : [])];
}

function emptyView(status: TodayStatus, day: DayIndex | null): TodayView {
  return {
    status,
    dayIndex: day,
    dayName: day === null ? null : DAY_NAMES[day],
    meals: [],
    dinner: null,
    comingUp: [],
  };
}
