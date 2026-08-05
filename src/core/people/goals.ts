import { getRecipe } from '../data/registry.js';
import type { EatingGoal, Person, ProteinClass, Recipe } from '../types.js';

/**
 * Eating goals, without a calorie counter.
 *
 * The app has no nutrition data — no calories, no macros, nothing per 100g. It
 * could be added, but a figure like "42g protein" derived from recipe tags
 * would be invented precision, and people make decisions on numbers like that.
 *
 * So a goal does two honest things instead:
 *
 *  1. Nudges the planner towards protein-forward meals on the days that person
 *     eats, as a weighted preference among many.
 *  2. Adjusts how much is served, through the portion factor that already
 *     drives scaling and the shopping list.
 *
 * No daily total, no target to hit, no trend to watch. That last part is
 * deliberate: a number to chase is the component of diet tracking most
 * associated with harm, and it isn't needed to eat more protein.
 */

/** Protein classes that make a meal the centre of someone's protein intake. */
const SUBSTANTIAL: ProteinClass[] = [
  'fish',
  'shellfish',
  'chicken',
  'red-meat',
  'pork',
  'egg',
  'legume',
  'meat-substitute',
];

/** Supporting rather than leading — cheese on pasta is not a protein meal. */
const SUPPORTING: ProteinClass[] = ['dairy-protein'];

export type ProteinWeight = 'protein-forward' | 'moderate' | 'light';

/**
 * How protein-forward a dish is, qualitatively.
 *
 * A count of protein classes, not grams. Two substantial proteins (chicken and
 * lentils) genuinely is more protein-forward than one, and zero genuinely is
 * light — that ordering is reliable even though the underlying numbers aren't.
 */
export function proteinWeightOf(recipe: Recipe): ProteinWeight {
  const substantial = recipe.proteins.filter((p) => SUBSTANTIAL.includes(p)).length;
  const supporting = recipe.proteins.filter((p) => SUPPORTING.includes(p)).length;
  if (substantial >= 2) return 'protein-forward';
  if (substantial === 1) return supporting > 0 ? 'protein-forward' : 'moderate';
  if (supporting > 0) return 'light';
  return 'light';
}

export function isProteinForward(recipeId: string): boolean {
  return proteinWeightOf(getRecipe(recipeId)) === 'protein-forward';
}

/**
 * Portion multiplier for a goal.
 *
 * Small and bounded on purpose. A goal should shift a plate, not restrict it,
 * and an adult on 'lighter' still gets a proper meal.
 */
export function portionFactorFor(person: Person): number {
  if (person.ageBand !== 'adult' || !person.goal) return person.portionFactor;
  switch (person.goal) {
    case 'more-protein':
      return person.portionFactor * 1.1;
    case 'lighter':
      return person.portionFactor * 0.85;
    case 'balanced':
      return person.portionFactor;
  }
}

export const GOAL_LABELS: Record<EatingGoal, string> = {
  balanced: 'No particular focus',
  'more-protein': 'More protein',
  lighter: 'Lighter meals',
};

export const GOAL_HINTS: Record<EatingGoal, string> = {
  balanced: 'Plan as normal.',
  'more-protein':
    'Favours meals built around fish, meat, eggs or pulses, and serves a slightly larger portion.',
  lighter: 'Serves a slightly smaller portion. No counting, no targets.',
};

/** Only adults get goals. Enforced here so the UI can't accidentally offer one. */
export function canSetGoal(person: Person): boolean {
  return person.ageBand === 'adult';
}
