import { getRecipe } from '../data/registry.js';
import { isProteinForward } from '../people/goals.js';
import type { PlannedMeal, SoftRuleResult } from '../types.js';
import {
  DAY_NAMES,
  attendeesFor,
  dinnersInOrder,
  ingredientIdsIn,
  recentRecipeIds,
  recipesOf,
  type RuleContext,
} from './context.js';
import { DEFAULT_TARGETS, DEFAULT_WEIGHTS, type PlannerTargets } from './config.js';

/**
 * Soft rules score a whole plan from 0 to 1. The solver maximises the weighted
 * mean; the UI shows each one's status so the household can see exactly which
 * preference lost the argument this week.
 */
export interface SoftRule {
  id: string;
  label: string;
  evaluate(
    meals: PlannedMeal[],
    ctx: RuleContext,
    targets: PlannerTargets,
  ): Omit<SoftRuleResult, 'ruleId' | 'label' | 'weight'>;
}

/** Score a count against a min/max band: 1 inside, tapering outside. */
function bandScore(count: number, min: number, max: number): number {
  if (count >= min && count <= max) return 1;
  if (count < min) return min === 0 ? 1 : Math.max(0, count / min) * 0.9;
  const overBy = count - max;
  return Math.max(0, 1 - overBy * 0.25);
}

function statusFor(score: number): SoftRuleResult['status'] {
  if (score >= 0.999) return 'met';
  if (score >= 0.5) return 'partial';
  return 'unmet';
}

function result(score: number, detail: string) {
  return { score, status: statusFor(score), detail };
}

// ---------------------------------------------------------------------------

const proteinEveryMeal: SoftRule = {
  id: 'protein-every-meal',
  label: 'Protein at every meal',
  evaluate(meals) {
    if (meals.length === 0) return result(1, 'No meals planned');
    const without = meals.filter((m) => {
      const r = getRecipe(m.recipeId);
      return r.proteins.length === 0 || r.proteins.every((p) => p === 'none');
    });
    const score = 1 - without.length / meals.length;
    return result(
      score,
      without.length === 0
        ? 'Every meal carries a protein'
        : `${without.length} meal${without.length > 1 ? 's' : ''} without a clear protein`,
    );
  },
};

const fishFrequency: SoftRule = {
  id: 'fish-frequency',
  label: 'Fish 2–3 dinners a week',
  evaluate(meals, _ctx, targets) {
    const count = dinnersInOrder(meals).filter((m) =>
      getRecipe(m.recipeId).proteins.some((p) => p === 'fish' || p === 'shellfish'),
    ).length;
    const { min, max } = targets.fishDinnersPerWeek;
    return result(bandScore(count, min, max), `${count} fish dinner${count === 1 ? '' : 's'}`);
  },
};

const legumeFrequency: SoftRule = {
  id: 'legume-frequency',
  label: 'Legumes 2–3 times a week',
  evaluate(meals, _ctx, targets) {
    const count = meals.filter((m) =>
      getRecipe(m.recipeId).proteins.includes('legume'),
    ).length;
    const { min, max } = targets.legumeMealsPerWeek;
    return result(bandScore(count, min, max), `${count} legume-led meal${count === 1 ? '' : 's'}`);
  },
};

const saladFrequency: SoftRule = {
  id: 'salad-frequency',
  label: '1–2 substantial salads',
  evaluate(meals, _ctx, targets) {
    const count = meals.filter((m) => getRecipe(m.recipeId).tags.includes('salad')).length;
    const { min, max } = targets.saladsPerWeek;
    return result(bandScore(count, min, max), `${count} salad${count === 1 ? '' : 's'}`);
  },
};

const traybakeFrequency: SoftRule = {
  id: 'traybake-frequency',
  label: 'At least one traybake',
  evaluate(meals, _ctx, targets) {
    const count = meals.filter((m) => getRecipe(m.recipeId).tags.includes('traybake')).length;
    const { min } = targets.traybakesPerWeek;
    return result(
      bandScore(count, min, Number.POSITIVE_INFINITY),
      `${count} traybake${count === 1 ? '' : 's'}`,
    );
  },
};

