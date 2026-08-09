import { useState } from 'react';
import { AISLE_LABELS, aisleOrder } from '../../core/shopping/list.js';
import { flagSentence } from '../../core/diet/screen.js';
import { formatQuantity } from '../../core/units.js';
import { manualExportAdapter } from '../../core/basket/manual.js';
import { RETAILERS, makeDeepLinkAdapter } from '../../core/basket/deeplink.js';
import type { DeepLinkResult } from '../../core/basket/deeplink.js';
import type { FlaggedLine } from '../../core/diet/screen.js';
import type { BaseQuantity, ShoppingList } from '../../core/types.js';
import { applyPantry, coverageNote, pantrySummary } from '../../core/pantry/pantry.js';
import type { Pantry } from '../../core/pantry/pantry.js';

interface Props {
  list: ShoppingList;
  flagged: FlaggedLine[];
  retailer: string;
  pantry: Pantry;
  onRetailerChange: (id: string) => void;
  onToggleHave: (ingredientId: string) => void;
  onToggleAlwaysStocked: (ingredientId: string) => void;
}

export function ShoppingPanel({
  list,
  flagged,
  retailer,
  pantry,
  onRetailerChange,
  onToggleHave,
  onToggleAlwaysStocked,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [links, setLinks] = useState<DeepLinkResult | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const chosen = RETAILERS.find((r) => r.id === retailer);
  // What you actually need, after what you already have.
  const adjusted = applyPantry(list, pantry);
  const summary = pantrySummary(adjusted);

  async function openInRetailer() {
    if (!chosen) return;
    const adapter = makeDeepLinkAdapter(chosen);
    setLinks((await adapter.send(asShoppingList(adjusted, list), flagged)) as DeepLinkResult);
  }

  async function copyList() {
    const result = await manualExportAdapter.send(asShoppingList(adjusted, list), flagged);
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked. The list is on screen either way.
    }
  }

  return (
    <section className="panel">
      {/* The masthead already titles this tab — this row is just the controls. */}
      <div className="masthead" style={{ borderBottom: 'none', paddingBottom: 0, justifyContent: 'flex-end' }}>
        <div className="actions">
          <select
            value={retailer}
            onChange={(e) => {
              onRetailerChange(e.target.value);
              setLinks(null);
            }}
            aria-label="Where you shop"
          >
            <option value="manual">Just the list</option>
            {RETAILERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          {chosen ? (
            <button className="btn" onClick={openInRetailer}>
              Open in {chosen.label}
            </button>
          ) : (
            <button className="btn" onClick={copyList}>
              {copied ? 'Copied' : 'Copy list'}
            </button>
          )}
        </div>
      </div>

      {links && (
        <div className="handoff">
          <p className="handoff__message">{links.message}</p>
          <p className="field__hint">
            Each item opens {chosen?.label}'s own search. No supermarket offers a way
            to fill a basket from outside, so you add the products — this just saves
            the typing.
          </p>
          <div className="handoff__links">
            {links.items.map((item) => (
              <a
                key={item.ingredientId}
                href={item.url}
                className={`handoff__link ${item.needsCheck ? 'handoff__link--check' : ''}`}
                title={item.checkReason ?? `Search ${chosen?.label} for ${item.name}`}
              >
                {item.name}
                <span className="qty">{item.quantity}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {flagged.length > 0 && (
        <div className="warn" style={{ marginTop: 24 }}>
          <h3>Check the pack</h3>
          <ul>
            {flagged.map((f) => (
              <li key={f.line.ingredientId}>{flagSentence(f)}</li>
            ))}
          </ul>
          <p>
            This check reads our own ingredient data. It can't see reformulations,
            "may contain" warnings, or what gets substituted on delivery day — so
            read the label before you buy.
          </p>
        </div>
      )}

      {summary && (
        <div className="pantry-summary">
          <span>{summary}</span>
          <button
            className="btn btn--ghost"
            onClick={() => setShowSkipped(!showSkipped)}
            aria-expanded={showSkipped}
          >
            {showSkipped ? 'Hide' : 'Show'}
          </button>
        </div>
      )}

      {showSkipped && adjusted.skipped.length > 0 && (
        <div className="editor-block">
          <p className="field__hint" style={{ marginTop: 0 }}>
            Left off the list — tap to put back
          </p>
          {adjusted.skipped.map((line) => (
            <div className="review-row" key={line.ingredientId}>
              <div>
                <p className="suggestion__text">{line.name}</p>
                <p className="suggestion__evidence">{coverageNote(line)}</p>
              </div>
              <button
                className="btn btn--ghost"
                onClick={() =>
                  line.reason === 'always-stocked'
                    ? onToggleAlwaysStocked(line.ingredientId)
                    : onToggleHave(line.ingredientId)
                }
              >
                Put back
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="aisles">
        {aisleOrder().map((aisle) => {
          const lines = adjusted.linesByAisle[aisle];
          if (lines.length === 0) return null;
          return (
            <div className="aisle" key={aisle}>
              <p className="aisle__name">{AISLE_LABELS[aisle]}</p>
              <ul>
                {lines.map((line) => (
                  <li key={line.ingredientId}>
                    {/* Ticking off happens here, while reviewing the list —
                        the one moment someone is already thinking about
                        whether they have each thing. A separate pantry screen
                        is a screen nobody visits. */}
                    <button
                      className="aisle__have"
                      onClick={() => onToggleHave(line.ingredientId)}
                      aria-label={`I already have ${line.name}`}
                      title="I've already got this"
                    >
                      <span title={`For ${line.usedBy.join(', ')}`}>{line.name}</span>
                      {coverageNote(line) && (
                        <em className="aisle__note">{coverageNote(line)}</em>
                      )}
                    </button>
                    <span className="qty">{renderAmount(line.buy, line.packsToBuy)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {adjusted.checkCupboard.length > 0 && (
          <div className="aisle">
            <p className="aisle__name">Check you have</p>
            <ul>
              {adjusted.checkCupboard.map((line) => (
                <li key={line.ingredientId}>
                  <button
                    className="aisle__have"
                    onClick={() => onToggleAlwaysStocked(line.ingredientId)}
                    title="I always have this — stop asking"
                  >
                    {line.name}
                  </button>
                  <span className="qty">always?</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The export adapters take a ShoppingList. Handing them the pantry-adjusted
 * lines means the copied list and the retailer handoff match what's on screen —
 * a list that differs from the one you exported is worse than no export.
 */
function asShoppingList(
  adjusted: ReturnType<typeof applyPantry>,
  original: ShoppingList,
): ShoppingList {
  return {
    weekStartISO: original.weekStartISO,
    linesByAisle: adjusted.linesByAisle,
    checkCupboard: adjusted.checkCupboard,
  };
}

function renderAmount(buy: BaseQuantity, packs?: number): string {
  if (buy.unit === 'unit') return formatQuantity(buy);
  if (packs && packs > 1) {
    return `${packs} × ${formatQuantity({ amount: buy.amount / packs, unit: buy.unit })}`;
  }
  return formatQuantity(buy);
}
