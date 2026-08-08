import { useState } from 'react';

interface Props {
  /** The household's sync code, or null when this device isn't syncing. */
  code: string | null;
  busy: boolean;
  /** A plain line about the last sync — what happened, or what went wrong. */
  status: string | null;
  onCreate: () => void;
  /** Raw text from the join field; the caller normalises and validates it. */
  onJoin: (code: string) => void;
  onSyncNow: () => void;
  onStop: () => void;
}

/**
 * Sync settings.
 *
 * Deliberately blunt about the trade-off: everything is on this device until
 * you choose otherwise, and choosing otherwise means the plan lives on a
 * server so another phone can see it. A family should understand that before
 * they turn it on, not discover it afterwards.
 */
export function SyncPanel({ code, busy, status, onCreate, onJoin, onSyncNow, onStop }: Props) {
  const [entry, setEntry] = useState('');
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!code) return;
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  return (
    <>
      <p className="eyebrow">Sync across devices</p>

      {!code ? (
        <div className="editor-block">
          <p className="field__hint" style={{ marginTop: 0 }}>
            Everything is kept on this device only. Turn on sync to share the plan,
            shopping list and settings with another phone — one person creates a
            code, everyone else joins with it. Your data is then stored online so
            the other device can read it; it stays off until you choose this.
          </p>

          <button className="btn btn--primary" onClick={onCreate} disabled={busy}>
            {busy ? 'Working…' : 'Create a sync code'}
          </button>

          <p className="eyebrow" style={{ marginTop: 20 }}>
            Or join a household
          </p>
          <div className="field-row">
            <label className="field">
              <span>Enter the code</span>
              <input
                value={entry}
                placeholder="MEAL-7QK2Z"
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => setEntry(e.target.value)}
              />
            </label>
            <button
              className="btn"
              onClick={() => onJoin(entry)}
              disabled={busy || entry.trim().length === 0}
            >
              Join
            </button>
          </div>
        </div>
      ) : (
        <div className="editor-block">
          <p className="field__hint" style={{ marginTop: 0 }}>
            This device shares its plan with everyone using this code. Enter it on
            another phone under “Or join a household” to bring it in.
          </p>

          <div className="sync-code">
            <span className="sync-code__value">{code}</span>
            <button className="btn btn--ghost" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="actions" style={{ marginTop: 16 }}>
            <button className="btn btn--primary" onClick={onSyncNow} disabled={busy}>
              {busy ? 'Syncing…' : 'Sync now'}
            </button>
            <button className="btn btn--ghost" onClick={onStop} disabled={busy}>
              Stop syncing here
            </button>
          </div>
        </div>
      )}

      {status && (
        <p className="suggestion__evidence" role="status" style={{ marginTop: 4 }}>
          {status}
        </p>
      )}
    </>
  );
}
