import { ALLERGENS } from '../data/allergens.js';
import type {
  Allergen,
  DayIndex,
  Household,
  MealSlot,
  Person,
  TimeBudget,
} from '../types.js';

/**
 * Five questions, then let the swaps do the rest.
 *
 * This is the single riskiest screen in the product. A twenty-field setup form
 * asking someone to enumerate their household's rules is how a meal planner
 * dies at signup — people don't know their own rules explicitly, and the ones
 * they'd type are not the ones that actually govern their week.
 *
 * So this asks only what genuinely can't be inferred from behaviour:
 *
 *  - **Who eats** — portion maths is wrong from meal one without it.
 *  - **Hard exclusions** — the one thing that must never be learned by trial.
 *  - **Weeknight time** — the constraint that decides whether a plan survives
 *    a Tuesday, and the one people are most reliably accurate about.
 *  - **Which meals to plan** — most households don't want all three.
 *  - **A starting lean** — one soft steer so week one isn't generic.
 *
 * Everything else (cuisines, dislikes, retired dishes, who wants steak on a
 * Friday) arrives through `learning/feedback.ts` as the household actually
 * uses the thing. The onboarding's job is to be short enough to finish.
 */

export type QuestionId =
  | 'people'
  | 'exclusions'
  | 'weeknight-time'
  | 'planned-slots'
  | 'lean';

export interface OnboardingAnswers {
  /** Names and rough ages. Portion factors are derived, not asked. */
  people: Array<{ name: string; ageBand: Person['ageBand'] }>;
  /** Per-person hard exclusions. Keyed by the person's index in `people`. */
  exclusions: Record<number, Allergen[]>;
  /** Realistic hands-on minutes on an ordinary weeknight. */
  weeknightMinutes: number;
  plannedSlots: MealSlot[];
  lean: Lean;
}

export type Lean = 'balanced' | 'more-fish' | 'more-veg' | 'quick' | 'batch';

export const LEAN_LABELS: Record<Lean, string> = {
  balanced: 'A bit of everything',
  'more-fish': 'More fish',
  'more-veg': 'More vegetarian',
  quick: 'Fast above all',
  batch: 'Cook once, eat twice',
};

/**
 * Portion factors by age band.
 *
 * Asking someone to score their own child's appetite on a 0.3–2.0 scale is the
 * kind of question that reads as homework. These defaults are close enough for
 * week one, and the settings screen is there for the household that cares.
 */
const PORTION_BY_AGE: Record<Person['ageBand'], number> = {
  adult: 1,
  teen: 1.2,
  child: 0.7,
};

export const DEFAULT_ANSWERS: OnboardingAnswers = {
  people: [{ name: '', ageBand: 'adult' }],
  exclusions: {},
  weeknightMinutes: 25,
  plannedSlots: ['dinner'],
  lean: 'balanced',
};

export interface Question {
  id: QuestionId;
  prompt: string;
  /** Why we're asking. Shown underneath — people answer better when they know. */
  why: string;
}

export const QUESTIONS: Question[] = [
  {
    id: 'people',
    prompt: 'Who eats here?',
    why: 'So portions are right from the first week, rather than cooking for four when three are home.',
  },
  {
    id: 'exclusions',
    prompt: 'Anything anyone must never eat?',
    why: "Allergies and intolerances only. Everyday dislikes are better learned from what you swap out — you don't have to list them.",
  },
  {
    id: 'weeknight-time',
    prompt: 'How long will you actually stand at the hob on a weeknight?',
    why: 'Hands-on time, not oven time. Be honest rather than aspirational — this is the setting that decides whether a plan survives a Tuesday.',
  },
  {
    id: 'planned-slots',
    prompt: 'Which meals should be planned?',
    why: 'Most households only want dinners. You can add the others later.',
  },
  {
    id: 'lean',
    prompt: 'Anything you want more of?',
    why: 'One steer so the first week is not generic. Everything else is learned from what you cook and what you swap.',
  },
];

export const TIME_OPTIONS = [
  { minutes: 15, label: '15 minutes', hint: 'Assembly and reheating' },
  { minutes: 25, label: '25 minutes', hint: 'A normal weeknight' },
  { minutes: 40, label: '40 minutes', hint: 'Happy to cook properly' },
  { minutes: 0, label: 'No limit', hint: 'Time is not the problem' },
] as const;

