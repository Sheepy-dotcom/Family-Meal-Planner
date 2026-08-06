import type { Diet, ProteinClass } from '../types.js';

/**
 * Diets, on the animal-products axis.
 *
 * Kept in one place so the solver's hard rule, the feasibility check and the
 * settings screen all agree on what each diet excludes — a vegan offered a
 * chicken dish by one path and not another would be worse than no diets at all.
 */

export const DIET_LABELS: Record<Diet, string> = {
  omnivore: 'Eats everything',
  pescatarian: 'Pescatarian',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
};

export const DIET_HINTS: Record<Diet, string> = {
  omnivore: 'No restriction — every dish is on the table.',
  pescatarian: 'Fish and shellfish are fine; no meat.',
  vegetarian: 'No meat or fish; eggs and dairy are fine.',
  vegan: 'No meat, fish, eggs or dairy.',
};

export const DIETS: Diet[] = ['omnivore', 'pescatarian', 'vegetarian', 'vegan'];

/** The protein classes each diet rules out. Omnivore rules out nothing. */
export const DIET_FORBIDS: Record<Diet, ProteinClass[]> = {
  omnivore: [],
  pescatarian: ['chicken', 'red-meat', 'pork'],
  vegetarian: ['fish', 'shellfish', 'chicken', 'red-meat', 'pork'],
  vegan: ['fish', 'shellfish', 'chicken', 'red-meat', 'pork', 'egg', 'dairy-protein'],
};

/** True if every one of the recipe's proteins is allowed for this diet. */
export function dietAllows(diet: Diet | undefined, proteins: ProteinClass[]): boolean {
  const forbid = DIET_FORBIDS[diet ?? 'omnivore'];
  return !proteins.some((p) => forbid.includes(p));
}
