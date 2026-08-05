import type { RuleProposal } from '../../core/learning/feedback.js';
import type { PlannedOverSuggestion } from '../../core/planner/leftovers.js';

interface Props {
  proposals: RuleProposal[];
  plannedOvers: PlannedOverSuggestion[];
  onAccept: (proposal: RuleProposal) => void;
  onDismiss: (proposal: RuleProposal) => void;
  onApplyPlannedOver: (suggestion: PlannedOverSuggestion) => void;
}

/**
 * Everything the app has noticed, phrased as a question.
 *
 * Nothing here has been applied. That's the point: a planner that quietly
 * rewrites its own rules is one you can't predict, and predictability is most
 * of what makes a weekly routine stick. Each suggestion shows the evidence
 * behind it so the household can disagree with the reasoning, not just the
 * conclusion.
 */
export function SuggestionsPanel({
  proposals,
  plannedOvers,
  onAccept,
  onDismiss,
  onApplyPlannedOver,
}: Props) {
  if (proposals.length === 0 && plannedOvers.length === 0) return null;

  return (
    <section className="panel">
      <h2>Noticed</h2>

      {plannedOvers.length > 0 && (
        <>
          <p className="eyebrow">Cook once, eat twice</p>
          {plannedOvers.slice(0, 3).map((suggestion) => (
            <div
              className="suggestion"
              key={`${suggestion.targetDay}-${suggestion.targetSlot}`}
            >
              <div>
                <p className="suggestion__text">{suggestion.message}</p>
                <p className="suggestion__evidence">
                  Nothing extra to buy — the shopping list already covers it.
                </p>
              </div>
              <div className="actions">
                <button
                  className="btn btn--ghost"
                  onClick={() => onApplyPlannedOver(suggestion)}
                >
                  Do that
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {proposals.length > 0 && (
        <>
          <p className="eyebrow">From your swaps</p>
          {proposals.slice(0, 4).map((proposal) => (
            <div className="suggestion" key={proposal.id}>
              <div>
                <p className="suggestion__text">
                  {proposal.suggestion}
                  {proposal.personName && (
                    <span className="badge badge--who">{proposal.personName}</span>
                  )}
                </p>
                <p className="suggestion__evidence">{proposal.evidence}</p>
              </div>
              <div className="actions">
                <button className="btn btn--ghost" onClick={() => onAccept(proposal)}>
                  Yes
                </button>
                <button className="btn btn--ghost" onClick={() => onDismiss(proposal)}>
                  No
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
