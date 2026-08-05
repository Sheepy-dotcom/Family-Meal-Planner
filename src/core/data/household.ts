import type { Household } from '../types.js';

/**
 * Seed household. This is sample data to make the rule engine demonstrable —
 * replace it with your own in the app, or edit here for local development.
 *
 * Everything a rule needs to know about the family lives on this object. The
 * rules themselves (src/core/rules) never hard-code a person's name.
 */
export const SEED_HOUSEHOLD: Household = {
  id: 'household-1',
  name: 'Sample family',
  plannedSlots: ['breakfast', 'lunch', 'dinner'],
  weeklyProteinRequests: [
    // "Jack has a steak or a burger at least once a week."
    { personId: 'p-jack', proteins: ['red-meat'], minPerWeek: 1 },
  ],
  people: [
    {
      id: 'p-ed',
      name: 'Ed',
      ageBand: 'adult',
      portionFactor: 1.1,
      dietary: {
        avoidAllergens: [],
        dislikedIngredients: [],
        dislikedTags: [],
      },
    },
    {
      id: 'p-louise',
      name: 'Louise',
      ageBand: 'adult',
      portionFactor: 0.9,
      dietary: {
        avoidAllergens: [],
        dislikedIngredients: [],
        dislikedTags: [],
      },
    },
    {
      id: 'p-jack',
      name: 'Jack',
      ageBand: 'teen',
      portionFactor: 1.2,
      dietary: {
        avoidAllergens: [],
        dislikedIngredients: ['mushroom'],
        dislikedTags: [],
      },
    },
    {
      id: 'p-katie',
      name: 'Katie',
      ageBand: 'child',
      portionFactor: 0.7,
      dietary: {
        // Illustrates the dietary screen. Coeliac disease is an exclusion,
        // not a preference — the solver treats it as absolute.
        avoidAllergens: ['gluten'],
        dislikedIngredients: [],
        dislikedTags: [],
      },
    },
  ],
  absences: [
    // Both parents out on Thursday evening — the planner should notice that
    // only the kids are eating and prefer something they can manage.
    { personId: 'p-ed', day: 3, slot: 'dinner' },
    { personId: 'p-louise', day: 3, slot: 'dinner' },
    // Weekday lunches away from home.
    ...([0, 1, 2, 3, 4] as const).flatMap((day) => [
      { personId: 'p-jack', day, slot: 'lunch' as const },
      { personId: 'p-katie', day, slot: 'lunch' as const },
    ]),
  ],
  timeBudgets: [
    // Weeknight dinners are the constraint that actually decides whether a
    // plan survives contact with a Tuesday.
    { day: 0, slot: 'dinner', maxActiveMinutes: 25 },
    { day: 1, slot: 'dinner', maxActiveMinutes: 20 },
    { day: 2, slot: 'dinner', maxActiveMinutes: 25 },
    { day: 3, slot: 'dinner', maxActiveMinutes: 20 },
    { day: 4, slot: 'dinner', maxActiveMinutes: 30 },
    { day: 5, slot: 'dinner', maxActiveMinutes: 60 },
    { day: 6, slot: 'dinner', maxActiveMinutes: 60 },
    ...([0, 1, 2, 3, 4] as const).map((day) => ({
      day,
      slot: 'breakfast' as const,
      maxActiveMinutes: 12,
    })),
  ],
};
