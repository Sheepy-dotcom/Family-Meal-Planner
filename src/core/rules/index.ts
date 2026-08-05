import type { PlanEvaluation, PlannedMeal } from '../types.js';
import { DEFAULT_TARGETS, DEFAULT_WEIGHTS, type PlannerTargets } from './config.js';
import type { RuleContext } from './context.js';
import { findViolations } from './hard.js';
import { evaluateSoftRules } from './soft.js';

export * from './context.js';
export * from './config.js';
export { HARD_RULES, isAllowed, isAllowedAsPlannedOver, findViolations } from './hard.js';
export { SOFT_RULES, evaluateSoftRules } from './soft.js';

export function evaluatePlan(
  meals: PlannedMeal[],
  ctx: RuleContext,
  targets: PlannerTargets = DEFAULT_TARGETS,
  weights: Record<string, number> = DEFAULT_WEIGHTS,
): PlanEvaluation {
  const violations = findViolations(meals, ctx);
  const soft = evaluateSoftRules(meals, ctx, targets, weights);
  const totalWeight = soft.reduce((s, r) => s + r.weight, 0);
  const totalScore =
    totalWeight === 0 ? 1 : soft.reduce((s, r) => s + r.score * r.weight, 0) / totalWeight;
  return { violations, soft, totalScore, feasible: violations.length === 0 };
}
