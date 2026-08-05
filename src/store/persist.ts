import { SEED_HOUSEHOLD } from '../core/data/household.js';
import { readRaw, writeRaw, removeRaw, hasRaw } from './storage.js';
import type { Household, MealPlan, PlanHistoryEntry, Recipe } from '../core/types.js';
import type { FeedbackEvent } from '../core/learning/feedback.js';
import { EMPTY_PANTRY } from '../core/pantry/pantry.js';
import type { Pantry } from '../core/pantry/pantry.js';

/**
 * Persistence, via the storage layer in `storage.ts` — which picks native
 * Preferences on device and localStorage on the web.
 *
 * Two rules ("no repeated pasta style within a fortnight", "don't repeat recent
 * dinners") read from history, so this isn't a nicety: without it those rules
 * can never fire and the planner quietly becomes a random recipe picker.
 *
 * This is also the first thing that has to move server-side, since history is
 * what makes the product worth signing into.
 */

const KEYS = {
  household: 'mp.household.v1',
  plan: 'mp.plan.v1',
  history: 'mp.history.v1',
  feedback: 'mp.feedback.v1',
  dismissed: 'mp.dismissed.v1',
  retailer: 'mp.retailer.v1',
  weights: 'mp.weights.v1',
  recipes: 'mp.recipes.v1',
  pantry: 'mp.pantry.v1',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = readRaw(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch {
    // Quota, or storage disabled. The app stays usable for this session.
  }
}

/** True once someone has either onboarded or opted into the sample data. */
export function hasHousehold(): boolean {
  return hasRaw(KEYS.household);
}

export function loadHousehold(): Household {
  return read<Household>(KEYS.household, SEED_HOUSEHOLD);
}

export function loadWeights(): Record<string, number> | null {
  return read<Record<string, number> | null>(KEYS.weights, null);
}

export function saveWeights(weights: Record<string, number>): void {
  write(KEYS.weights, weights);
}

export function saveHousehold(household: Household): void {
  write(KEYS.household, household);
}

export function loadPlan(): MealPlan | null {
  return read<MealPlan | null>(KEYS.plan, null);
}

export function savePlan(plan: MealPlan): void {
  write(KEYS.plan, plan);
}

export function loadHistory(): PlanHistoryEntry[] {
  return read<PlanHistoryEntry[]>(KEYS.history, []);
}

/**
 * Called when a week is finished, not when it's generated. A plan that was
 * never cooked shouldn't stop the same dish appearing next week.
 */
export function archiveWeek(plan: MealPlan): PlanHistoryEntry[] {
  const history = loadHistory().filter((h) => h.weekStartISO !== plan.weekStartISO);
  const next = [
    ...history,
    { weekStartISO: plan.weekStartISO, recipeIds: plan.meals.map((m) => m.recipeId) },
  ].slice(-8);
  write(KEYS.history, next);
  return next;
}

export function loadFeedback(): FeedbackEvent[] {
  return read<FeedbackEvent[]>(KEYS.feedback, []);
}

/**
 * Feedback accumulates rather than being summarised on write. The inference
 * rules will change; the raw events are what let old behaviour be re-read
 * under a new rule without asking the household anything again.
 */
export function recordFeedback(events: FeedbackEvent[]): FeedbackEvent[] {
  const next = [...loadFeedback(), ...events].slice(-500);
  write(KEYS.feedback, next);
  return next;
}

/** Proposals the household has said no to. Asking twice is nagging. */
export function loadDismissed(): string[] {
  return read<string[]>(KEYS.dismissed, []);
}

export function dismissProposal(proposalId: string): string[] {
  const next = [...new Set([...loadDismissed(), proposalId])];
  write(KEYS.dismissed, next);
  return next;
}

export function loadRetailer(): string {
  return read<string>(KEYS.retailer, 'manual');
}

export function saveRetailer(id: string): void {
  write(KEYS.retailer, id);
}

export function loadUserRecipes(): Recipe[] {
  return read<Recipe[]>(KEYS.recipes, []);
}

export function saveUserRecipes(recipes: Recipe[]): void {
  write(KEYS.recipes, recipes);
}

export function loadPantry(): Pantry {
  return read<Pantry>(KEYS.pantry, EMPTY_PANTRY);
}

export function savePantry(pantry: Pantry): void {
  write(KEYS.pantry, pantry);
}

export function clearAll(): void {
  for (const key of Object.values(KEYS)) removeRaw(key);
}
