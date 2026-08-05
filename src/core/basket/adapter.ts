import type { ShoppingList } from '../types.js';
import type { FlaggedLine } from '../diet/screen.js';

/**
 * The seam where this eventually meets a supermarket.
 *
 * There is currently no sanctioned way to fill a UK grocery basket from a
 * third-party app: Tesco's public developer portal is closed, the commercial
 * "grocery APIs" on the market are read-only scrapers, and the retailers'
 * own ordering flows are deliberately closed because they compete for the
 * same delivery customer. The realistic ladder is:
 *
 *   1. copy/export list            <- implemented today
 *   2. deep links into store search
 *   3. affiliate or partner basket handoff (needs a commercial agreement)
 *
 * Everything above this interface is written so that swapping rung 1 for
 * rung 3 touches exactly one file. Anything that needs credentials moves
 * server-side at that point; nothing here assumes a browser.
 */

export interface BasketItem {
  ingredientId: string;
  name: string;
  quantity: string;
  packsToBuy?: number;
  /** Retailer product id, once a mapping layer exists. */
  retailerSku?: string;
}

export interface BasketResult {
  status: 'exported' | 'handed-off' | 'failed';
  /** Where the user goes next, if anywhere. */
  url?: string;
  /** Plain-text fallback, always populated. */
  text: string;
  /** Items the adapter refused to add without confirmation. */
  heldForReview: BasketItem[];
  message: string;
}

export interface BasketAdapter {
  id: string;
  label: string;
  /**
   * Items matching someone's dietary exclusions are never added silently.
   * A picker substitution can undo any filtering we do, so the user confirms
   * these against the actual pack.
   */
  send(list: ShoppingList, flagged: FlaggedLine[]): Promise<BasketResult>;
}
