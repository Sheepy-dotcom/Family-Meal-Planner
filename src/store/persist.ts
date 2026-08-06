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
  session: 'mp.session.v1',
  syncCode: 'mp.sync.code.v1',
  syncVersion: 'mp.sync.version.v1',
} as const;

/**
 * The keys that make up a household's shared state — everything a second phone
 * should see. Deliberately excludes the device-local session id and the sync
 * bookkeeping itself: those identify *this* install, not the household.
 */
const SYNCABLE_KEYS: string[] = [
  KEYS.household,
  KEYS.plan,
  KEYS.history,
  KEYS.feedback,
  KEYS.dismissed,
  KEYS.retailer,
  KEYS.weights,
  KEYS.recipes,
  KEYS.pantry,
];

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

/**
 * A stable, opaque id for this install, minted once and kept.
 *
 * It carries no personal data — it exists only so the pattern-reader endpoint
 * can rate-limit one household without us sending anything that identifies them.
 */
export function loadSessionId(): string {
  const existing = read<string | null>(KEYS.session, null);
  if (existing) return existing;
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `s-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  write(KEYS.session, id);
  return id;
}

// ---------------------------------------------------------------------------
// Cross-device sync
// ---------------------------------------------------------------------------

/** A raw snapshot of the shared state — the exact strings storage holds. */
export function exportState(): Record<string, string> {
  const blob: Record<string, string> = {};
  for (const key of SYNCABLE_KEYS) {
    const raw = readRaw(key);
    if (raw != null) blob[key] = raw;
  }
  return blob;
}

/**
 * Overwrite local shared state with a snapshot from another device. Only the
 * known syncable keys are touched — a malformed or hostile blob can't plant
 * arbitrary storage entries — and a key the snapshot omits is cleared locally,
 * so both devices converge on exactly the same state.
 */
export function applyState(blob: Record<string, unknown>): void {
  for (const key of SYNCABLE_KEYS) {
    const value = blob[key];
    if (typeof value === 'string') writeRaw(key, value);
    else removeRaw(key);
  }
}

export function loadSyncCode(): string | null {
  return readRaw(KEYS.syncCode);
}

export function saveSyncCode(code: string): void {
  writeRaw(KEYS.syncCode, code);
}

export function clearSyncCode(): void {
  removeRaw(KEYS.syncCode);
  removeRaw(KEYS.syncVersion);
}

export function loadSyncVersion(): number {
  const raw = readRaw(KEYS.syncVersion);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function saveSyncVersion(version: number): void {
  writeRaw(KEYS.syncVersion, String(version));
}

export function clearAll(): void {
  for (const key of Object.values(KEYS)) removeRaw(key);
}
