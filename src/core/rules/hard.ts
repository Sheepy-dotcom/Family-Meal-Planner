import { getRecipe } from '../data/registry.js';
import type { DayIndex, MealSlot, PlannedMeal, Recipe, RuleViolation } from '../types.js';
import {
  DAY_NAMES,
  allergensIn,
  attendeesFor,
  ingredientIdsIn,
  type RuleContext,
} from './context.js';
import { compileHardRules } from './custom.js';
import { dietAllows, DIET_LABELS } from '../people/diet.js';

/**
 * Hard rules are checked per candidate meal *before* it is ever placed, and
 * again across the finished plan. They are deliberately not left to the
 * language model or to the scoring function — a rule that can be traded away
 * for a better overall score is not a hard rule.
 */

export interface HardRule {
  id: string;
  label: string;
  /**
   * Whether this rule applies to a planned-over — a meal that was cooked
   * earlier in the week rather than being cooked again.
   *
   * Some hard rules are about the *act of cooking*: a time budget and a repeat
   * limit are meaningless for food that already exists in the fridge. Others
   * are about the *food*: an allergen is still an allergen on Tuesday. Getting
   * this split wrong either blocks every planned-over or lets one carry a dish
   * to someone who can't eat it.
   *
   * Defaults to true — a rule has to opt out deliberately.
   */
  appliesToPlannedOvers?: boolean;
  /**
   * Can this recipe go in this slot at all?
   *
   * `placed` holds the meals already committed in the plan being built, for
   * rules that are about the week rather than the dish. It runs inside the
   * solver's inner loop, so keep it cheap.
   */
  allows(
    recipe: Recipe,
    day: DayIndex,
    slot: MealSlot,
    ctx: RuleContext,
    placed?: PlannedMeal[],
  ): boolean;
  /** Explanation used when a pinned or user-chosen meal breaks the rule. */
  explain(recipe: Recipe, day: DayIndex, slot: MealSlot, ctx: RuleContext): string;
  /**
   * Optional positive framing for the explain feature: the constraint this
   * rule places on a slot, phrased as a reason the chosen dish is here (e.g.
   * "fish is off the menu at weekends"). Returns null when it doesn't bind that
   * slot. Built-in rules are phrased in explain.ts; custom rules supply it here
   * so they're surfaced with no special casing.
   */
  constraintClause?(day: DayIndex, slot: MealSlot, ctx: RuleContext): string | null;
}

/**
 * How often one dish may appear in a single week.
 *
 * Without this the solver finds a degenerate optimum: repeating a dish
 * maximises ingredient reuse and costs less than it gains, so you get the same
 * breakfast seven days running. Variety isn't a preference to be traded away —
 * it's the reason someone opened a meal planner instead of cooking pasta again.
 */
const MAX_PER_WEEK: Record<MealSlot, number> = {
  breakfast: 2,
  lunch: 2,
  dinner: 1,
  snack: 3,
};

const repeatLimit: HardRule = {
  id: 'repeat-limit',
  label: 'No dish on repeat',
  // A planned-over is one cook, eaten twice — not a repeat.
  appliesToPlannedOvers: false,
  allows: (recipe, _day, slot, _ctx, placed) => {
    if (!placed) return true;
    // Planned-overs aren't a second cook, so they don't count against variety.
    const already = placed.filter(
      (m) => m.recipeId === recipe.id && m.source !== 'planned-over',
    ).length;
    // A dish that works at breakfast and lunch still counts once overall.
    return already < MAX_PER_WEEK[slot];
  },
  explain: (recipe, _day, slot) =>
    `${recipe.name} is already on the plan as many times as a ${slot} dish should be`,
};

// ---------------------------------------------------------------------------

/** The dish must be one the recipe author intended for this slot. */
const slotFit: HardRule = {
  id: 'slot-fit',
  label: 'Dish suits the meal',
  allows: (recipe, _day, slot) => recipe.slots.includes(slot),
  explain: (recipe, _d, slot) => `${recipe.name} isn't set up as a ${slot} dish`,
};

