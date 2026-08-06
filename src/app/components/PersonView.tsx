import { Shell } from './Shell.js';
import { useModal } from '../useModal.js';
import { useState } from 'react';
import { buildPersonProfile } from '../../core/people/profile.js';
import { DAY_NAMES } from '../../core/rules/context.js';
import type { RuleContext } from '../../core/rules/context.js';
import type { FeedbackEvent } from '../../core/learning/feedback.js';
import type { MealPlan } from '../../core/types.js';

interface Props {
  /** 'page' drops the modal chrome so this can sit inside a tab. */
  variant?: 'sheet' | 'page';
  plan: MealPlan;
  ctx: RuleContext;
  feedback: FeedbackEvent[];
  /** Weeks of cooked history — the AI reader unlocks at three. */
  weeksOfHistory: number;
  /** Ask the model to read the household's patterns. */
  onAnalyse: () => void;
  analysing: boolean;
  /** A plain line about the last read: how many were added, or why none were. */
  analysisStatus: string | null;
  onClose: () => void;
}

/**
 * One person's week.
 *
 * The week view answers "what is the household eating?" — the right default,
 * but it hides the fact that a household isn't a unit. A child on packed
 * lunches sees a completely different week from the parent cooking dinner, and
 * repetition is invisible day by day because each day looks fine on its own.
 *
 * The headline does the work here. If someone has had four dinners off one
 * dish, that sentence is the whole reason to open this screen.
 */
export function PersonView({
  plan,
  ctx,
  feedback,
  weeksOfHistory,
  onAnalyse,
  analysing,
  analysisStatus,
  onClose,
  variant = 'sheet',
}: Props) {
  const dialogRef = useModal(onClose, variant === 'sheet');
  const [selected, setSelected] = useState(ctx.household.people[0]?.id ?? '');
  const person = ctx.household.people.find((p) => p.id === selected);
  if (!person) return null;

  const profile = buildPersonProfile(selected, plan, ctx, feedback);

  return (
    <Shell variant={variant} dialogRef={dialogRef} onClose={onClose} label={"Who eats what"}>
      <div className="sheet sheet--wide" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <h2>Who eats what</h2>
          <button className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="chips" style={{ marginBottom: 20 }}>
          {ctx.household.people.map((p) => (
            <button
              key={p.id}
              className={`chip ${p.id === selected ? 'chip--in' : ''}`}
              aria-pressed={p.id === selected}
              onClick={() => setSelected(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>

        <p className="person__headline">{profile.headline}</p>

        {profile.flags.length > 0 && (
          <div className="warn">
            <h3>Check the pack</h3>
            <ul>
              {profile.flags.map((f, i) => (
                <li key={i}>
                  {DAY_NAMES[f.day]} {f.slot}: {f.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {profile.rules.length > 0 && (
          <>
            <p className="eyebrow">Their rules, this week</p>
            <div className="editor-block">
              {profile.rules.map((rule, i) => (
                <div className="person__rule" key={i}>
                  <span
                    className={`rail__dot rail__dot--${rule.met ? 'met' : 'unmet'}`}
                    role="img"
                    aria-label={rule.met ? 'Kept' : 'Not kept'}
                  />
                  <span>
                    <span className="rail__label" style={{ color: 'var(--slate)' }}>
                      {rule.label}
                    </span>
                    <span className="suggestion__evidence">{rule.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {(profile.favourites.length > 0 ||
          profile.dislikes.length > 0 ||
          profile.attributedSuggestions.length > 0) && (
          <>
            <p className="eyebrow">What we've learned</p>
            <div className="learned">
              {/* Stated facts: things this person actually said, one tap at a time. */}
              {profile.favourites.length > 0 && (
                <div className="learned__group">
                  <p className="learned__label">
                    Said they like <span className="learned__tag learned__tag--fact">stated</span>
                  </p>
                  <div className="chips">
                    {profile.favourites.map((f) => (
                      <span className="chip chip--good" key={f.recipeId}>
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.dislikes.length > 0 && (
                <div className="learned__group">
                  <p className="learned__label">
                    Said no to <span className="learned__tag learned__tag--fact">stated</span>
                  </p>
                  <div className="chips">
                    {profile.dislikes.map((d) => (
                      <span className="chip chip--on" key={d.recipeId}>
                        {d.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Inference: patterns the app has spotted but nobody has confirmed. */}
              {profile.attributedSuggestions.length > 0 && (
                <div className="learned__group">
                  <p className="learned__label">
                    A pattern we've spotted{' '}
                    <span className="learned__tag learned__tag--guess">a guess</span>
                  </p>
                  {profile.attributedSuggestions.map((s, i) => (
                    <div className="suggestion" key={i}>
                      <div>
                        <p className="suggestion__text">{s.suggestion}</p>
                        <p className="suggestion__evidence">{s.evidence}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {profile.meals.length > 0 && (
          <>
            <p className="eyebrow">What {person.name} eats</p>
            <div className="editor-block">
              {profile.meals.map((meal) => (
                <div className="person__meal" key={`${meal.day}-${meal.slot}`}>
                  <span className="person__when">
                    {DAY_NAMES[meal.day].slice(0, 3)} {meal.slot.slice(0, 5)}
                  </span>
                  <span>
                    {meal.recipeName}
                    {meal.reheated && <em className="aisle__note"> reheated</em>}
                    {meal.cookingAlone && (
                      <span className="badge badge--kids" style={{ marginLeft: 8 }}>
                        On their own
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="person__mixes">
              <div>
                <p className="eyebrow">Protein</p>
                {profile.proteinMix.map((p) => (
                  <div className="person__bar" key={p.protein}>
                    <span>{p.protein.replace('-', ' ')}</span>
                    <span className="qty">{p.count}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="eyebrow">Cuisine</p>
                {profile.cuisineMix.map((c) => (
                  <div className="person__bar" key={c.cuisine}>
                    <span>{c.cuisine}</span>
                    <span className="qty">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {profile.missed.length > 0 && (
          <p className="suggestion__evidence" style={{ marginTop: 20 }}>
            Away for {profile.missed.length} planned meal
            {profile.missed.length === 1 ? '' : 's'} this week.
          </p>
        )}

        {/* Household-wide, not this person's: the model reads everyone's history
            at once, looking for patterns the built-in rules can't phrase. */}
        {weeksOfHistory >= 3 && (
          <div className="noticed">
            <p className="eyebrow">Across the whole household</p>
            <div className="noticed__card">
              <div>
                <p className="suggestion__text">What we've noticed</p>
                <p className="suggestion__evidence">
                  Read {weeksOfHistory} weeks of choices for patterns the rules don't
                  cover yet. Anything found arrives as a suggestion you can accept or
                  ignore — nothing changes on its own.
                </p>
              </div>
              <button
                className="btn btn--primary"
                onClick={onAnalyse}
                disabled={analysing}
                aria-busy={analysing}
              >
                {analysing ? 'Looking…' : 'What we’ve noticed'}
              </button>
            </div>
            {analysisStatus && (
              <p className="suggestion__evidence" style={{ marginTop: 8 }} role="status">
                {analysisStatus}
              </p>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
