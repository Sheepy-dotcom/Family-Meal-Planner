import { useModal } from '../useModal.js';
import { getIngredient } from '../../core/data/ingredients.js';
import type { Recipe } from '../../core/types.js';

/**
 * A dish, read-only, opened from the library.
 *
 * The library answers "what's in the book?"; this answers "what's actually in
 * this one?" — the ingredients and method, at the recipe's own serving size.
 * It borrows the cook sheet's layout so a dish looks the same whether you're
 * browsing it or cooking it, but nothing here is interactive: there's no plan to
 * tick against and no portions to scale, just the recipe as written.
 */
export function RecipeDetail({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const dialogRef = useModal(onClose);

  return (
    <div
      className="sheet__backdrop"
      ref={dialogRef}
      tabIndex={-1}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={recipe.name}
    >
      <div className="sheet sheet--cook" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              {recipe.cuisine}
            </p>
            <h2 className="cook__title">{recipe.name}</h2>
          </div>
          <button className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="cook__facts">
          <span>
            <strong>{recipe.servings}</strong> serves
          </span>
          <span>
            <strong>{recipe.activeMinutes}</strong> min hands-on
          </span>
          <span>
            <strong>{recipe.totalMinutes}</strong> min total
          </span>
          <span>Suits {recipe.slots.join(', ')}</span>
        </div>

        {recipe.tags.length > 0 && (
          <div className="lib__tags" style={{ marginTop: 12 }}>
            {recipe.tags.map((t) => (
              <span className="lib__tag" key={t}>
                {t.replace('-', ' ')}
              </span>
            ))}
          </div>
        )}

        <p className="eyebrow" style={{ marginTop: 24 }}>
          Ingredients
        </p>
        <ul className="cook__ingredients">
          {recipe.ingredients.map((ri, i) => {
            let name = ri.ingredientId;
            try {
              name = getIngredient(ri.ingredientId).name;
            } catch {
              // Ingredient gone from the catalogue; fall back to the id.
            }
            return (
              <li key={i}>
                <div className="cook__ingredient cook__ingredient--static">
                  <span className="cook__amount">
                    {ri.amount}
                    {ri.unit === 'unit' ? '' : ` ${ri.unit}`}
                  </span>
                  <span>
                    {name.toLowerCase()}
                    {ri.note && <em> {ri.note}</em>}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="eyebrow" style={{ marginTop: 24 }}>
          Method
        </p>
        {recipe.method.length === 0 ? (
          <p className="cook__nomethod">No method saved for this one yet.</p>
        ) : (
          <ol className="cook__steps">
            {recipe.method.map((step, index) => (
              <li key={index}>
                <div className="cook__step cook__step--static">
                  <span className="cook__stepnum">{index + 1}</span>
                  <span>{step}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
