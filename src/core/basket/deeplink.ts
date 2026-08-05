import { AISLE_LABELS, aisleOrder } from '../shopping/list.js';
import { formatQuantity } from '../units.js';
import type { ShoppingList } from '../types.js';
import type { FlaggedLine } from '../diet/screen.js';
import { flagSentence } from '../diet/screen.js';
import type { BasketAdapter, BasketItem, BasketResult } from './adapter.js';

/**
 * Rung 2: hand the list off to a retailer's own search.
 *
 * No sanctioned write API exists for UK grocery baskets, and reverse-engineered
 * basket endpoints are a treadmill against people actively trying to stop you —
 * plus terms-of-service violations that make the product unfundable. What *is*
 * stable and permitted is a search URL. The user stays in control, the retailer
 * gets its own traffic, and nothing here breaks when a private endpoint changes.
 *
 * The honest limitation: this opens a tab per item. It's a real improvement on
 * typing, and it is not the seamless thing. Rung 3 needs a commercial
 * agreement, and the interface is shaped so that swapping this out touches only
 * this file.
 */

export interface Retailer {
  id: string;
  label: string;
  /** Builds a search URL for a product name. */
  searchUrl: (query: string) => string;
  /** Where the user goes to review what they've added. */
  basketUrl: string;
}

export const RETAILERS: Retailer[] = [
  {
    id: 'tesco',
    label: 'Tesco',
    searchUrl: (q) =>
      `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(q)}`,
    basketUrl: 'https://www.tesco.com/groceries/en-GB/basket',
  },
  {
    id: 'sainsburys',
    label: "Sainsbury's",
    searchUrl: (q) =>
      `https://www.sainsburys.co.uk/gol-ui/SearchResults/${encodeURIComponent(q)}`,
    basketUrl: 'https://www.sainsburys.co.uk/gol-ui/trolley',
  },
  {
    id: 'ocado',
    label: 'Ocado',
    searchUrl: (q) =>
      `https://www.ocado.com/search?entry=${encodeURIComponent(q)}`,
    basketUrl: 'https://www.ocado.com/checkout/trolley',
  },
  {
    id: 'waitrose',
    label: 'Waitrose',
    searchUrl: (q) =>
      `https://www.waitrose.com/ecom/shop/search?&searchTerm=${encodeURIComponent(q)}`,
    basketUrl: 'https://www.waitrose.com/ecom/trolley',
  },
];

export interface DeepLinkItem extends BasketItem {
  url: string;
  /** True when this item needs checking against the pack before buying. */
  needsCheck: boolean;
  checkReason?: string;
}

export interface DeepLinkResult extends BasketResult {
  items: DeepLinkItem[];
  retailer: Retailer;
}

/**
 * Search terms are built from the ingredient name plus the pack size, because
 * "chickpeas" and "chickpeas 400g" return very different first results. Nothing
 * about the household goes into the URL — see the privacy note in the README.
 */
function searchTermFor(name: string, packSize?: string): string {
  return packSize ? `${name} ${packSize}` : name;
}

export function makeDeepLinkAdapter(retailer: Retailer): BasketAdapter {
  return {
    id: `deeplink:${retailer.id}`,
    label: `Open in ${retailer.label}`,

    async send(list: ShoppingList, flagged: FlaggedLine[]): Promise<DeepLinkResult> {
      const flaggedIds = new Map(
        flagged.map((f) => [f.line.ingredientId, flagSentence(f)]),
      );

      const items: DeepLinkItem[] = [];
      for (const aisle of aisleOrder()) {
        for (const line of list.linesByAisle[aisle]) {
          const packSize =
            line.packsToBuy && line.buy.unit !== 'unit'
              ? formatQuantity({
                  amount: line.buy.amount / line.packsToBuy,
                  unit: line.buy.unit,
                })
              : undefined;
          const term = searchTermFor(line.name, packSize);
          items.push({
            ingredientId: line.ingredientId,
            name: line.name,
            quantity: formatQuantity(line.buy),
            packsToBuy: line.packsToBuy,
            url: retailer.searchUrl(term),
            needsCheck: flaggedIds.has(line.ingredientId),
            checkReason: flaggedIds.get(line.ingredientId),
          });
        }
      }

      const checks = items.filter((i) => i.needsCheck).length;

      return {
        status: 'handed-off',
        retailer,
        url: retailer.basketUrl,
        items,
        heldForReview: items.filter((i) => i.needsCheck),
        text: renderText(list, flagged, retailer),
        message:
          checks > 0
            ? `${items.length} items ready for ${retailer.label}. ${checks} need checking against the pack before you add them.`
            : `${items.length} items ready for ${retailer.label}.`,
      };
    },
  };
}

function renderText(
  list: ShoppingList,
  flagged: FlaggedLine[],
  retailer: Retailer,
): string {
  const sections: string[] = [`Shopping list — ${retailer.label}`];
  for (const aisle of aisleOrder()) {
    const lines = list.linesByAisle[aisle];
    if (lines.length === 0) continue;
    sections.push(
      `${AISLE_LABELS[aisle].toUpperCase()}\n` +
        lines.map((l) => `  ${l.name} — ${formatQuantity(l.buy)}`).join('\n'),
    );
  }
  if (flagged.length > 0) {
    sections.push('CHECK THE PACK\n' + flagged.map((f) => `  ${flagSentence(f)}`).join('\n'));
  }
  return sections.join('\n\n');
}

export const deepLinkAdapters: BasketAdapter[] = RETAILERS.map(makeDeepLinkAdapter);