/**
 * No two consecutive dinners from the same cuisine. Adjacency is the thing
 * people notice — two curries on Monday and Thursday is variety, two curries
 * back to back is a rut.
 */
const cuisineVariety: SoftRule = {
  id: 'cuisine-variety',
  label: 'No repeated cuisine on consecutive days',
  evaluate(meals) {
    const dinners = dinnersInOrder(meals);
    if (dinners.length < 2) return result(1, 'Not enough dinners to clash');
    let clashes: string[] = [];
    for (let i = 1; i < dinners.length; i++) {
      const prev = getRecipe(dinners[i - 1].recipeId);
      const cur = getRecipe(dinners[i].recipeId);
      if (prev.cuisine === cur.cuisine && dinners[i].day === dinners[i - 1].day + 1) {
        clashes.push(`${DAY_NAMES[dinners[i - 1].day]}/${DAY_NAMES[dinners[i].day]} both ${cur.cuisine}`);
      }
    }
    const score = 1 - clashes.length / (dinners.length - 1);
    return result(score, clashes.length === 0 ? 'No back-to-back repeats' : clashes.join('; '));
  },
};

/** Pasta sauces shouldn't repeat inside a fortnight — needs plan history. */
const pastaStyleVariety: SoftRule = {
  id: 'pasta-style-variety',
  label: 'Pasta styles vary across a fortnight',
  evaluate(meals, ctx, targets) {
    const thisWeek = recipesOf(meals).filter((r) => r.tags.includes('pasta'));
    const styles = thisWeek.map((r) => r.style ?? r.id);
    const recent = recentRecipeIds(ctx.history, targets.pastaStyleWindowWeeks);
    const recentStyles = new Set(
      [...recent]
        .map((id) => {
          try {
            return getRecipe(id);
          } catch {
            return null;
          }
        })
        .filter((r): r is NonNullable<typeof r> => !!r && r.tags.includes('pasta'))
        .map((r) => r.style ?? r.id),
    );

    const dupesWithinWeek = styles.length - new Set(styles).size;
    const dupesAgainstHistory = styles.filter((s) => recentStyles.has(s)).length;
    const total = dupesWithinWeek + dupesAgainstHistory;
    if (styles.length === 0) return result(1, 'No pasta this week');
    const score = Math.max(0, 1 - total / styles.length);
    return result(
      score,
      total === 0
        ? `${styles.length} pasta dish${styles.length === 1 ? '' : 'es'}, all different styles`
        : `${total} pasta style repeat${total === 1 ? '' : 's'} inside the window`,
    );
  },
};

const noRecentRepeats: SoftRule = {
  id: 'no-recent-repeats',
  label: "Don't repeat recent dinners",
  evaluate(meals, ctx, targets) {
    const recent = recentRecipeIds(ctx.history, targets.repeatWindowWeeks);
    // A deliberate planned-over is not the planner repeating itself.
    const ids = meals.filter((m) => m.source !== 'planned-over').map((m) => m.recipeId);
    const repeatsWithin = ids.length - new Set(ids).size;
    const repeatsFromHistory = ids.filter((id) => recent.has(id)).length;
    const total = repeatsWithin + repeatsFromHistory;
    if (ids.length === 0) return result(1, 'Nothing planned');
    const score = Math.max(0, 1 - total / ids.length);
    return result(
      score,
      total === 0 ? 'All fresh this fortnight' : `${total} dish${total === 1 ? '' : 'es'} seen recently`,
    );
  },
};

const novelty: SoftRule = {
  id: 'novelty',
  label: '1–2 new dishes to try',
  evaluate(meals, _ctx, targets) {
    const count = meals.filter((m) => getRecipe(m.recipeId).isNew).length;
    const { min, max } = targets.newDishesPerWeek;
    return result(bandScore(count, min, max), `${count} new dish${count === 1 ? '' : 'es'}`);
  },
};