/**
 * Dietary exclusions for everyone actually eating that meal.
 *
 * Note the scope: if Katie is out, a gluten-containing dish is allowed. That
 * is the correct behaviour and also the reason the UI still shows the allergen
 * badge — the plan can change after the shop.
 */
const dietaryExclusions: HardRule = {
  id: 'dietary-exclusions',
  label: 'Dietary exclusions respected',
  allows: (recipe, day, slot, ctx) => {
    const present = attendeesFor(ctx.household, day, slot);
    if (present.length === 0) return true;
    const allergens = allergensIn(recipe);
    return present.every((p) =>
      p.dietary.avoidAllergens.every((a) => !allergens.has(a)),
    );
  },
  explain: (recipe, day, slot, ctx) => {
    const allergens = allergensIn(recipe);
    const clashes = attendeesFor(ctx.household, day, slot).flatMap((p) =>
      p.dietary.avoidAllergens
        .filter((a) => allergens.has(a))
        .map((a) => `${p.name} avoids ${a}`),
    );
    return `${recipe.name}: ${clashes.join(', ')}`;
  },
};

/**
 * Diets, per diner. A vegan is never offered a dish with an animal protein, a
 * vegetarian never meat or fish, a pescatarian never meat. Same scope as the
 * allergen rule: only the people actually at that meal count, so a meat dish is
 * fine on a night the vegetarian is out.
 */
const dietRespected: HardRule = {
  id: 'diet-respected',
  label: 'Diets respected',
  allows: (recipe, day, slot, ctx) => {
    const present = attendeesFor(ctx.household, day, slot);
    if (present.length === 0) return true;
    return present.every((p) => dietAllows(p.dietary.diet, recipe.proteins));
  },
  explain: (recipe, day, slot, ctx) => {
    const clashes = attendeesFor(ctx.household, day, slot)
      .filter((p) => !dietAllows(p.dietary.diet, recipe.proteins))
      .map((p) => `${p.name} is ${DIET_LABELS[p.dietary.diet ?? 'omnivore'].toLowerCase()}`);
    return `${recipe.name}: ${clashes.join(', ')}`;
  },
};

/** Ingredients the user has asked to keep out of the plan this week. */
const weeklyAvoidList: HardRule = {
  id: 'weekly-avoid',
  label: 'Weekly avoid list respected',
  allows: (recipe, _day, _slot, ctx) => {
    const avoid = ctx.weekNotes?.avoidIngredientIds ?? [];
    if (avoid.length === 0) return true;
    const used = ingredientIdsIn(recipe);
    return avoid.every((id) => !used.has(id));
  },
  explain: (recipe) => `${recipe.name} uses something on this week's avoid list`,
};

/**
 * No fish on Friday, Saturday or Sunday evenings.
 *
 * This is the shape of rule that makes the product: arbitrary, specific to one
 * household, and impossible to get from a recipe site. It is data-driven in a
 * real build — kept explicit here so the intent is readable.
 */
const noFishAtWeekendDinners: HardRule = {
  id: 'no-weekend-fish',
  label: 'No fish Fri/Sat/Sun evenings',
  allows: (recipe, day, slot) => {
    if (slot !== 'dinner') return true;
    if (day < 4) return true; // Mon–Thu
    return !recipe.proteins.some((p) => p === 'fish' || p === 'shellfish');
  },
  explain: (recipe, day) =>
    `${recipe.name} is a fish dish and ${DAY_NAMES[day]} evening is fish-free`,
};

/** Hands-on time has to fit the evening it lands on. */
const timeBudget: HardRule = {
  id: 'time-budget',
  label: 'Fits the time available',
  // Reheating leftovers costs no hands-on time.
  appliesToPlannedOvers: false,
  allows: (recipe, day, slot, ctx) => {
    const budget = ctx.household.timeBudgets.find(
      (b) => b.day === day && b.slot === slot,
    );
    if (!budget) return true;
    return recipe.activeMinutes <= budget.maxActiveMinutes;
  },
  explain: (recipe, day, slot, ctx) => {
    const budget = ctx.household.timeBudgets.find(
      (b) => b.day === day && b.slot === slot,
    );
    return `${recipe.name} needs ${recipe.activeMinutes} min hands-on; ${DAY_NAMES[day]} ${slot} allows ${budget?.maxActiveMinutes}`;
  },
};

