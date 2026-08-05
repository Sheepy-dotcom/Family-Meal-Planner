/**
 * Core domain types.
 *
 * Nothing in src/core imports React or touches the DOM. The engine must stay
 * runnable in Node so it can be tested headlessly and later moved server-side
 * when basket integration needs somewhere to keep credentials.
 */

// ---------------------------------------------------------------------------
// Units & quantities
// ---------------------------------------------------------------------------

/** Units authors may write in a recipe. */
export type Unit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'unit' // countable: 2 onions, 4 eggs
  | 'pinch';

/** Units the shopping list actually does arithmetic in. */
export type BaseUnit = 'g' | 'ml' | 'unit';

export interface Quantity {
  amount: number;
  unit: Unit;
}

export interface BaseQuantity {
  amount: number;
  unit: BaseUnit;
}

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

/**
 * The 14 allergens that must be declared under UK food law (FIC / Natasha's Law).
 * Kept as a closed union so a typo in recipe data is a compile error, not a
 * silent gap in the dietary screen.
 */
export type Allergen =
  | 'celery'
  | 'gluten'
  | 'crustaceans'
  | 'eggs'
  | 'fish'
  | 'lupin'
  | 'milk'
  | 'molluscs'
  | 'mustard'
  | 'nuts'
  | 'peanuts'
  | 'sesame'
  | 'soya'
  | 'sulphites';

export type Aisle =
  | 'produce'
  | 'meat-fish'
  | 'dairy-eggs'
  | 'bakery'
  | 'ambient'
  | 'world-foods'
  | 'herbs-spices'
  | 'frozen'
  | 'household';

export interface Ingredient {
  id: string;
  name: string;
  aisle: Aisle;
  /** Allergens inherent to the ingredient itself. Advisory, never definitive. */
  allergens: Allergen[];
  /**
   * Typical retail pack. The shopping list rounds up to whole packs so the
   * output is buyable rather than theoretically precise.
   */
  pack?: BaseQuantity;
  /** Grams per single `unit`, for ingredients recipes count rather than weigh. */
  gramsPerUnit?: number;
  /**
   * Grams per millilitre. Needed whenever a recipe measures something in
   * spoons that the shop sells by weight — a tablespoon of honey and a
   * tablespoon of cumin are not the same purchase.
   */
  gramsPerMl?: number;
  /** True for things almost everyone has in. Kept off the list by default. */
  staple?: boolean;
}

