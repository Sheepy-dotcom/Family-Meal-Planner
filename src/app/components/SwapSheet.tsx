import { useModal } from '../useModal.js';
import { allRecipes } from '../../core/data/registry.js';
import { DAY_NAMES } from '../../core/rules/context.js';
import { isAllowed } from '../../core/rules/hard.js';
import { explainRejection } from '../../core/planner/solver.js';
import type { RuleContext } from '../../core/rules/context.js';
import type { DayIndex, MealPlan, MealSlot, Recipe } from '../../core/types.js';

interface Props {
  target: { day: DayIndex; slot: MealSlot };
  plan: MealPlan;
  ctx: RuleContext;
  onChoose: (recipeId: string) => void;
  onReroll: () => void;
  onClose: () => void;
}

/**
 * Blocked dishes are shown greyed out with the reason, rather than hidden.
 *
 * Hiding them makes the app look like it has fewer recipes than it does, and
 * leaves people wondering why last week's favourite has vanished. Saying "no,
 * because Katie's eating and this has gluten in it" is the difference between
 * a planner people trust and one they stop believing.
 */
export function SwapSheet({ target, plan, ctx, onChoose, onReroll, onClose }: Props) {
  const dialogRef = useModal(onClose);
  const current = plan.meals.find(
    (m) => m.day === target.day && m.slot === target.slot,
  );

  const placed = plan.meals.filter(
    (m) => !(m.day === target.day && m.slot === target.slot),
  );

  const forSlot = allRecipes().filter((r) => r.slots.includes(target.slot));
  const allowed: Recipe[] = [];
  const blocked: Array<{ recipe: Recipe; why: string[] }> = [];

  for (const recipe of forSlot) {
    if (recipe.id === current?.recipeId) continue;
    if (isAllowed(recipe, target.day, target.slot, ctx, placed)) {
      allowed.push(recipe);
    } else {
      blocked.push({
        recipe,
        why: explainRejection(recipe.id, target, ctx),
      });
    }
  }

  return (
    <div
      className="sheet__backdrop"
      ref={dialogRef}
      tabIndex={-1}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Change ${DAY_NAMES[target.day]} ${target.slot}`}
    >
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div>
            <h2>
              {DAY_NAMES[target.day]} {target.slot}
            </h2>
            <p className="meal__meta">
              {allowed.length} dish{allowed.length === 1 ? '' : 'es'} fit this slot
            </p>
          </div>
          <div className="actions">
            <button className="btn btn--ghost" onClick={onReroll}>
              Surprise me
            </button>
            <button className="btn btn--ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {allowed.map((recipe) => (
          <button
            className="option"
            key={recipe.id}
            onClick={() => onChoose(recipe.id)}
          >
            <strong>{recipe.name}</strong>
            <div className="meal__meta">
              <span>{recipe.activeMinutes} min hands-on</span>
              <span>{recipe.cuisine}</span>
              {recipe.isNew && <span className="badge badge--new">New</span>}
            </div>
          </button>
        ))}

        {blocked.length > 0 && (
          <>
            <p className="eyebrow" style={{ marginTop: 24 }}>
              Ruled out for this slot
            </p>
            {blocked.map(({ recipe, why }) => (
              <div className="option option--blocked" key={recipe.id}>
                <strong>{recipe.name}</strong>
                <p className="option__why">{why[0] ?? 'Already on the plan this week'}</p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
