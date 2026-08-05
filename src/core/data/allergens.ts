import type { Allergen } from '../types.js';

/**
 * The 14 allergens that must be declared under UK food law.
 * Runtime list for building the settings UI; the `Allergen` union in types.ts
 * is the compile-time guard. The `satisfies` keeps them in step.
 */
export const ALLERGENS = [
  'celery',
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'lupin',
  'milk',
  'molluscs',
  'mustard',
  'nuts',
  'peanuts',
  'sesame',
  'soya',
  'sulphites',
] as const satisfies readonly Allergen[];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  celery: 'Celery',
  gluten: 'Gluten',
  crustaceans: 'Crustaceans',
  eggs: 'Eggs',
  fish: 'Fish',
  lupin: 'Lupin',
  milk: 'Milk',
  molluscs: 'Molluscs',
  mustard: 'Mustard',
  nuts: 'Tree nuts',
  peanuts: 'Peanuts',
  sesame: 'Sesame',
  soya: 'Soya',
  sulphites: 'Sulphites',
};
