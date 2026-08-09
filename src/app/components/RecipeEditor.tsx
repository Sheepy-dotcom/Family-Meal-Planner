import { Shell } from './Shell.js';
import { useModal } from '../useModal.js';
import { useState } from 'react';
import { INGREDIENTS } from '../../core/data/ingredients.js';
import { allRecipes, isUserRecipe } from '../../core/data/registry.js';
import { finaliseRecipe, validateRecipe } from '../../core/recipes/validate.js';
import type { RecipeDraft } from '../../core/recipes/validate.js';
import type { Cuisine, MealSlot, ProteinClass, Recipe, RecipeTag, Unit } from '../../core/types.js';

interface Props {
  /** 'page' drops the modal chrome so this can sit inside a tab. */
  variant?: 'sheet' | 'page';
  onSave: (recipe: Recipe) => void;
  onDelete: (recipeId: string) => void;
  onClose: () => void;
  /** How many meals on the current plan use a given recipe. */
  usageOf: (recipeId: string) => number;
}

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const UNITS: Unit[] = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'unit'];
const CUISINES: Cuisine[] = [
  'british', 'italian', 'indian', 'mexican', 'chinese', 'japanese', 'thai',
  'greek', 'middle-eastern', 'french', 'north-african', 'american',
];
const PROTEINS: ProteinClass[] = [
  'fish', 'shellfish', 'chicken', 'red-meat', 'pork', 'egg', 'legume',
  'dairy-protein', 'meat-substitute',
];
const TAGS: RecipeTag[] = [
  'traybake', 'salad', 'pasta', 'soup', 'curry', 'stir-fry', 'roast',
  'sandwich', 'grill', 'one-pot', 'batch-cooks', 'kid-easy', 'make-ahead',
];

const EMPTY: RecipeDraft = {
  name: '',
  slots: ['dinner'],
  cuisine: 'british',
  proteins: [],
  tags: [],
  servings: 4,
  activeMinutes: 20,
  totalMinutes: 30,
  ingredients: [],
  method: [''],
};

/**
 * Adding your own dish.
 *
 * The two things this has to get right are both about the ingredient list.
 * Ingredients are picked from the catalogue rather than typed free-form —
 * otherwise "chikpeas" becomes an item the shopping list can't buy and the
 * allergen screen can't see. And validation runs live, because the errors that
 * matter here (a unit that can't be reconciled with how the thing is sold) are
 * ones nobody would predict, and finding out at save time means retyping.
 */
