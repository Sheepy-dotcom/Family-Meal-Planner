import type { PlanEvaluation } from '../../core/types.js';

/**
 * The rule rail.
 *
 * Every other meal planner shows you a week. This shows you *why* that week
 * looks the way it does. With a dozen household rules, some weeks are genuinely
 * infeasible — the honest response is to say which preference gave way, not to
 * quietly drop it and hope nobody counts the fish dinners.
 */
export function RuleRail({ evaluation }: { evaluation: PlanEvaluation }) {
  const sorted = [...evaluation.soft].sort((a, b) => {
    const rank = { unmet: 0, partial: 1, met: 2 } as const;
    return rank[a.status] - rank[b.status] || b.weight - a.weight;
  });

  return (
    <aside className="rail" aria-label="How this week measures up">
      <div className="rail__head">
        <h2 className="rail__title">House rules</h2>
        <span className="rail__score">{Math.round(evaluation.totalScore * 100)}</span>
      </div>

      <ul className="rail__list">
        {sorted.map((rule) => (
          <li key={rule.ruleId} className="rail__item">
            <span
              className={`rail__dot rail__dot--${rule.status}`}
              role="img"
              aria-label={
                rule.status === 'met'
                  ? 'Met'
                  : rule.status === 'partial'
                    ? 'Partly met'
                    : 'Not met'
              }
            />
            <span>
              <span className="rail__label">{rule.label}</span>
              <span className="rail__detail">{rule.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      {evaluation.violations.length > 0 && (
        <p className="rail__note">
          {evaluation.violations.length} meal
          {evaluation.violations.length === 1 ? '' : 's'} break a rule that shouldn't bend.
          Swap them before you shop.
        </p>
      )}

      <p className="rail__note">
        Amber and red mean a preference lost out this week. Swap a meal to see the
        numbers move.
      </p>
    </aside>
  );
}
