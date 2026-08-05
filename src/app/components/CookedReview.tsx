import { useModal } from '../useModal.js';
import { useState } from 'react';
import { getRecipe } from '../../core/data/registry.js';
import { DAY_NAMES } from '../../core/rules/context.js';
import type { FeedbackEvent } from '../../core/learning/feedback.js';
import type { Household, MealPlan } from '../../core/types.js';

interface Props {
  plan: MealPlan;
  household: Household;
  onFinish: (events: FeedbackEvent[]) => void;
  onSkip: () => void;
}

type Verdict = 'liked' | 'disliked';
/** Keyed by `recipeId:personId`, so verdicts are per person, not per household. */
type Verdicts = Record<string, Verdict | undefined>;

/**
 * The end-of-week review.
 *
 * Feedback has to be captured at a moment that already exists in the routine.
 * Asking "how was dinner?" every evening is a notification people turn off;
 * asking once, at the point someone is already closing the week down, costs one
 * screen and catches the whole week while it's still remembered.
 *
 * Everything defaults to no answer. A blank verdict is real information —
 * it means fine, unremarkable, cook it again — and forcing a rating on every
 * dish would flood the inference with noise that means nothing.
 */
export function CookedReview({ plan, household, onFinish, onSkip }: Props) {
  const dialogRef = useModal(onSkip);
  const [verdicts, setVerdicts] = useState<Verdicts>({});

  // Only dishes actually cooked. A planned-over was already rated as its source.
  const cooked = plan.meals
    .filter((m) => m.source !== 'planned-over')
    .filter((m, i, all) => all.findIndex((o) => o.recipeId === m.recipeId) === i)
    .sort((a, b) => a.day - b.day);

  function setVerdict(recipeId: string, personId: string, verdict: Verdict) {
    const key = `${recipeId}:${personId}`;
    setVerdicts((prev) => ({
      ...prev,
      [key]: prev[key] === verdict ? undefined : verdict,
    }));
  }

  function finish() {
    const at = new Date().toISOString();
    const attendanceOf = (recipeId: string) =>
      cooked.find((m) => m.recipeId === recipeId)?.attendeeIds;

    const events: FeedbackEvent[] = [
      ...cooked.map((m) => ({
        type: 'cooked' as const,
        recipeId: m.recipeId,
        at,
        attendeeIds: m.attendeeIds,
      })),
      ...Object.entries(verdicts)
        .filter(([, v]) => v)
        .map(([key, v]) => {
          const [recipeId, personId] = key.split(':');
          return {
            type: v as Verdict,
            recipeId,
            at,
            personId,
            attendeeIds: attendanceOf(recipeId),
          };
        }),
    ];
    onFinish(events);
  }

  const rated = Object.values(verdicts).filter(Boolean).length;

  return (
    <div
      className="sheet__backdrop"
      ref={dialogRef}
      tabIndex={-1}
      onClick={onSkip}
      role="dialog"
      aria-modal="true"
      aria-label="How was the week?"
    >
      <div className="sheet sheet--wide" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div>
            <h2>How was the week?</h2>
            <p className="meal__meta">
              Mark anything that stood out. Skipping a dish is fine — it just means
              it was fine.
            </p>
          </div>
        </div>

        {cooked.map((meal) => {
          const recipe = getRecipe(meal.recipeId);
          // Only the people who actually ate it get a say.
          const diners = household.people.filter((p) => meal.attendeeIds.includes(p.id));
          const allLiked =
            diners.length > 0 &&
            diners.every((p) => verdicts[`${meal.recipeId}:${p.id}`] === 'liked');

          return (
            <div className="review-dish" key={meal.recipeId}>
              <div className="review-dish__head">
                <div>
                  <p className="suggestion__text">
                    {recipe.name}
                    {allLiked && (
                      <span className="badge badge--hit">Everyone loved it</span>
                    )}
                  </p>
                  <p className="suggestion__evidence">
                    {DAY_NAMES[meal.day]} {meal.slot}
                  </p>
                </div>
                <button
                  className="btn btn--ghost"
                  onClick={() =>
                    setVerdicts((prev) => {
                      const next = { ...prev };
                      for (const p of diners) next[`${meal.recipeId}:${p.id}`] = 'liked';
                      return next;
                    })
                  }
                >
                  All liked it
                </button>
              </div>

              <div className="review-dish__people">
                {diners.map((person) => {
                  const key = `${meal.recipeId}:${person.id}`;
                  const verdict = verdicts[key];
                  return (
                    <div className="review-person" key={person.id}>
                      <span className="review-person__name">{person.name}</span>
                      <button
                        className={`chip ${verdict === 'liked' ? 'chip--good' : ''}`}
                        aria-pressed={verdict === 'liked'}
                        aria-label={`${person.name} liked ${recipe.name}`}
                        onClick={() => setVerdict(meal.recipeId, person.id, 'liked')}
                      >
                        Liked
                      </button>
                      <button
                        className={`chip ${verdict === 'disliked' ? 'chip--on' : ''}`}
                        aria-pressed={verdict === 'disliked'}
                        aria-label={`${person.name} did not like ${recipe.name}`}
                        onClick={() => setVerdict(meal.recipeId, person.id, 'disliked')}
                      >
                        Not for me
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="onboarding__foot">
          <button className="btn btn--primary" onClick={finish}>
            Save the week
          </button>
          <span className="suggestion__evidence">
            {rated === 0
              ? 'Nothing marked — that is a fine answer'
              : `${rated} marked`}
          </span>
        </div>
      </div>
    </div>
  );
}