export function RecipeEditor({ onSave, onDelete, onClose, usageOf , variant = 'sheet' }: Props) {
  const dialogRef = useModal(onClose, variant === 'sheet');
  const [draft, setDraft] = useState<RecipeDraft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Guidance about what's missing shouldn't shout at a blank form — it appears
  // once someone has actually started filling the dish in.
  const [touched, setTouched] = useState(false);
  // Deleting a recipe is not undoable and can pull a dish out from under the
  // current week, so it asks first. Confirming inline rather than with a
  // browser dialog keeps it dismissable by Escape like everything else.
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const validation = validateRecipe(draft, { allowOverwrite: editingId !== null });
  const errors = validation.problems.filter((p) => p.severity === 'error');
  const warnings = validation.problems.filter((p) => p.severity === 'warning');
  const mine = allRecipes().filter((r) => isUserRecipe(r.id));

  function patch(next: Partial<RecipeDraft>) {
    setTouched(true);
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function toggle<T>(list: T[] | undefined, value: T): T[] {
    const current = list ?? [];
    return current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
  }

  function save() {
    if (!validation.ok) return;
    onSave(finaliseRecipe({ ...draft, id: editingId ?? draft.id }));
    setDraft(EMPTY);
    setEditingId(null);
    setTouched(false);
  }

  function edit(recipe: Recipe) {
    setDraft({ ...recipe });
    setEditingId(recipe.id);
    setTouched(true); // an existing dish should surface any issues straight away
  }

  return (
    <Shell variant={variant} dialogRef={dialogRef} onClose={onClose} label={"Recipe editor"}>
      <div className="sheet sheet--wide" onClick={(e) => e.stopPropagation()}>
        {/* The masthead titles the tab; keep an in-panel heading only for the
            pop-up sheet. As a tab, a plain lead-in sets the scene instead. */}
        {variant === 'sheet' ? (
          <div className="sheet__head">
            <h2>{editingId ? 'Edit dish' : 'Add a dish'}</h2>
            <button className="btn btn--ghost" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <p className="field__hint" style={{ marginTop: 0 }}>
            {editingId ? 'Editing one of your dishes.' : 'Add your own dishes here — they join the ones the planner already knows.'}
          </p>
        )}

        <div className="editor-block">
          <div className="field-row">
            <label className="field">
              <span>Name</span>
              <input
                value={draft.name ?? ''}
                placeholder="e.g. Nana's fish pie"
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
            <label className="field field--narrow">
              <span>Serves</span>
              <input
                type="number"
                min="1"
                value={draft.servings ?? 4}
                onChange={(e) => patch({ servings: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="field-row" style={{ marginTop: 12 }}>
            <label className="field field--narrow">
              <span>Hands-on min</span>
              <input
                type="number"
                min="0"
                value={draft.activeMinutes ?? 0}
                onChange={(e) => patch({ activeMinutes: Number(e.target.value) })}
              />
            </label>
            <label className="field field--narrow">
              <span>Total min</span>
              <input
                type="number"
                min="0"
                value={draft.totalMinutes ?? 0}
                onChange={(e) => patch({ totalMinutes: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>Cuisine</span>
              <select
                value={draft.cuisine ?? 'british'}
                onChange={(e) => patch({ cuisine: e.target.value as Cuisine })}
              >
                {CUISINES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="field__hint">Works for</p>
          <div className="chips">
            {SLOTS.map((slot) => (
              <button
                key={slot}
                className={`chip ${draft.slots?.includes(slot) ? 'chip--in' : ''}`}
                aria-pressed={draft.slots?.includes(slot)}
                onClick={() => patch({ slots: toggle(draft.slots, slot) })}
              >
                {slot}
              </button>
            ))}
          </div>

          <p className="field__hint">Protein</p>
          <div className="chips">
            {PROTEINS.map((protein) => (
              <button
                key={protein}
                className={`chip ${draft.proteins?.includes(protein) ? 'chip--in' : ''}`}
                aria-pressed={draft.proteins?.includes(protein)}
                onClick={() => patch({ proteins: toggle(draft.proteins, protein) })}
              >
                {protein.replace('-', ' ')}
              </button>
            ))}
          </div>

          <p className="field__hint">Style</p>
          <div className="chips">
            {TAGS.map((tag) => (
              <button
                key={tag}
                className={`chip ${draft.tags?.includes(tag) ? 'chip--in' : ''}`}
                aria-pressed={draft.tags?.includes(tag)}
                onClick={() => patch({ tags: toggle(draft.tags, tag) })}
              >
                {tag.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* --- ingredients --- */}
        <p className="eyebrow">Ingredients</p>
        <div className="editor-block">
          {(draft.ingredients ?? []).map((item, index) => (
            <div className="ingredient-row" key={index}>
              <select
                value={item.ingredientId}
                onChange={(e) =>
                  patch({
                    ingredients: draft.ingredients!.map((ing, i) =>
                      i === index ? { ...ing, ingredientId: e.target.value } : ing,
                    ),
                  })
                }
              >
                {INGREDIENTS.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.5"
                value={item.amount}
                onChange={(e) =>
                  patch({
                    ingredients: draft.ingredients!.map((ing, i) =>
                      i === index ? { ...ing, amount: Number(e.target.value) } : ing,
                    ),
                  })
                }
              />
              <select
                value={item.unit}
                onChange={(e) =>
                  patch({
                    ingredients: draft.ingredients!.map((ing, i) =>
                      i === index ? { ...ing, unit: e.target.value as Unit } : ing,
                    ),
                  })
                }
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <button
                className="btn btn--ghost"
                onClick={() =>
                  patch({
                    ingredients: draft.ingredients!.filter((_, i) => i !== index),
                  })
                }
                aria-label="Remove ingredient"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="btn btn--ghost"
            onClick={() =>
              patch({
                ingredients: [
                  ...(draft.ingredients ?? []),
                  { ingredientId: INGREDIENTS[0].id, amount: 100, unit: 'g' as Unit },
                ],
              })
            }
          >
            Add ingredient
          </button>
        </div>

        {/* --- method --- */}
        <p className="eyebrow">Method</p>
        <div className="editor-block">
          {(draft.method ?? ['']).map((step, index) => (
            <div className="ingredient-row" key={index}>
              <input
                value={step}
                placeholder={`Step ${index + 1}`}
                onChange={(e) =>
                  patch({
                    method: (draft.method ?? []).map((s, i) =>
                      i === index ? e.target.value : s,
                    ),
                  })
                }
              />
              <button
                className="btn btn--ghost"
                onClick={() =>
                  patch({ method: (draft.method ?? []).filter((_, i) => i !== index) })
                }
                aria-label="Remove step"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="btn btn--ghost"
            onClick={() => patch({ method: [...(draft.method ?? []), ''] })}
          >
            Add step
          </button>
        </div>

        {/* --- live validation (once they've started) --- */}
        {touched && errors.length > 0 && (
          <div className="warn">
            <h3>Needs fixing</h3>
            <ul>
              {errors.map((p, i) => (
                <li key={i}>{p.message}</li>
              ))}
            </ul>
          </div>
        )}
        {touched && errors.length === 0 && warnings.length > 0 && (
          <div className="status">
            <h3>Worth a look</h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {warnings.map((p, i) => (
                <li key={i}>{p.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="onboarding__foot">
          <div className="actions">
            <button className="btn btn--primary" onClick={save} disabled={!validation.ok}>
              {editingId ? 'Save changes' : 'Add to my book'}
            </button>
            {editingId && (
              <button
                className="btn btn--ghost"
                onClick={() => {
                  setDraft(EMPTY);
                  setEditingId(null);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {mine.length > 0 && (
          <>
            <p className="eyebrow" style={{ marginTop: 28 }}>
              Your dishes ({mine.length})
            </p>
            {mine.map((recipe) => (
              <div className="review-row" key={recipe.id}>
                <div>
                  <p className="suggestion__text">{recipe.name}</p>
                  <p className="suggestion__evidence">
                    {recipe.slots.join(', ')} · {recipe.activeMinutes} min hands-on
                  </p>
                </div>
                <div className="actions">
                  {confirmingDelete === recipe.id ? (
                    <>
                      <span className="suggestion__evidence">
                        {usageOf(recipe.id) > 0
                          ? `On this week's plan ${usageOf(recipe.id)}×. Delete anyway?`
                          : 'Delete this permanently?'}
                      </span>
                      <button
                        className="btn btn--ghost"
                        onClick={() => {
                          onDelete(recipe.id);
                          setConfirmingDelete(null);
                        }}
                      >
                        Yes, delete
                      </button>
                      <button
                        className="btn btn--ghost"
                        onClick={() => setConfirmingDelete(null)}
                      >
                        Keep it
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn--ghost" onClick={() => edit(recipe)}>
                        Edit
                      </button>
                      <button
                        className="btn btn--ghost"
                        onClick={() => setConfirmingDelete(recipe.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Shell>
  );
}
