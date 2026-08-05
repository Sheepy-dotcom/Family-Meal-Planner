import { getRecipe } from '../data/registry.js';
import { DAY_NAMES, attendeesFor, portionsFor } from '../rules/context.js';
import type { RuleContext } from '../rules/context.js';
import { findViolations } from '../rules/hard.js';
import type { MealPlan, PlannedMeal, RuleViolation } from '../types.js';
import { reroll } from './solver.js';

/**
 * Keeping a plan honest when the week changes underneath it.
 *
 * Attendance is the thing that actually moves. Someone's out Thursday, a child
 * is home for lunch, a parent's away Friday — this happens every week, and a
 * planner that makes you regenerate the whole thing to absorb it is one people
 * stop bothering with.
 *
 * Two distinct consequences, which need separating:
 *
 *  - **Portions go stale.** Cheap and always safe to fix silently.
 *  - **Meals can become illegal.** Thursday's dish was fine when an adult was
 *    eating; with only children at the table it may no longer be. That is not
 *    safe to fix silently, because the household chose that dish.
 *
 * So `reconcile` does the arithmetic and *reports* the breakages. Repairing
 * them is a separate, explicit call.
 */

export interface ReconcileResult {
  plan: MealPlan;
  /** Meals whose portion count changed. Already applied. */
  reportioned: Array<{
    day: PlannedMeal['day'];
    slot: PlannedMeal['slot'];
    from: number;
    to: number;
  }>;
  /** Meals that no longer satisfy a hard rule. Not touched. */
  broken: RuleViolation[];
  /** Slots where nobody is eating any more. Not touched. */
  emptied: Array<{ day: PlannedMeal['day']; slot: PlannedMeal['slot'] }>;
}

export function reconcilePlan(plan: MealPlan, ctx: RuleContext): ReconcileResult {
  const reportioned: ReconcileResult['reportioned'] = [];
  const emptied: ReconcileResult['emptied'] = [];

  const meals: PlannedMeal[] = plan.meals.map((meal) => {
    const attendees = attendeesFor(ctx.household, meal.day, meal.slot);

    if (attendees.length === 0) {
      emptied.push({ day: meal.day, slot: meal.slot });
      return meal;
    }

    const portions = portionsFor(attendees);
    const attendeeIds = attendees.map((p) => p.id);
    const changed =
      portions !== meal.portions ||
      attendeeIds.length !== meal.attendeeIds.length ||
      !attendeeIds.every((id) => meal.attendeeIds.includes(id));

    if (!changed) return meal;

    if (portions !== meal.portions) {
      reportioned.push({
        day: meal.day,
        slot: meal.slot,
        from: meal.portions,
        to: portions,
      });
    }

    return { ...meal, portions, attendeeIds };
  });

  // Drop meals nobody is eating. Cooking for an empty table is the one change
  // that's unambiguous enough to make without asking.
  const kept = meals.filter(
    (m) => !emptied.some((e) => e.day === m.day && e.slot === m.slot),
  );

  const next: MealPlan = { ...plan, meals: kept };
  // findViolations reads through hardRulesFor, so a meal broken by a household's
  // own rule is caught here just like one broken by a built-in.
  return { plan: next, reportioned, broken: findViolations(kept, ctx), emptied };
}

export interface RepairResult {
  plan: MealPlan;
  /** What was swapped, so the change can be explained rather than just happening. */
  changes: Array<{ day: PlannedMeal['day']; slot: PlannedMeal['slot']; from: string; to: string }>;
  /** Slots that couldn't be repaired at all. */
  unfixable: RuleViolation[];
}

/**
 * Re-roll only the broken meals, leaving everything else pinned.
 *
 * Deliberately not a full regenerate: the household may already have shopped,
 * and rewriting Monday because Thursday changed is exactly the behaviour that
 * makes a planner untrustworthy.
 */
export function repairPlan(
  plan: MealPlan,
  ctx: RuleContext,
  broken: RuleViolation[],
): RepairResult {
  const slots = dedupeSlots(broken);
  const changes: RepairResult['changes'] = [];
  const unfixable: RuleViolation[] = [];

  let current = plan;

  for (const slot of slots) {
    const before = current.meals.find(
      (m) => m.day === slot.day && m.slot === slot.slot,
    );
    if (!before) continue;

    const attempt = reroll(current, { day: slot.day, slot: slot.slot }, ctx);
    const after = attempt.plan.meals.find(
      (m) => m.day === slot.day && m.slot === slot.slot,
    );

    const stillBroken = findViolations(attempt.plan.meals, ctx).some(
      (v) => v.day === slot.day && v.slot === slot.slot,
    );

    if (!after || stillBroken || after.recipeId === before.recipeId) {
      unfixable.push({
        ruleId: 'unrepairable',
        message: `Nothing else fits ${DAY_NAMES[slot.day]} ${slot.slot}. Change who's eating, or relax a rule.`,
        day: slot.day,
        slot: slot.slot,
      });
      continue;
    }

    changes.push({
      day: slot.day,
      slot: slot.slot,
      from: getRecipe(before.recipeId).name,
      to: getRecipe(after.recipeId).name,
    });
    current = attempt.plan;
  }

  return { plan: current, changes, unfixable };
}

function dedupeSlots(
  violations: RuleViolation[],
): Array<{ day: NonNullable<RuleViolation['day']>; slot: NonNullable<RuleViolation['slot']> }> {
  const seen = new Set<string>();
  const out: Array<{
    day: NonNullable<RuleViolation['day']>;
    slot: NonNullable<RuleViolation['slot']>;
  }> = [];
  for (const v of violations) {
    if (v.day === undefined || v.slot === undefined) continue;
    const key = `${v.day}:${v.slot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ day: v.day, slot: v.slot });
  }
  return out;
}