export const SLOT_OPTIONS: Array<{ slots: MealSlot[]; label: string }> = [
  { slots: ['dinner'], label: 'Dinners only' },
  { slots: ['lunch', 'dinner'], label: 'Lunches and dinners' },
  { slots: ['breakfast', 'lunch', 'dinner'], label: 'All three' },
];

export const ALLERGEN_CHOICES = ALLERGENS;

// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  problems: string[];
}

export function validateAnswers(answers: OnboardingAnswers): ValidationResult {
  const problems: string[] = [];

  const named = answers.people.filter((p) => p.name.trim().length > 0);
  if (named.length === 0) problems.push('Add at least one person.');

  const seen = new Set<string>();
  for (const person of named) {
    const key = person.name.trim().toLowerCase();
    if (seen.has(key)) problems.push(`More than one person called ${person.name.trim()}.`);
    seen.add(key);
  }

  if (answers.plannedSlots.length === 0) problems.push('Pick at least one meal to plan.');

  return { ok: problems.length === 0, problems };
}

/**
 * Turn answers into a household.
 *
 * Weekend time budgets are deliberately looser than the weeknight answer, and
 * omitted entirely when someone says "no limit" — an absent budget means no
 * constraint, which is cheaper to check than a very large number.
 */
export function buildHousehold(
  answers: OnboardingAnswers,
  id = 'household-1',
): Household {
  const people: Person[] = answers.people
    .filter((p) => p.name.trim().length > 0)
    .map((p, index) => ({
      id: `p-${slug(p.name)}-${index}`,
      name: p.name.trim(),
      ageBand: p.ageBand,
      portionFactor: PORTION_BY_AGE[p.ageBand],
      dietary: {
        avoidAllergens: answers.exclusions[index] ?? [],
        dislikedIngredients: [],
        dislikedTags: [],
      },
    }));

  const timeBudgets: TimeBudget[] = [];
  if (answers.weeknightMinutes > 0 && answers.plannedSlots.includes('dinner')) {
    for (const day of [0, 1, 2, 3, 4] as DayIndex[]) {
      timeBudgets.push({
        day,
        slot: 'dinner',
        maxActiveMinutes: answers.weeknightMinutes,
      });
    }
    // Weekends get double, floored at 45 — nobody's Saturday is as tight as
    // their Wednesday, and a budget that says otherwise blocks roasts.
    for (const day of [5, 6] as DayIndex[]) {
      timeBudgets.push({
        day,
        slot: 'dinner',
        maxActiveMinutes: Math.max(45, answers.weeknightMinutes * 2),
      });
    }
  }
  if (answers.plannedSlots.includes('breakfast')) {
    for (const day of [0, 1, 2, 3, 4] as DayIndex[]) {
      timeBudgets.push({ day, slot: 'breakfast', maxActiveMinutes: 12 });
    }
  }

  return {
    id,
    name: householdName(people),
    people,
    absences: [],
    timeBudgets,
    plannedSlots: answers.plannedSlots,
    weeklyProteinRequests: [],
  };
}

/**
 * The starting lean nudges rule weights rather than adding hard rules.
 *
 * A lean is a mood on a Tuesday evening, not a commitment. Encoding it as a
 * weight means it bends when it collides with something real, and it fades as
 * actual behaviour accumulates.
 */
export function weightsForLean(
  lean: Lean,
  base: Record<string, number>,
): Record<string, number> {
  const next = { ...base };
  switch (lean) {
    case 'more-fish':
      next['fish-frequency'] = (next['fish-frequency'] ?? 1) * 2;
      break;
    case 'more-veg':
      next['legume-frequency'] = (next['legume-frequency'] ?? 1) * 2;
      break;
    case 'quick':
      next['ingredient-overlap'] = (next['ingredient-overlap'] ?? 1) * 1.5;
      break;
    case 'batch':
      next['ingredient-overlap'] = (next['ingredient-overlap'] ?? 1) * 2;
      break;
    case 'balanced':
      break;
  }
  return next;
}

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'person';
}

function householdName(people: Person[]): string {
  if (people.length === 0) return 'My household';
  if (people.length === 1) return `${people[0].name}'s kitchen`;
  return `${people.map((p) => p.name).join(', ')}`;
}
