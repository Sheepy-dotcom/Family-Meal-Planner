import { getIngredient } from '../data/ingredients.js';
import { getRecipe } from '../data/registry.js';
import { attendeesFor } from '../rules/context.js';
import type { RuleContext } from '../rules/context.js';
import { proposeRules, favouritesFor, dishVerdicts } from '../learning/feedback.js';
import type { FeedbackEvent } from '../learning/feedback.js';
import type {
  Allergen,
  Cuisine,
  DayIndex,
  MealPlan,
  MealSlot,
  Person,
  ProteinClass,
  RecipeTag,
} from '../types.js';

/**
 * One person's week.
 *
 * The week view answers "what is the household eating?", which is the right
 * default. But a household is not a unit — a child eating packed lunches sees a
 * very different week from the parent who cooks, and nothing in the app made
 * that visible. This is where you find out that someone has had the same three
 * lunches for a fortnight, or that a standing request quietly went unmet.
 *
 * Everything here is derived. No per-person state is stored, so this view can
 * never disagree with the plan it describes.
 */

export interface PersonMeal {
  day: DayIndex;
  slot: MealSlot;
  recipeId: string;
  recipeName: string;
  cuisine: Cuisine;
  proteins: ProteinClass[];
  tags: RecipeTag[];
  /** They're eating it, but it was cooked earlier in the week. */
  reheated: boolean;
  /** No adult at this meal. */
  cookingAlone: boolean;
}

export interface RuleStatusLine {
  label: string;
  met: boolean;
  detail: string;
}

export interface AdvisoryFlag {
  day: DayIndex;
  slot: MealSlot;
  recipeName: string;
  allergens: Allergen[];
  message: string;
}

export interface PersonProfile {
  person: Person;
  /** Meals they're present for, in day order. */
  meals: PersonMeal[];
  /** Planned slots they're away for. */
  missed: Array<{ day: DayIndex; slot: MealSlot }>;
  /** Distinct dishes vs total meals — the repetition signal. */
  distinctDishes: number;
  proteinMix: Array<{ protein: ProteinClass; count: number }>;
  cuisineMix: Array<{ cuisine: Cuisine; count: number }>;
  /** Their exclusions, dislikes and standing requests, with this week's status. */
  rules: RuleStatusLine[];
  /** Meals containing something they exclude. Advisory, as everywhere. */
  flags: AdvisoryFlag[];
  /** Suggestions the app has attributed specifically to this person. */
  attributedSuggestions: Array<{ suggestion: string; evidence: string }>;
  /** Dishes they have said they like. Stated only, never inferred. */
  favourites: Array<{ recipeId: string; name: string }>;
  /** Dishes they have said no to. Stated only, never inferred. */
  dislikes: Array<{ recipeId: string; name: string }>;
  /** Their eating goal, if they have one. Adults only. */
  goal?: string;
  /** A plain sentence for the top of the view. */
  headline: string;
}

export function buildPersonProfile(
  personId: string,
  plan: MealPlan,
  ctx: RuleContext,
  feedback: FeedbackEvent[] = [],
): PersonProfile {
  const person = ctx.household.people.find((p) => p.id === personId);
  if (!person) throw new Error(`Unknown person: ${personId}`);

  const meals: PersonMeal[] = [];
  const missed: PersonProfile['missed'] = [];

  for (const meal of [...plan.meals].sort((a, b) => a.day - b.day)) {
    const attending = meal.attendeeIds.includes(personId);
    if (!attending) {
      missed.push({ day: meal.day, slot: meal.slot });
      continue;
    }
    const recipe = getRecipe(meal.recipeId);
    const present = attendeesFor(ctx.household, meal.day, meal.slot);
    meals.push({
      day: meal.day,
      slot: meal.slot,
      recipeId: recipe.id,
      recipeName: recipe.name,
      cuisine: recipe.cuisine,
      proteins: recipe.proteins,
      tags: recipe.tags,
      reheated: meal.source === 'planned-over',
      cookingAlone: !present.some((p) => p.ageBand === 'adult'),
    });
  }

  const proteinMix = tally(meals.flatMap((m) => m.proteins.filter((p) => p !== 'none')));
  const cuisineMix = tally(meals.map((m) => m.cuisine));

  return {
    person,
    meals,
    missed,
    distinctDishes: new Set(meals.map((m) => m.recipeId)).size,
    proteinMix: proteinMix.map(([protein, count]) => ({ protein, count })),
    cuisineMix: cuisineMix.map(([cuisine, count]) => ({ cuisine, count })),
    rules: buildRuleStatus(person, meals, ctx),
    flags: buildFlags(person, meals),
    favourites: favouritesFor(feedback, personId).flatMap((id) => {
      try {
        return [{ recipeId: id, name: getRecipe(id).name }];
      } catch {
        return [];
      }
    }),
    // Explicit dislikes, read off the same verdicts favourites come from.
    dislikes: dishVerdicts(feedback, ctx.household)
      .filter((v) => v.dislikedBy.includes(personId))
      .flatMap((v) => {
        try {
          return [{ recipeId: v.recipeId, name: getRecipe(v.recipeId).name }];
        } catch {
          return [];
        }
      }),
    goal: person.ageBand === 'adult' ? person.goal : undefined,
    attributedSuggestions: proposeRules(feedback, ctx.household)
      .filter((p) => p.personId === personId)
      .map((p) => ({ suggestion: p.suggestion, evidence: p.evidence })),
    headline: headlineFor(person, meals, missed),
  };
}

