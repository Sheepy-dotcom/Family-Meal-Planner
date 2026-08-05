import { getIngredient } from '../data/ingredients.js';
import { aisleOrder } from '../shopping/list.js';
import { convertBase, formatQuantity, roundToPacks } from '../units.js';
import type { Aisle, BaseQuantity, ShoppingLine, ShoppingList } from '../types.js';

/**
 * "I've already got that."
 *
 * Every pantry feature dies the same way: it asks people to log what they use.
 * Nobody opens an app after finishing the rice. Within a fortnight the stored
 * inventory is wrong, and a wrong inventory is worse than none — it silently
 * removes things from your shopping list that you don't actually have.
 *
 * So this never tries to know what's in the cupboard. It offers two things
 * people *will* maintain:
 *
 *  1. **Always stocked** — a short list of things you simply always have. Set
 *     once, changes maybe twice a year. Salt, oil, stock cubes.
 *  2. **Got it this week** — ticked off while reviewing the list before a shop,
 *     and wiped when the week turns over. Never stale, because it never
 *     outlives the week it was entered for.
 *
 * The second tier is the important one. Because it expires, being wrong costs
 * one week rather than compounding forever.
 */

export interface PantryEntry {
  ingredientId: string;
  /**
   * How much you have. Omitted means "enough" — the common case, since people
   * know they have rice without knowing they have 340g of it.
   */
  amount?: BaseQuantity;
}

export interface Pantry {
  /** Ingredient ids you always have in. Never expires. */
  alwaysStocked: string[];
  /** Ticked while reviewing this week's list. */
  haveThisWeek: PantryEntry[];
  /** The week `haveThisWeek` belongs to. */
  weekStartISO: string;
}

export const EMPTY_PANTRY: Pantry = {
  alwaysStocked: [],
  haveThisWeek: [],
  weekStartISO: '',
};

/**
 * Roll the pantry over to a new week.
 *
 * `haveThisWeek` is deliberately wiped. Carrying it forward is exactly the
 * mistake that makes inventory tracking rot — last week's half-bag of rice was
 * eaten, and assuming otherwise removes rice from the list of someone who
 * needs it.
 */
export function pantryForWeek(pantry: Pantry, weekStartISO: string): Pantry {
  if (pantry.weekStartISO === weekStartISO) return pantry;
  return { alwaysStocked: pantry.alwaysStocked, haveThisWeek: [], weekStartISO };
}

export interface AdjustedLine extends ShoppingLine {
  /** How much of the requirement the pantry covers. */
  covered?: BaseQuantity;
  /** Why this line is reduced or gone. */
  reason?: 'always-stocked' | 'have-some' | 'have-enough';
}

export interface AdjustedList {
  weekStartISO: string;
  linesByAisle: Record<Aisle, AdjustedLine[]>;
  checkCupboard: ShoppingLine[];
  /** Lines removed entirely, shown collapsed so the removal is visible. */
  skipped: AdjustedLine[];
  /** Lines still needed, but less than the recipe called for. */
  reduced: AdjustedLine[];
}

/**
 * Subtract what you have from what you need.
 *
 * Removals are surfaced rather than silent. A shopping list that quietly drops
 * an item is one you stop trusting the moment you get home without something.
 */
export function applyPantry(list: ShoppingList, pantry: Pantry): AdjustedList {
  const stocked = new Set(pantry.alwaysStocked);
  const have = new Map(pantry.haveThisWeek.map((e) => [e.ingredientId, e]));

  const linesByAisle = Object.fromEntries(
    aisleOrder().map((a) => [a, [] as AdjustedLine[]]),
  ) as Record<Aisle, AdjustedLine[]>;
  const skipped: AdjustedLine[] = [];
  const reduced: AdjustedLine[] = [];

  for (const aisle of aisleOrder()) {
    for (const line of list.linesByAisle[aisle]) {
      if (stocked.has(line.ingredientId)) {
        skipped.push({ ...line, reason: 'always-stocked' });
        continue;
      }

      const entry = have.get(line.ingredientId);
      if (!entry) {
        linesByAisle[aisle].push(line);
        continue;
      }

      // No amount given means "I've got enough of that" — drop the line.
      if (!entry.amount) {
        skipped.push({ ...line, reason: 'have-enough' });
        continue;
      }

      const onHand = convertBase(
        entry.amount,
        line.needed.unit,
        getIngredient(line.ingredientId).gramsPerUnit,
        getIngredient(line.ingredientId).gramsPerMl,
      );

      // Units we can't reconcile: keep the line rather than guess.
      if (!onHand) {
        linesByAisle[aisle].push(line);
        continue;
      }

      const shortfall = line.needed.amount - onHand.amount;
      if (shortfall <= 0) {
        skipped.push({ ...line, reason: 'have-enough', covered: line.needed });
        continue;
      }

      const stillNeeded: BaseQuantity = { amount: shortfall, unit: line.needed.unit };
      const { buy, packsToBuy } = roundToPacks(
        stillNeeded,
        getIngredient(line.ingredientId).pack,
      );
      const adjusted: AdjustedLine = {
        ...line,
        needed: stillNeeded,
        buy,
        packsToBuy,
        covered: onHand,
        reason: 'have-some',
      };
      linesByAisle[aisle].push(adjusted);
      reduced.push(adjusted);
    }
  }

  return {
    weekStartISO: list.weekStartISO,
    linesByAisle,
    // Staples you've marked as always stocked no longer need checking either.
    checkCupboard: list.checkCupboard.filter((l) => !stocked.has(l.ingredientId)),
    skipped,
    reduced,
  };
}

/** Toggle an ingredient on this week's "already got" list. */
export function toggleHave(
  pantry: Pantry,
  ingredientId: string,
  amount?: BaseQuantity,
): Pantry {
  const existing = pantry.haveThisWeek.some((e) => e.ingredientId === ingredientId);
  return {
    ...pantry,
    haveThisWeek: existing
      ? pantry.haveThisWeek.filter((e) => e.ingredientId !== ingredientId)
      : [...pantry.haveThisWeek, { ingredientId, amount }],
  };
}

export function toggleAlwaysStocked(pantry: Pantry, ingredientId: string): Pantry {
  const has = pantry.alwaysStocked.includes(ingredientId);
  return {
    ...pantry,
    alwaysStocked: has
      ? pantry.alwaysStocked.filter((id) => id !== ingredientId)
      : [...pantry.alwaysStocked, ingredientId],
  };
}

/** One-line summary for the shopping header. */
export function pantrySummary(adjusted: AdjustedList): string {
  const removed = adjusted.skipped.length;
  const trimmed = adjusted.reduced.length;
  if (removed === 0 && trimmed === 0) return '';
  const parts: string[] = [];
  if (removed > 0) parts.push(`${removed} item${removed === 1 ? '' : 's'} you already have`);
  if (trimmed > 0) parts.push(`${trimmed} reduced`);
  return `${parts.join(', ')}.`;
}

/** Human-readable note for a single adjusted line. */
export function coverageNote(line: AdjustedLine): string | null {
  if (line.reason === 'always-stocked') return 'Always in the cupboard';
  if (line.reason === 'have-enough') return 'You have enough';
  if (line.reason === 'have-some' && line.covered) {
    return `${formatQuantity(line.covered)} already in — buying the rest`;
  }
  return null;
}