const weeklyProteinRequests: SoftRule = {
  id: 'weekly-protein-requests',
  label: 'Personal weekly requests',
  evaluate(meals, ctx) {
    const requests = ctx.household.weeklyProteinRequests;
    if (requests.length === 0) return result(1, 'No standing requests');

    const details: string[] = [];
    let met = 0;
    for (const req of requests) {
      const person = ctx.household.people.find((p) => p.id === req.personId);
      const count = meals.filter((m) => {
        if (!m.attendeeIds.includes(req.personId)) return false;
        return getRecipe(m.recipeId).proteins.some((p) => req.proteins.includes(p));
      }).length;
      if (count >= req.minPerWeek) met++;
      details.push(`${person?.name ?? req.personId}: ${count}/${req.minPerWeek}`);
    }
    return result(met / requests.length, details.join(', '));
  },
};

/**
 * Reward reusing ingredients across the week. A plan that buys coriander for
 * one dish and throws half of it away is worse than one that uses it twice,
 * and this is the single easiest lever on both cost and waste.
 */
const ingredientOverlap: SoftRule = {
  id: 'ingredient-overlap',
  label: 'Ingredients pull their weight',
  evaluate(meals) {
    if (meals.length < 2) return result(1, 'Too few meals to compare');
    // Count each distinct recipe once. Cooking the same dish twice reuses its
    // own ingredients trivially, and rewarding that turns a variety engine
    // into a repetition engine.
    const distinctRecipes = [...new Set(meals.map((m) => m.recipeId))];
    const counts = new Map<string, number>();
    for (const recipeId of distinctRecipes) {
      for (const id of ingredientIdsIn(getRecipe(recipeId))) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    const distinct = counts.size;
    const singleUse = [...counts.values()].filter((c) => c === 1).length;
    const reuseRate = 1 - singleUse / distinct;
    // Perfect reuse is neither achievable nor desirable; 45% reuse scores full marks.
    const score = Math.min(1, reuseRate / 0.45);
    return result(
      score,
      `${Math.round(reuseRate * 100)}% of ingredients used more than once (${distinct} distinct)`,
    );
  },
};

const useUpIngredients: SoftRule = {
  id: 'use-up-ingredients',
  label: 'Uses up what you already have',
  evaluate(meals, ctx) {
    const wanted = ctx.weekNotes?.useUpIngredientIds ?? [];
    if (wanted.length === 0) return result(1, 'Nothing flagged to use up');
    const used = new Set(meals.flatMap((m) => [...ingredientIdsIn(getRecipe(m.recipeId))]));
    const hit = wanted.filter((id) => used.has(id));
    return result(
      hit.length / wanted.length,
      `${hit.length}/${wanted.length} flagged ingredients used`,
    );
  },
};

/** Dislikes are preferences, so they cost score rather than blocking a dish. */
const respectDislikes: SoftRule = {
  id: 'respect-dislikes',
  label: 'Avoids known dislikes',
  evaluate(meals, ctx) {
    let served = 0;
    const notes: string[] = [];
    for (const meal of meals) {
      const used = ingredientIdsIn(getRecipe(meal.recipeId));
      for (const person of attendeesFor(ctx.household, meal.day, meal.slot)) {
        const clash = person.dietary.dislikedIngredients.filter((id) => used.has(id));
        if (clash.length > 0) {
          served++;
          notes.push(`${person.name} on ${DAY_NAMES[meal.day]}`);
        }
      }
    }
    if (meals.length === 0) return result(1, 'Nothing planned');
    const score = Math.max(0, 1 - served / meals.length);
    return result(score, served === 0 ? 'No known dislikes served' : notes.join(', '));
  },
};

/** Learned preferences, kept soft so they bend rather than block. */
const learnedPreferences: SoftRule = {
  id: 'learned-preferences',
  label: 'Learned from your swaps',
  evaluate(meals, ctx) {
    const avoided = new Set(ctx.household.avoidedCuisines ?? []);
    const favoured = new Set(ctx.household.favouredRecipeIds ?? []);
    if (avoided.size === 0 && favoured.size === 0) {
      return result(1, 'Nothing learned yet');
    }
    if (meals.length === 0) return result(1, 'Nothing planned');

    const recipes = recipesOf(meals);
    const clashes = recipes.filter((r) => avoided.has(r.cuisine)).length;
    const hits = recipes.filter((r) => favoured.has(r.id)).length;

    // Serving a favourite offsets an avoided cuisine; neither is absolute.
    const penalty = clashes / meals.length;
    const bonus = Math.min(0.25, hits * 0.05);
    const score = Math.max(0, Math.min(1, 1 - penalty + bonus));

    const notes: string[] = [];
    if (clashes > 0) notes.push(`${clashes} from a cuisine you've been avoiding`);
    if (hits > 0) notes.push(`${hits} known hit${hits === 1 ? '' : 's'}`);
    return result(score, notes.join(', ') || 'Nothing learned applies this week');
  },
};

/**
 * Eating goals, as an emphasis among many.
 *
 * Someone wanting more protein gets protein-forward meals favoured on the days
 * they eat — not every day, and never at the cost of a hard rule. It's one
 * weighted preference sitting alongside a dozen others, which is the honest
 * strength for a signal derived from recipe tags rather than nutrition data.
 */
const eatingGoals: SoftRule = {
  id: 'eating-goals',
  label: 'Personal eating goals',
  evaluate(meals, ctx) {
    const wanting = ctx.household.people.filter(
      (p) => p.ageBand === 'adult' && p.goal === 'more-protein',
    );
    if (wanting.length === 0) return result(1, 'No goals set');

    const notes: string[] = [];
    let total = 0;

    for (const person of wanting) {
      const theirs = meals.filter((m) => m.attendeeIds.includes(person.id));
      if (theirs.length === 0) continue;
      const forward = theirs.filter((m) => isProteinForward(m.recipeId)).length;
      // Around half their meals being protein-forward scores full marks. A
      // household eats together; demanding every meal would make the plan
      // revolve around one person.
      const share = forward / theirs.length;
      total += Math.min(1, share / 0.5);
      notes.push(`${person.name}: ${forward}/${theirs.length} protein-forward`);
    }

    return result(wanting.length ? total / wanting.length : 1, notes.join(', '));
  },
};

/**
 * Meals people have actually said they like, served to the people who said it.
 *
 * Distinct from `learned-preferences`, which works from swaps. This uses stated
 * verdicts only, and it's the rule that makes "the app learns who likes what"
 * true rather than aspirational.
 */
const statedFavourites: SoftRule = {
  id: 'stated-favourites',
  label: 'Dishes people have said they like',
  evaluate(meals, ctx) {
    const favourites = ctx.household.favouritesByPerson;
    if (!favourites || Object.keys(favourites).length === 0) {
      return result(1, 'Nothing rated yet');
    }

    let hits = 0;
    const names: string[] = [];
    for (const meal of meals) {
      for (const personId of meal.attendeeIds) {
        if (favourites[personId]?.includes(meal.recipeId)) {
          hits++;
          const person = ctx.household.people.find((p) => p.id === personId);
          if (person && !names.includes(person.name)) names.push(person.name);
        }
      }
    }

    if (meals.length === 0) return result(1, 'Nothing planned');
    // A couple of known hits in a week is plenty; a week of nothing but
    // favourites is a rut, not a success.
    const score = Math.min(1, hits / 3);
    return result(
      score,
      hits === 0
        ? 'No known favourites this week'
        : `${hits} favourite${hits === 1 ? '' : 's'} for ${names.join(', ')}`,
    );
  },
};

export const SOFT_RULES: SoftRule[] = [
  learnedPreferences,
  eatingGoals,
  statedFavourites,
  proteinEveryMeal,
  fishFrequency,
  legumeFrequency,
  saladFrequency,
  traybakeFrequency,
  cuisineVariety,
  pastaStyleVariety,
  noRecentRepeats,
  novelty,
  weeklyProteinRequests,
  ingredientOverlap,
  useUpIngredients,
  respectDislikes,
];

export function evaluateSoftRules(
  meals: PlannedMeal[],
  ctx: RuleContext,
  targets: PlannerTargets = DEFAULT_TARGETS,
  weights: Record<string, number> = DEFAULT_WEIGHTS,
): SoftRuleResult[] {
  return SOFT_RULES.map((rule) => {
    const outcome = rule.evaluate(meals, ctx, targets);
    return {
      ruleId: rule.id,
      label: rule.label,
      weight: weights[rule.id] ?? 1,
      ...outcome,
    };
  });
}
