import { INGREDIENT_BY_ID } from '../data/ingredients.js';
import { findRecipe } from '../data/registry.js';
import { convertBase, toBase } from '../units.js';
import type { Recipe } from '../types.js';

/**
 * Checking a recipe someone typed in.
 *
 * The built-in book is guarded by the test suite. A user-authored recipe gets
 * no such protection, so the checks the suite performs at build time have to
 * run here at save time instead — otherwise the first symptom of a bad recipe
 * is a crash halfway through building a shopping list on a Sunday evening.
 *
 * Problems are split by severity. An `error` would break something downstream
 * and blocks saving. A `warning` is a judgement call — the recipe will work,
 * it just probably isn't what the author meant.
 */

export interface RecipeProblem {
  severity: 'error' | 'warning';
  field: string;
  message: string;
}

export interface RecipeValidation {
  ok: boolean;
  problems: RecipeProblem[];
}

/** Draft shape — everything optional, since it's being typed in. */
export interface RecipeDraft {
  id?: string;
  name?: string;
  slots?: Recipe['slots'];
  cuisine?: Recipe['cuisine'];
  proteins?: Recipe['proteins'];
  tags?: Recipe['tags'];
  servings?: number;
  activeMinutes?: number;
  totalMinutes?: number;
  ingredients?: Recipe['ingredients'];
  method?: string[];
  guide?: string[];
  style?: string;
  isNew?: boolean;
}

export function validateRecipe(
  draft: RecipeDraft,
  { allowOverwrite = false }: { allowOverwrite?: boolean } = {},
): RecipeValidation {
  const problems: RecipeProblem[] = [];
  const error = (field: string, message: string) =>
    problems.push({ severity: 'error', field, message });
  const warn = (field: string, message: string) =>
    problems.push({ severity: 'warning', field, message });

  // --- identity ----------------------------------------------------------
  if (!draft.name?.trim()) error('name', 'Give the dish a name.');

  if (draft.id && !allowOverwrite && findRecipe(draft.id)) {
    error('id', 'A recipe with that name already exists.');
  }

  // --- slots -------------------------------------------------------------
  if (!draft.slots?.length) {
    error('slots', 'Say which meals this works for — breakfast, lunch or dinner.');
  }

  // --- portions & timing -------------------------------------------------
  if (!draft.servings || draft.servings < 1) {
    error('servings', 'How many portions does this make?');
  } else if (draft.servings > 12) {
    warn('servings', 'That is a lot of portions — check it is not a typo.');
  }

  if (draft.activeMinutes === undefined || draft.activeMinutes < 0) {
    error('activeMinutes', 'How long are you actually at the hob?');
  }
  if (draft.totalMinutes === undefined || draft.totalMinutes < 0) {
    error('totalMinutes', 'How long from starting to eating?');
  }
  if (
    draft.activeMinutes !== undefined &&
    draft.totalMinutes !== undefined &&
    draft.activeMinutes > draft.totalMinutes
  ) {
    // Time budgets are enforced on activeMinutes, so this inversion would let a
    // dish slip past a limit it should have been caught by.
    error(
      'activeMinutes',
      'Hands-on time cannot be longer than the total time.',
    );
  }

  // --- ingredients -------------------------------------------------------
  if (!draft.ingredients?.length) {
    error('ingredients', 'Add at least one ingredient.');
  } else {
    const seen = new Set<string>();

    for (const item of draft.ingredients) {
      const ingredient = INGREDIENT_BY_ID.get(item.ingredientId);

      if (!ingredient) {
        error(
          'ingredients',
          `"${item.ingredientId}" is not in the ingredient list — pick one from the list so the shopping list knows what to buy.`,
        );
        continue;
      }

      if (seen.has(item.ingredientId)) {
        warn('ingredients', `${ingredient.name} is listed twice.`);
      }
      seen.add(item.ingredientId);

      if (!(item.amount > 0)) {
        error('ingredients', `How much ${ingredient.name.toLowerCase()}?`);
        continue;
      }

      // The check that caught 16 defects in the built-in book: an ingredient
      // measured in a unit that can't be reconciled with how it is sold.
      const base = toBase({ amount: item.amount, unit: item.unit });
      const canonical = ingredient.pack?.unit ?? base.unit;
      const converted = convertBase(
        base,
        canonical,
        ingredient.gramsPerUnit,
        ingredient.gramsPerMl,
      );
      if (!converted) {
        error(
          'ingredients',
          `${ingredient.name} is sold by ${canonical === 'unit' ? 'the item' : canonical}, so it cannot be measured in ${item.unit} here. Try ${canonical === 'unit' ? 'a count' : canonical}.`,
        );
      }
    }
  }

  // --- method ------------------------------------------------------------
  if (!draft.method?.some((step) => step.trim())) {
    warn('method', 'No method yet — fine for now, but you will want it later.');
  }

  // --- rule-relevant metadata -------------------------------------------
  // Not errors, but a recipe with none of these is invisible to most of the
  // rules and will rarely get chosen.
  if (!draft.proteins?.length) {
    warn(
      'proteins',
      'No protein set, so this will count against "protein at every meal".',
    );
  }
  if (!draft.cuisine) {
    warn('cuisine', 'No cuisine set, so cuisine rotation cannot see this dish.');
  }

  return { ok: !problems.some((p) => p.severity === 'error'), problems };
}

/** Build a saveable recipe from a validated draft. Throws if it isn't valid. */
export function finaliseRecipe(draft: RecipeDraft): Recipe {
  const validation = validateRecipe(draft, { allowOverwrite: true });
  if (!validation.ok) {
    throw new Error(
      `Recipe is not valid: ${validation.problems
        .filter((p) => p.severity === 'error')
        .map((p) => p.message)
        .join(' ')}`,
    );
  }

  return {
    id: draft.id ?? slugify(draft.name!),
    name: draft.name!.trim(),
    slots: draft.slots!,
    cuisine: draft.cuisine ?? 'british',
    proteins: draft.proteins?.length ? draft.proteins : ['none'],
    tags: draft.tags ?? [],
    servings: draft.servings!,
    activeMinutes: draft.activeMinutes!,
    totalMinutes: draft.totalMinutes!,
    ingredients: draft.ingredients!,
    method: (draft.method ?? []).filter((step) => step.trim()),
    guide: draft.guide?.filter((step) => step.trim()),
    style: draft.style,
    isNew: draft.isNew ?? true,
  };
}

function slugify(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const stem = base || 'recipe';
  // Collisions are possible with a short name; suffix until it's free.
  let candidate = `my-${stem}`;
  let n = 2;
  while (findRecipe(candidate)) candidate = `my-${stem}-${n++}`;
  return candidate;
}
