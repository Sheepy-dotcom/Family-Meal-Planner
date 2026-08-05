/**
 * Every number a soft rule cares about, in one place.
 *
 * These are the knobs a household actually wants to turn. Keeping them out of
 * the rule bodies means the settings screen can edit this object directly
 * rather than needing a code change per preference.
 */
export interface PlannerTargets {
  fishDinnersPerWeek: { min: number; max: number };
  legumeMealsPerWeek: { min: number; max: number };
  saladsPerWeek: { min: number; max: number };
  traybakesPerWeek: { min: number };
  newDishesPerWeek: { min: number; max: number };
  /** Weeks of history a repeated recipe is penalised within. */
  repeatWindowWeeks: number;
  /** Weeks of history a repeated pasta style is penalised within. */
  pastaStyleWindowWeeks: number;
}

export const DEFAULT_TARGETS: PlannerTargets = {
  fishDinnersPerWeek: { min: 2, max: 3 },
  legumeMealsPerWeek: { min: 2, max: 3 },
  saladsPerWeek: { min: 1, max: 2 },
  traybakesPerWeek: { min: 1 },
  newDishesPerWeek: { min: 1, max: 2 },
  repeatWindowWeeks: 2,
  pastaStyleWindowWeeks: 2,
};

/**
 * Relative weights. When rules collide — and with a list this long they will —
 * these decide what gives. The plan surfaces whatever ends up unmet rather
 * than silently dropping it.
 */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  'protein-every-meal': 3,
  'cuisine-variety': 3,
  'no-recent-repeats': 3,
  'fish-frequency': 2.5,
  'legume-frequency': 2,
  'weekly-protein-requests': 2,
  'pasta-style-variety': 1.5,
  'salad-frequency': 1.5,
  'traybake-frequency': 1.5,
  'novelty': 1,
  'ingredient-overlap': 1,
  'use-up-ingredients': 2,
  'respect-dislikes': 1.5,
  'learned-preferences': 2,
  'eating-goals': 2,
  'stated-favourites': 1.5,
};
