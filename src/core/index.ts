export * from './types.js';
export * from './units.js';
export { INGREDIENTS, getIngredient } from './data/ingredients.js';
export { RECIPES as BUILT_IN_RECIPES } from './data/recipes.js';
export {
  allRecipes,
  getRecipe,
  findRecipe,
  setUserRecipes,
  getUserRecipes,
  isUserRecipe,
  isOverriddenBuiltIn,
} from './data/registry.js';
export { SEED_HOUSEHOLD } from './data/household.js';
export { ALLERGENS, ALLERGEN_LABELS } from './data/allergens.js';
export { checkFeasibility, checkVariety } from './planner/feasibility.js';
export type { FeasibilityReport, SlotFeasibility } from './planner/feasibility.js';
export * from './rules/index.js';
export { generatePlan, reroll, explainRejection } from './planner/solver.js';
export type { SolveOptions, SolveResult, SlotRef } from './planner/solver.js';
export { buildShoppingList, allLines, aisleOrder, AISLE_LABELS } from './shopping/list.js';
export { screenPlan, flagShoppingList, flagSentence } from './diet/screen.js';
export type { FlaggedLine } from './diet/screen.js';
export type { BasketAdapter, BasketItem, BasketResult } from './basket/adapter.js';
export { manualExportAdapter } from './basket/manual.js';
export { RETAILERS, deepLinkAdapters, makeDeepLinkAdapter } from './basket/deeplink.js';
export type { Retailer, DeepLinkItem, DeepLinkResult } from './basket/deeplink.js';
export {
  QUESTIONS,
  TIME_OPTIONS,
  SLOT_OPTIONS,
  LEAN_LABELS,
  DEFAULT_ANSWERS,
  ALLERGEN_CHOICES,
  validateAnswers,
  buildHousehold,
  weightsForLean,
} from './onboarding/questions.js';
export type { OnboardingAnswers, Lean, Question } from './onboarding/questions.js';
export { validateRecipe, finaliseRecipe } from './recipes/validate.js';
export { scaleRecipeForMeal, timingFor } from './recipes/scale.js';
export { buildPersonProfile } from './people/profile.js';
export {
  proteinWeightOf,
  isProteinForward,
  portionFactorFor,
  canSetGoal,
  GOAL_LABELS,
  GOAL_HINTS,
} from './people/goals.js';
export { dishVerdicts, favouritesFor } from './learning/feedback.js';
export type { DishVerdict } from './learning/feedback.js';
export type { PersonProfile, PersonMeal, RuleStatusLine } from './people/profile.js';
export {
  EMPTY_PANTRY,
  pantryForWeek,
  applyPantry,
  toggleHave,
  toggleAlwaysStocked,
  pantrySummary,
  coverageNote,
} from './pantry/pantry.js';
export type { Pantry, PantryEntry, AdjustedList, AdjustedLine } from './pantry/pantry.js';
export type { ScaledRecipe, ScaledIngredient } from './recipes/scale.js';
export type { RecipeDraft, RecipeProblem, RecipeValidation } from './recipes/validate.js';
export { proposeRules, applyProposal, proteinMix } from './learning/feedback.js';
export { suggestPlannedOvers, applyPlannedOver, clearPlannedOvers } from './planner/leftovers.js';
export { reconcilePlan, repairPlan } from './planner/reconcile.js';
export { checkPlanIntegrity, dropOrphanedMeals, mealsUsing } from './planner/integrity.js';
export type { PlanIntegrity } from './planner/integrity.js';
export type { ReconcileResult, RepairResult } from './planner/reconcile.js';
export type { PlannedOverSuggestion } from './planner/leftovers.js';
export type { FeedbackEvent, FeedbackType, RuleProposal } from './learning/feedback.js';
