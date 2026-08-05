import type { BaseQuantity, BaseUnit, Quantity, Unit } from './types.js';

/**
 * Everything reduces to grams, millilitres, or countable units before the
 * shopping list does any arithmetic. Adding "2 tbsp" to "30ml" as strings is
 * how meal planners end up telling you to buy 1 olive oil.
 */

const TO_ML: Partial<Record<Unit, number>> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
  pinch: 0.5,
};

const TO_G: Partial<Record<Unit, number>> = {
  g: 1,
  kg: 1000,
};

/**
 * Reduce an authored quantity to g, ml or a count.
 *
 * Note there's no unit -> gram conversion here on purpose: that needs the
 * ingredient's own gramsPerUnit and belongs in `convertBase`, where the
 * shopping list decides on a single canonical unit per ingredient.
 */
export function toBase(q: Quantity): BaseQuantity {
  if (q.unit in TO_G) {
    return { amount: q.amount * TO_G[q.unit]!, unit: 'g' };
  }
  if (q.unit === 'unit') {
    // Countables stay countable. Converting "2 onions" to grams invents
    // precision the recipe author never had.
    return { amount: q.amount, unit: 'unit' };
  }
  if (q.unit in TO_ML) {
    return { amount: q.amount * TO_ML[q.unit]!, unit: 'ml' };
  }
  throw new Error(`Unhandled unit: ${q.unit}`);
}

export function addBase(a: BaseQuantity, b: BaseQuantity): BaseQuantity {
  if (a.unit !== b.unit) {
    throw new Error(`Cannot add ${a.unit} to ${b.unit} without a density`);
  }
  return { amount: a.amount + b.amount, unit: a.unit };
}

/**
 * The unit a given ingredient's shopping line is kept in.
 *
 * Recipes legitimately disagree: one calls for four slices of bread, another
 * for 200g of it. Both are right for a cook and useless for a shopping list,
 * so every ingredient declares one canonical unit — its pack unit — and
 * everything converts into that before any addition happens.
 */
export function canonicalUnitFor(ingredient: {
  pack?: BaseQuantity;
  gramsPerUnit?: number;
}): BaseUnit | null {
  return ingredient.pack?.unit ?? null;
}

/**
 * Convert between countable units and weight using the ingredient's own
 * gramsPerUnit. Returns null when the conversion isn't defined, so callers can
 * report a data problem rather than silently adding apples to millilitres.
 */
export function convertBase(
  q: BaseQuantity,
  target: BaseUnit,
  gramsPerUnit?: number,
  gramsPerMl?: number,
): BaseQuantity | null {
  if (q.unit === target) return q;
  if (q.unit === 'unit' && target === 'g') {
    return gramsPerUnit ? { amount: q.amount * gramsPerUnit, unit: 'g' } : null;
  }
  if (q.unit === 'g' && target === 'unit') {
    return gramsPerUnit ? { amount: q.amount / gramsPerUnit, unit: 'unit' } : null;
  }
  if (q.unit === 'ml' && target === 'g') {
    return gramsPerMl ? { amount: q.amount * gramsPerMl, unit: 'g' } : null;
  }
  if (q.unit === 'g' && target === 'ml') {
    return gramsPerMl ? { amount: q.amount / gramsPerMl, unit: 'ml' } : null;
  }
  // Anything else needs a conversion we deliberately don't guess at.
  return null;
}

export function scaleBase(q: BaseQuantity, factor: number): BaseQuantity {
  return { amount: q.amount * factor, unit: q.unit };
}

/**
 * Round a requirement up to whole retail packs.
 * Returns the pack count so the UI can say "2 × 400g tin" rather than "800g".
 */
export function roundToPacks(
  needed: BaseQuantity,
  pack?: BaseQuantity,
): { buy: BaseQuantity; packsToBuy?: number } {
  if (!pack || pack.unit !== needed.unit || pack.amount <= 0) {
    return { buy: { ...needed, amount: roundSensibly(needed) } };
  }
  const packs = Math.max(1, Math.ceil(needed.amount / pack.amount - 1e-9));
  return {
    buy: { amount: packs * pack.amount, unit: pack.unit },
    packsToBuy: packs,
  };
}

/** Nobody buys 237g of carrots. Round to something a human would write down. */
function roundSensibly(q: BaseQuantity): number {
  if (q.unit === 'unit') return Math.ceil(q.amount - 1e-9);
  if (q.amount < 20) return Math.ceil(q.amount);
  if (q.amount < 100) return Math.ceil(q.amount / 5) * 5;
  if (q.amount < 1000) return Math.ceil(q.amount / 25) * 25;
  return Math.ceil(q.amount / 100) * 100;
}

/** Human-readable rendering, promoting to kg/l where it reads better. */
export function formatQuantity(q: BaseQuantity): string {
  if (q.unit === 'unit') {
    const n = Math.round(q.amount * 100) / 100;
    return `${n}`;
  }
  if (q.unit === 'g' && q.amount >= 1000) {
    return `${trim(q.amount / 1000)}kg`;
  }
  if (q.unit === 'ml' && q.amount >= 1000) {
    return `${trim(q.amount / 1000)}l`;
  }
  return `${trim(q.amount)}${q.unit}`;
}

function trim(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}