/**
 * Their rules, each with whether this week actually honours it.
 *
 * A settings screen tells you what a rule says. This tells you whether it's
 * being kept — which is the only version anyone cares about, and the thing that
 * was previously invisible without reading all 21 meals yourself.
 */
function buildRuleStatus(
  person: Person,
  meals: PersonMeal[],
  ctx: RuleContext,
): RuleStatusLine[] {
  const lines: RuleStatusLine[] = [];

  for (const allergen of person.dietary.avoidAllergens) {
    const breaches = meals.filter((m) =>
      getRecipe(m.recipeId).ingredients.some((ri) =>
        getIngredient(ri.ingredientId).allergens.includes(allergen),
      ),
    );
    lines.push({
      label: `No ${allergen}`,
      met: breaches.length === 0,
      detail:
        breaches.length === 0
          ? 'Nothing this week contains it'
          : `${breaches.length} meal${breaches.length === 1 ? '' : 's'} to check`,
    });
  }

  for (const ingredientId of person.dietary.dislikedIngredients) {
    const hits = meals.filter((m) =>
      getRecipe(m.recipeId).ingredients.some((ri) => ri.ingredientId === ingredientId),
    );
    lines.push({
      label: `Avoids ${getIngredient(ingredientId).name.toLowerCase()}`,
      met: hits.length === 0,
      detail: hits.length === 0 ? 'Not served this week' : `Served ${hits.length}×`,
    });
  }

  for (const tag of person.dietary.dislikedTags) {
    const hits = meals.filter((m) => m.tags.includes(tag));
    lines.push({
      label: `Fewer ${tag.replace('-', ' ')} dishes`,
      met: hits.length === 0,
      detail: hits.length === 0 ? 'None this week' : `${hits.length} this week`,
    });
  }

  for (const request of ctx.household.weeklyProteinRequests) {
    if (request.personId !== person.id) continue;
    const count = meals.filter((m) =>
      m.proteins.some((p) => request.proteins.includes(p)),
    ).length;
    lines.push({
      label: `${request.proteins.join(' or ').replace('-', ' ')} at least ${request.minPerWeek}×`,
      met: count >= request.minPerWeek,
      detail: `${count} this week`,
    });
  }

  return lines;
}

/** Advisory only — same wording rule as the rest of the app. */
function buildFlags(person: Person, meals: PersonMeal[]): AdvisoryFlag[] {
  const flags: AdvisoryFlag[] = [];
  for (const meal of meals) {
    const clashes = new Set<Allergen>();
    for (const item of getRecipe(meal.recipeId).ingredients) {
      for (const allergen of getIngredient(item.ingredientId).allergens) {
        if (person.dietary.avoidAllergens.includes(allergen)) clashes.add(allergen);
      }
    }
    if (clashes.size > 0) {
      flags.push({
        day: meal.day,
        slot: meal.slot,
        recipeName: meal.recipeName,
        allergens: [...clashes],
        message: `${meal.recipeName} contains ${[...clashes].join(', ')} — check the pack.`,
      });
    }
  }
  return flags;
}

/**
 * The sentence worth reading if you read nothing else.
 *
 * Repetition is the thing most worth surfacing: it's invisible in the week view
 * because each day looks fine on its own, and it's the most common reason
 * someone quietly stops enjoying the plan.
 */
function headlineFor(
  person: Person,
  meals: PersonMeal[],
  missed: PersonProfile['missed'],
): string {
  if (meals.length === 0) return `${person.name} isn't eating at home this week.`;

  const distinct = new Set(meals.map((m) => m.recipeId)).size;
  const away = missed.length > 0 ? `, away for ${missed.length}` : '';

  if (distinct <= meals.length / 2) {
    return `${person.name} eats ${meals.length} meals at home${away} — but only ${distinct} different dishes.`;
  }
  return `${person.name} eats ${meals.length} meals at home${away}, across ${distinct} different dishes.`;
}

function tally<T extends string>(values: T[]): Array<[T, number]> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}
