import { useMemo, useState } from 'react';
import { allRecipes, isUserRecipe } from '../../core/data/registry.js';

/**
 * Browsing the recipe book.
 *
 * The planner draws on a fixed catalogue of dishes plus anything the household
 * adds, but until now there was no way to *see* that catalogue — the Recipes tab
 * only let you add your own. "What can it actually cook?" is a fair first
 * question, and this answers it: a searchable, at-a-glance list of every dish
 * the planner can reach, the household's own marked as theirs.
 *
 * Read-only by design. Editing belongs to your own dishes (the "Add your own"
 * view); the built-ins aren't yours to change, so there's nothing to tap into
 * here — just the facts that decide whether a dish is what you fancy.
 */
export function RecipeLibrary() {
  const [query, setQuery] = useState('');
  const total = allRecipes().length;

  const results = useMemo(() => {
    const all = [...allRecipes()].sort((a, b) => a.name.localeCompare(b.name));
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.tags.some((t) => t.replace('-', ' ').includes(q)) ||
        r.proteins.some((p) => p.replace('-', ' ').includes(q)),
    );
  }, [query]);

  return (
    <section className="page" aria-label="Recipe library">
      <p className="field__hint" style={{ marginTop: 0 }}>
        Every dish the planner can choose from — {total} in all. Search by name, cuisine or style.
      </p>

      <input
        className="lib__search"
        type="search"
        placeholder="Search dishes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search recipes"
      />

      <p className="eyebrow">
        {results.length} {results.length === 1 ? 'dish' : 'dishes'}
      </p>

      <div className="lib">
        {results.map((r) => (
          <div className="lib__card" key={r.id}>
            <div className="lib__head">
              <p className="lib__name">{r.name}</p>
              {isUserRecipe(r.id) && <span className="lib__mine">Yours</span>}
            </div>
            <p className="lib__meta">
              {r.cuisine} · {r.activeMinutes} min hands-on · {r.slots.join(', ')}
            </p>
            {r.tags.length > 0 && (
              <div className="lib__tags">
                {r.tags.map((t) => (
                  <span className="lib__tag" key={t}>
                    {t.replace('-', ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {results.length === 0 && (
          <p className="cook__nomethod">No dishes match "{query.trim()}".</p>
        )}
      </div>
    </section>
  );
}
