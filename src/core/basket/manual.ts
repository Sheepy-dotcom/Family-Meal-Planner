import { AISLE_LABELS, aisleOrder } from '../shopping/list.js';
import { formatQuantity } from '../units.js';
import type { ShoppingList } from '../types.js';
import type { FlaggedLine } from '../diet/screen.js';
import { flagSentence } from '../diet/screen.js';
import type { BasketAdapter, BasketItem, BasketResult } from './adapter.js';

/**
 * Rung 1: produce a list a human can shop from or paste into a retailer's
 * "add multiple items" box. Unglamorous, works everywhere, no ToS problems,
 * and it establishes the shape the partner adapters have to fit.
 */
export const manualExportAdapter: BasketAdapter = {
  id: 'manual',
  label: 'Copy list',

  async send(list: ShoppingList, flagged: FlaggedLine[]): Promise<BasketResult> {
    const heldForReview: BasketItem[] = flagged.map((f) => ({
      ingredientId: f.line.ingredientId,
      name: f.line.name,
      quantity: formatQuantity(f.line.buy),
      packsToBuy: f.line.packsToBuy,
    }));

    const sections: string[] = [];

    for (const aisle of aisleOrder()) {
      const lines = list.linesByAisle[aisle];
      if (lines.length === 0) continue;
      sections.push(
        `${AISLE_LABELS[aisle].toUpperCase()}\n` +
          lines.map((l) => `  ${renderLine(l.name, l.buy, l.packsToBuy)}`).join('\n'),
      );
    }

    if (list.checkCupboard.length > 0) {
      sections.push(
        'CHECK YOU HAVE\n' +
          list.checkCupboard.map((l) => `  ${l.name}`).join('\n'),
      );
    }

    if (flagged.length > 0) {
      sections.push(
        'CHECK THE PACK\n' + flagged.map((f) => `  ${flagSentence(f)}`).join('\n'),
      );
    }

    return {
      status: 'exported',
      text: sections.join('\n\n'),
      heldForReview,
      message:
        flagged.length > 0
          ? `List ready. ${flagged.length} item${flagged.length === 1 ? '' : 's'} need checking against the pack.`
          : 'List ready.',
    };
  },
};

function renderLine(
  name: string,
  buy: { amount: number; unit: 'g' | 'ml' | 'unit' },
  packs?: number,
): string {
  // "8 lemons" beats "2 × pack of 4" — nobody shops by pack count for
  // countables. Weights are the opposite: "2 × 400g" is how the tins stack up.
  if (buy.unit === 'unit') return `${name} — ${formatQuantity(buy)}`;
  if (packs && packs > 1) {
    return `${name} — ${packs} × ${formatQuantity({
      amount: buy.amount / packs,
      unit: buy.unit,
    })}`;
  }
  return `${name} — ${formatQuantity(buy)}`;
}
