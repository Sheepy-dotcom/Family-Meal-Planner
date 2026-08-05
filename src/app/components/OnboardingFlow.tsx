import { useState } from 'react';
import {
  ALLERGEN_CHOICES,
  QUESTIONS,
  SLOT_OPTIONS,
  TIME_OPTIONS,
  LEAN_LABELS,
  DEFAULT_ANSWERS,
  buildHousehold,
  validateAnswers,
} from '../../core/onboarding/questions.js';
import type { Lean, OnboardingAnswers } from '../../core/onboarding/questions.js';
import { ALLERGEN_LABELS } from '../../core/data/allergens.js';
import type { Allergen, Household, MealSlot, Person } from '../../core/types.js';

interface Props {
  onFinish: (household: Household, lean: Lean) => void;
  onUseSample: () => void;
}

/**
 * Five questions, one at a time.
 *
 * One question per screen rather than a single long form: a form shows you the
 * full length of the homework up front, and the count is what makes people
 * close the tab. Each step also says *why* it's being asked, because people
 * answer "how long will you cook on a weeknight" far more honestly when they
 * know it's going to be held to.
 */
export function OnboardingFlow({ onFinish, onUseSample }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(DEFAULT_ANSWERS);

  const question = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const validation = validateAnswers(answers);

  function patch(next: Partial<OnboardingAnswers>) {
    setAnswers((prev) => ({ ...prev, ...next }));
  }

  function setPerson(index: number, next: Partial<{ name: string; ageBand: Person['ageBand'] }>) {
    patch({
      people: answers.people.map((p, i) => (i === index ? { ...p, ...next } : p)),
    });
  }

  function toggleExclusion(index: number, allergen: Allergen) {
    const current = answers.exclusions[index] ?? [];
    patch({
      exclusions: {
        ...answers.exclusions,
        [index]: current.includes(allergen)
          ? current.filter((a) => a !== allergen)
          : [...current, allergen],
      },
    });
  }

  /** Can this step be left? Only the people step can actually be wrong. */
  const canAdvance =
    question.id === 'people'
      ? answers.people.some((p) => p.name.trim().length > 0) && validation.ok
      : question.id === 'planned-slots'
        ? answers.plannedSlots.length > 0
        : true;

  function finish() {
    if (!validation.ok) return;
    onFinish(buildHousehold(answers), answers.lean);
  }

  return (
    <div className="onboarding">
      <div className="onboarding__progress" aria-hidden="true">
        {QUESTIONS.map((q, i) => (
          <span key={q.id} className={`pip ${i <= step ? 'pip--done' : ''}`} />
        ))}
      </div>

      <p className="eyebrow">
        Step {step + 1} of {QUESTIONS.length}
      </p>
      <h1 className="onboarding__prompt">{question.prompt}</h1>
      <p className="onboarding__why">{question.why}</p>

      <div className="onboarding__body">
        {question.id === 'people' && (
          <>
            {answers.people.map((person, index) => (
              <div className="field-row" key={index} style={{ marginBottom: 12 }}>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={person.name}
                    placeholder="e.g. Sam"
                    onChange={(e) => setPerson(index, { name: e.target.value })}
                  />
                </label>
                <label className="field field--narrow">
                  <span>Age</span>
                  <select
                    value={person.ageBand}
                    onChange={(e) =>
                      setPerson(index, { ageBand: e.target.value as Person['ageBand'] })
                    }
                  >
                    <option value="adult">Adult</option>
                    <option value="teen">Teen</option>
                    <option value="child">Child</option>
                  </select>
                </label>
                {answers.people.length > 1 && (
                  <button
                    className="btn btn--ghost"
                    onClick={() =>
                      patch({ people: answers.people.filter((_, i) => i !== index) })
                    }
                    aria-label={`Remove person ${index + 1}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              className="btn btn--ghost"
              onClick={() =>
                patch({ people: [...answers.people, { name: '', ageBand: 'adult' }] })
              }
            >
              Add someone
            </button>
            {validation.problems.length > 0 && (
              <p className="onboarding__problem">{validation.problems[0]}</p>
            )}
          </>
        )}

        {question.id === 'exclusions' && (
          <>
            {answers.people
              .filter((p) => p.name.trim())
              .map((person, index) => (
                <div className="editor-block" key={index}>
                  <p className="field__hint" style={{ marginTop: 0 }}>
                    {person.name.trim()} must never eat
                  </p>
                  <div className="chips">
                    {ALLERGEN_CHOICES.map((allergen) => {
                      const on = (answers.exclusions[index] ?? []).includes(allergen);
                      return (
                        <button
                          key={allergen}
                          className={`chip ${on ? 'chip--on' : ''}`}
                          aria-pressed={on}
                          onClick={() => toggleExclusion(index, allergen)}
                        >
                          {ALLERGEN_LABELS[allergen]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            <p className="onboarding__aside">
              Nothing to add here is a perfectly normal answer. These flags are
              advisory — always read the label.
            </p>
          </>
        )}

        {question.id === 'weeknight-time' && (
          <div className="choices">
            {TIME_OPTIONS.map((option) => (
              <button
                key={option.minutes}
                className={`choice ${answers.weeknightMinutes === option.minutes ? 'choice--on' : ''}`}
                aria-pressed={answers.weeknightMinutes === option.minutes}
                onClick={() => patch({ weeknightMinutes: option.minutes })}
              >
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </button>
            ))}
          </div>
        )}

        {question.id === 'planned-slots' && (
          <div className="choices">
            {SLOT_OPTIONS.map((option) => {
              const on = sameSlots(option.slots, answers.plannedSlots);
              return (
                <button
                  key={option.label}
                  className={`choice ${on ? 'choice--on' : ''}`}
                  aria-pressed={on}
                  onClick={() => patch({ plannedSlots: option.slots })}
                >
                  <strong>{option.label}</strong>
                </button>
              );
            })}
          </div>
        )}

        {question.id === 'lean' && (
          <div className="choices">
            {(Object.keys(LEAN_LABELS) as Lean[]).map((lean) => (
              <button
                key={lean}
                className={`choice ${answers.lean === lean ? 'choice--on' : ''}`}
                aria-pressed={answers.lean === lean}
                onClick={() => patch({ lean })}
              >
                <strong>{LEAN_LABELS[lean]}</strong>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="onboarding__foot">
        <div className="actions">
          {step > 0 && (
            <button className="btn btn--ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {isLast ? (
            <button className="btn btn--primary" onClick={finish} disabled={!validation.ok}>
              Plan my first week
            </button>
          ) : (
            <button
              className="btn btn--primary"
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance}
            >
              Next
            </button>
          )}
        </div>
        <button className="btn btn--ghost" onClick={onUseSample}>
          Look round with sample data
        </button>
      </div>
    </div>
  );
}

function sameSlots(a: MealSlot[], b: MealSlot[]): boolean {
  return a.length === b.length && a.every((s) => b.includes(s));
}