export interface RecipeIngredient {
  ingredientId: string;
  amount: number;
  unit: Unit;
  /** Not scaled with servings (e.g. "a pinch of salt", oil for the pan). */
  fixed?: boolean;
  note?: string;
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Day 0 = Monday. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Cuisine =
  | 'british'
  | 'italian'
  | 'indian'
  | 'mexican'
  | 'chinese'
  | 'japanese'
  | 'thai'
  | 'greek'
  | 'middle-eastern'
  | 'french'
  | 'north-african'
  | 'american'
  | 'spanish'
  | 'korean'
  | 'vietnamese'
  | 'turkish';

/**
 * Coarse protein classes. Deliberately not the same axis as `tags` — rules
 * about "fish twice a week" and "legumes three times" read off this.
 */
/**
 * Protein classes that carry real protein, as opposed to a supporting role.
 * Used by the protein emphasis; see README on why this stays qualitative.
 */
export type ProteinClass =
  | 'fish'
  | 'shellfish'
  | 'chicken'
  | 'red-meat'
  | 'pork'
  | 'egg'
  | 'legume'
  | 'dairy-protein'
  | 'meat-substitute'
  | 'none';

export type RecipeTag =
  | 'traybake'
  | 'salad'
  | 'pasta'
  | 'soup'
  | 'curry'
  | 'stir-fry'
  | 'roast'
  | 'sandwich'
  | 'grill'
  | 'one-pot'
  | 'batch-cooks'
  | 'kid-easy' // a child or babysitter could plausibly finish it
  | 'make-ahead'
  | 'no-cook' // assembly only: packs for a desk or a lunchbox
  | 'sweet';

export interface Recipe {
  id: string;
  name: string;
  /** Which slots this dish is appropriate for. Many work in more than one. */
  slots: MealSlot[];
  cuisine: Cuisine;
  proteins: ProteinClass[];
  tags: RecipeTag[];
  /** Number of adult portions the stated quantities make. */
  servings: number;
  /** Hands-on time. This is the number that decides whether a Tuesday works. */
  activeMinutes: number;
  /** Wall-clock time from starting to eating. */
  totalMinutes: number;
  ingredients: RecipeIngredient[];
  method: string[];
  /**
   * Sub-style for rules that care about variety within a family of dishes,
   * e.g. pasta sauces that shouldn't repeat inside a fortnight.
   */
  style?: string;
  /** Introduced recently — drives the "1–2 new dishes a week" rule. */
  isNew?: boolean;
}

// ---------------------------------------------------------------------------
// Household
// ---------------------------------------------------------------------------

export type AgeBand = 'child' | 'teen' | 'adult';

export interface DietaryProfile {
  /**
   * Hard exclusions. A meal containing any of these is never offered to a
   * person present at that meal. Advisory in the UI, absolute in the solver.
   */
  avoidAllergens: Allergen[];
  /** Ingredient ids this person won't eat. Preference, not safety. */
  dislikedIngredients: string[];
  /** Recipe tags to steer away from. */
  dislikedTags: RecipeTag[];
}

/**
 * What an adult wants out of their food, expressed as an emphasis rather than
 * a target.
 *
 * Deliberately not calories, weights or trends. This app has no nutrition data
 * and inventing precise figures from recipe tags would be dishonest — and a
 * daily number to hit is the part of diet tracking that does harm. A goal here
 * nudges what gets suggested and how much is served; nothing is counted.
 */
export type EatingGoal = 'balanced' | 'more-protein' | 'lighter';

export interface Person {
  id: string;
  name: string;
  ageBand: AgeBand;
  /** Portion multiplier relative to one adult serving. */
  portionFactor: number;
  dietary: DietaryProfile;
  /**
   * Adults only. Children's portions come from age band — a child should never
   * be shown a goal for their own eating.
   */
  goal?: EatingGoal;
}

/** Slot-level absence, e.g. "both parents out Thursday dinner". */
export interface AbsenceEntry {
  personId: string;
  day: DayIndex;
  slot: MealSlot;
}

export interface TimeBudget {
  day: DayIndex;
  slot: MealSlot;
  /** Maximum acceptable hands-on minutes for this slot. */
  maxActiveMinutes: number;
}

/**
 * "Jack has a steak or a burger at least once a week." Expressed as data so
 * the rule engine doesn't need to know anyone's name.
 */
export interface WeeklyProteinRequest {
  personId: string;
  proteins: ProteinClass[];
  /** Minimum times per week this person should get one of those proteins. */
  minPerWeek: number;
}

export interface Household {
  id: string;
  name: string;
  people: Person[];
  absences: AbsenceEntry[];
  timeBudgets: TimeBudget[];
  /** Slots the planner should fill. Not every family plans every snack. */
  plannedSlots: MealSlot[];
  weeklyProteinRequests: WeeklyProteinRequest[];
  /** Dishes the household has asked never to see again. */
  blockedRecipeIds?: string[];
  /** Dishes to bias towards — known hits. */
  favouredRecipeIds?: string[];
  /** Cuisines to serve less often. A preference, not a ban. */
  avoidedCuisines?: Cuisine[];
  /**
   * Recipe ids each person has said they like, keyed by person id.
   * Derived from feedback and refreshed by the app — stored on the household so
   * the rule engine stays a pure function of its context.
   */
  favouritesByPerson?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export interface PlannedMeal {
  day: DayIndex;
  slot: MealSlot;
  recipeId: string;
  /** Portions to cook, after attendance and portion factors. */
  portions: number;
  /** People eating this meal. */
  attendeeIds: string[];
  /** Set when the user has manually fixed this meal; the solver won't move it. */
  pinned?: boolean;
  /**
   * 'planned-over' means this was cooked earlier in the week, not again.
   * The shopping list and the repeat limit both check this.
   */
  source?: 'cooked' | 'planned-over';
  /** For planned-overs, where it was actually cooked. */
  cookedOn?: { day: DayIndex; slot: MealSlot };
}

export interface MealPlan {
  weekStartISO: string;
  householdId: string;
  meals: PlannedMeal[];
  /** Seed used to generate. Same seed + same inputs = same plan. */
  seed: number;
}

/** A previously cooked plan, used by rules with memory (e.g. fortnight rules). */
export interface PlanHistoryEntry {
  weekStartISO: string;
  recipeIds: string[];
}

// ---------------------------------------------------------------------------
// Rule results
// ---------------------------------------------------------------------------

export interface RuleViolation {
  ruleId: string;
  message: string;
  day?: DayIndex;
  slot?: MealSlot;
}

export type RuleStatus = 'met' | 'partial' | 'unmet';

export interface SoftRuleResult {
  ruleId: string;
  label: string;
  status: RuleStatus;
  /** 0–1. Feeds the solver's objective function. */
  score: number;
  weight: number;
  detail: string;
}

export interface PlanEvaluation {
  violations: RuleViolation[];
  soft: SoftRuleResult[];
  /** Weighted mean of soft scores, 0–1. Hard violations make a plan invalid. */
  totalScore: number;
  feasible: boolean;
}

// ---------------------------------------------------------------------------
// Shopping
// ---------------------------------------------------------------------------

export interface ShoppingLine {
  ingredientId: string;
  name: string;
  aisle: Aisle;
  /** True requirement, summed across the week. */
  needed: BaseQuantity;
  /** What you actually have to buy, rounded to whole packs. */
  buy: BaseQuantity;
  packsToBuy?: number;
  /** Recipes that contributed, so a swap can adjust the right lines. */
  usedBy: string[];
  allergens: Allergen[];
}

export interface ShoppingList {
  weekStartISO: string;
  linesByAisle: Record<Aisle, ShoppingLine[]>;
  /** Staples assumed in the cupboard, surfaced separately to check. */
  checkCupboard: ShoppingLine[];
}

// ---------------------------------------------------------------------------
// Dietary screening (advisory only — see README)
// ---------------------------------------------------------------------------

export interface DietaryFlag {
  personId: string;
  personName: string;
  ingredientId: string;
  ingredientName: string;
  allergen: Allergen;
  severity: 'exclusion' | 'preference';
}

export interface MealScreen {
  day: DayIndex;
  slot: MealSlot;
  recipeId: string;
  flags: DietaryFlag[];
}
