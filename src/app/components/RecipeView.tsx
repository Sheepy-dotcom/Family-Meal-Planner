import { useModal } from '../useModal.js';
import { useState } from 'react';
import { scaleRecipeForMeal, timingFor } from '../../core/recipes/scale.js';
import { DAY_NAMES } from '../../core/rules/context.js';
import type { RuleContext } from '../../core/rules/context.js';
import { explainMeal } from '../../core/planner/explain.js';
import { MealRating, type Verdict } from './MealRating.js';
import type { MealPlan, PlannedMeal } from '../../core/types.js';

interface Props {
  meal: PlannedMeal;
  plan: MealPlan;
  ctx: RuleContext;
  verdictOf: (recipeId: string, personId: string) => Verdict | undefined;
  onRate: (recipeId: string, personId: string, verdict: Verdict, attendeeIds: string[]) => void;
  onClose: () => void;
  onSwap: () => void;
}

/**
 * Reading the recipe.
 *
 * The reason to read it here rather than on a website is that the app knows how
 * many portions are needed tonight, so the quantities on the page are already
 * right. Three people eating a dish written for four should see quantities for
 * three, not a note to do the arithmetic while holding a knife.
 *
 * Laid out for a phone propped against something, at arm's length, with wet
 * hands: large type, generous tap targets, steps that stay struck through once
 * tapped so you can find your place after being interrupted.
 */
export function RecipeView({ meal, plan, ctx, verdictOf, onRate, onClose, onSwap }: Props) {
  const dialogRef = useModal(onClose);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [gathered, setGathered] = useState<Set<string>>(new Set());
  const why = explainMeal(meal, plan, ctx).sentence;
  // Only the people who ate it get a say. Carried planned-overs were already
  // rated as their source cook, so they don't ask again.
  const diners = ctx.household.people.filter((p) => meal.attendeeIds.includes(p.id));

  const scaled = scaleRecipeForMeal(meal, ctx);
  const timing = timingFor(scaled);

  function toggleStep(index: number) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleIngredient(id: string) {
    setGathered((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="sheet__backdrop"
      ref={dialogRef}
      tabIndex={-1}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={scaled.recipe.name}
    >
      <div className="sheet sheet--cook" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              {DAY_NAMES[meal.day]} {meal.slot}
            </p>
            <h2 className="cook__title">{scaled.recipe.name}</h2>
            <p className="cook__why">{why}</p>
          </div>
          <button className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="cook__facts">
          <span>
            <strong>{scaled.portions}</strong> portions
          </span>
          <span>
            <strong>{timing.activeMinutes}</strong> min hands-on
          </span>
          <span>
            <strong>{timing.totalMinutes}</strong> min total
          </span>
          {scaled.eating.length > 0 && <span>For {scaled.eating.join(', ')}</span>}
        </div>

        {scaled.reheatOnly && (
          <div className="status">
            <h3>Already cooked</h3>
            <p>
              This was made on{' '}
              {meal.cookedOn ? DAY_NAMES[meal.cookedOn.day] : 'an earlier day'} — it just
              needs reheating. The method is below if you want to check it.
            </p>
          </div>
        )}

        {scaled.scaled && !scaled.reheatOnly && (
          <p className="cook__scaled">
            Quantities adjusted from the original {scaled.recipe.servings} portions —
            no maths needed.
          </p>
        )}

        {scaled.warnings.length > 0 && (
          <div className="warn">
            <h3>Check the pack</h3>
            <ul>
              {scaled.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="eyebrow" style={{ marginTop: 24 }}>
          Ingredients
        </p>
        <ul className="cook__ingredients">
          {scaled.ingredients.map((item) => {
            const isGathered = gathered.has(item.ingredientId);
            return (
              <li key={item.ingredientId}>
                <button
                  className={`cook__ingredient ${isGathered ? 'cook__ingredient--got' : ''}`}
                  aria-pressed={isGathered}
                  onClick={() => toggleIngredient(item.ingredientId)}
                >
                  <span className="cook__amount">{item.display}</span>
                  <span>
                    {item.name.toLowerCase()}
                    {item.note && <em> {item.note}</em>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="eyebrow" style={{ marginTop: 24 }}>
          Method
        </p>
        {scaled.method.length === 0 ? (
          <p className="cook__nomethod">
            No method saved for this one yet. You can add it from the Recipes screen.
          </p>
        ) : (
          <ol className="cook__steps">
            {scaled.method.map((step, index) => (
              <li key={index}>
                <button
                  className={`cook__step ${done.has(index) ? 'cook__step--done' : ''}`}
                  aria-pressed={done.has(index)}
                  onClick={() => toggleStep(index)}
                >
                  <span className="cook__stepnum">{index + 1}</span>
                  <span>{step}</span>
                </button>
              </li>
            ))}
          </ol>
        )}

        {/* Just finished cooking — the moment an opinion is most likely to exist. */}
        {meal.source !== 'planned-over' && diners.length > 0 && (
          <MealRating
            people={diners}
            verdictOf={(personId) => verdictOf(meal.recipeId, personId)}
            onRate={(personId, verdict) =>
              onRate(meal.recipeId, personId, verdict, meal.attendeeIds)
            }
          />
        )}

        <div className="onboarding__foot">
          <div className="actions">
            <button className="btn btn--ghost" onClick={onSwap}>
              Cook something else
            </button>
            {done.size > 0 && (
              <button className="btn btn--ghost" onClick={() => setDone(new Set())}>
                Reset steps
              </button>
            )}
          </div>
          {done.size > 0 && (
            <span className="suggestion__evidence">
              {done.size} of {scaled.method.length} done
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
