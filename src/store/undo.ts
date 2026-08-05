import type { Household, MealPlan } from '../core/types.js';

/**
 * Undo for the two things the app mutates: the household and the plan.
 *
 * Almost every feature added so far is one-way — accepting a suggestion,
 * repairing a broken meal, toggling someone out of a dinner. Individually
 * each is small; together they make people cautious, and a planner people
 * are cautious with is one they use less.
 *
 * Deliberately a snapshot stack rather than an inverse-operation log. The
 * state is small (a household and a week of meals), snapshots can't drift out
 * of sync with the operations that produced them, and adding a new mutating
 * feature needs no corresponding "how do I reverse this" code — which is
 * exactly the kind of thing that gets forgotten and ships broken.
 */

export interface Snapshot {
  label: string;
  household: Household;
  plan: MealPlan | null;
  at: number;
}

/** Deep enough for a session's worth of second thoughts, shallow enough to stay cheap. */
const MAX_DEPTH = 20;

export class UndoStack {
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];

  /**
   * Record the state *before* a change, with a label describing what's about
   * to happen. Labels are user-facing — "Undo retiring Spaghetti bolognese"
   * tells you what you're getting back; "Undo action" does not.
   */
  push(label: string, household: Household, plan: MealPlan | null): void {
    this.past.push({
      label,
      household: structuredClone(household),
      plan: plan ? structuredClone(plan) : null,
      at: Date.now(),
    });
    if (this.past.length > MAX_DEPTH) this.past.shift();
    // A new action invalidates anything that was redoable.
    this.future = [];
  }

  /** What undoing would reverse, for the button label. */
  peek(): string | null {
    return this.past.at(-1)?.label ?? null;
  }

  peekRedo(): string | null {
    return this.future.at(-1)?.label ?? null;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Step back. The caller passes current state so it can be stashed for redo —
   * the stack never reaches into the app to read it.
   */
  undo(
    currentHousehold: Household,
    currentPlan: MealPlan | null,
  ): Snapshot | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push({
      label: previous.label,
      household: structuredClone(currentHousehold),
      plan: currentPlan ? structuredClone(currentPlan) : null,
      at: Date.now(),
    });
    return previous;
  }

  redo(currentHousehold: Household, currentPlan: MealPlan | null): Snapshot | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push({
      label: next.label,
      household: structuredClone(currentHousehold),
      plan: currentPlan ? structuredClone(currentPlan) : null,
      at: Date.now(),
    });
    return next;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }

  get depth(): number {
    return this.past.length;
  }
}