/**
 * When no adult is eating, the dish has to be one the kids can finish.
 * Encodes "flag an easy kids' dinner when both parents are out".
 */
const adultFreeSlotsAreEasy: HardRule = {
  id: 'kids-alone-easy',
  label: 'Kid-manageable when adults are out',
  // Food already cooked is the easiest possible option for a kids' night.
  appliesToPlannedOvers: false,
  allows: (recipe, day, slot, ctx) => {
    const present = attendeesFor(ctx.household, day, slot);
    if (present.length === 0) return true;
    const anyAdult = present.some((p) => p.ageBand === 'adult');
    if (anyAdult) return true;
    return recipe.tags.includes('kid-easy') || recipe.tags.includes('make-ahead');
  },
  explain: (recipe, day) =>
    `No adult eating on ${DAY_NAMES[day]}, and ${recipe.name} isn't a dish the kids can finish alone`,
};

/**
 * Dishes the household has explicitly retired, via an accepted suggestion or
 * the settings screen. Hard rather than soft: "never show me this again" means
 * never, not "score it slightly lower".
 */
const blockedDishes: HardRule = {
  id: 'blocked-dishes',
  label: 'Retired dishes stay retired',
  allows: (recipe, _day, _slot, ctx) =>
    !(ctx.household.blockedRecipeIds ?? []).includes(recipe.id),
  explain: (recipe) => `${recipe.name} has been retired from the rotation`,
};

/** The built-in hard rules every household starts with. */
export const HARD_RULES: HardRule[] = [
  slotFit,
  blockedDishes,
  dietaryExclusions,
  dietRespected,
  weeklyAvoidList,
  noFishAtWeekendDinners,
  timeBudget,
  adultFreeSlotsAreEasy,
  repeatLimit,
];

/**
 * The hard rules in force for a context: the built-ins plus whatever the
 * household has authored. Every consumer — the solver, feasibility, explain —
 * reads through this, so a user rule is indistinguishable from a built-in.
 */
export function hardRulesFor(ctx: RuleContext): HardRule[] {
  const custom = ctx.household.customRules;
  if (!custom || custom.length === 0) return HARD_RULES;
  return [...HARD_RULES, ...compileHardRules(custom)];
}

/**
 * Can this dish be carried into this slot as a planned-over?
 * Checks only the rules that survive not being cooked again.
 */
export function isAllowedAsPlannedOver(
  recipe: Recipe,
  day: DayIndex,
  slot: MealSlot,
  ctx: RuleContext,
): boolean {
  return hardRulesFor(ctx)
    .filter((r) => r.appliesToPlannedOvers !== false)
    .every((rule) => rule.allows(recipe, day, slot, ctx));
}

/** Candidate filter used by the solver. */
export function isAllowed(
  recipe: Recipe,
  day: DayIndex,
  slot: MealSlot,
  ctx: RuleContext,
  placed?: PlannedMeal[],
): boolean {
  return hardRulesFor(ctx).every((rule) => rule.allows(recipe, day, slot, ctx, placed));
}

/** Full-plan check. Should return empty for any solver-produced plan. */
export function findViolations(meals: PlannedMeal[], ctx: RuleContext): RuleViolation[] {
  const out: RuleViolation[] = [];
  const rules = hardRulesFor(ctx);
  for (const meal of meals) {
    const recipe = getRecipe(meal.recipeId);
    const others = meals.filter((m) => m !== meal);
    const applicable =
      meal.source === 'planned-over'
        ? rules.filter((r) => r.appliesToPlannedOvers !== false)
        : rules;
    for (const rule of applicable) {
      if (!rule.allows(recipe, meal.day, meal.slot, ctx, others)) {
        out.push({
          ruleId: rule.id,
          message: rule.explain(recipe, meal.day, meal.slot, ctx),
          day: meal.day,
          slot: meal.slot,
        });
      }
    }
  }
  return out;
}
