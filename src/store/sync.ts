/**
 * Cross-device sync.
 *
 * The whole design is one shareable code per household. One phone creates a
 * code; the others join with it; from then on each device pushes its shared
 * state up and pulls the others' down, so a family plan lives on every phone
 * instead of trapped on the one that made it.
 *
 * There are no accounts and no passwords: the code *is* the key, like a shared
 * link. That's the right amount of security for a household meal plan and the
 * only amount a family will actually tolerate. Sync is entirely opt-in —
 * nothing leaves the device until someone creates or joins a code.
 *
 * Conflicts are resolved last-write-wins against a version number. Two parents
 * editing the same second is rare; when it happens the later save wins and the
 * other device adopts it on its next pull, which is predictable even if it
 * occasionally costs a change. The network itself lives in the tiny functions
 * at the bottom; everything above is pure and tested.
 */

/** No ambiguous characters (0/O, 1/I/L) — codes get read aloud and typed in. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_BODY = /^[2-9A-HJ-NP-Z]{5}$/;
export const CODE_RE = /^MEAL-[2-9A-HJ-NP-Z]{5}$/;

/** A fresh, human-friendly code like `MEAL-7QK2Z`. */
export function generateCode(): string {
  const bytes = new Uint32Array(5);
  crypto.getRandomValues(bytes);
  let body = '';
  for (const n of bytes) body += ALPHABET[n % ALPHABET.length];
  return `MEAL-${body}`;
}

/**
 * Tidy what someone typed into a canonical code, or return null if it can't be
 * one. Forgiving on input: case, spaces, a missing `MEAL-` prefix, and a
 * hyphen typed as a space all still resolve.
 */
export function normaliseCode(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/[\s-]+/g, '');
  const body = cleaned.startsWith('MEAL') ? cleaned.slice(4) : cleaned;
  if (!CODE_BODY.test(body)) return null;
  return `MEAL-${body}`;
}

// ---------------------------------------------------------------------------
// The network (kept minimal — the logic above is what's tested)
// ---------------------------------------------------------------------------

export interface RemoteState {
  version: number;
  blob: Record<string, string>;
}

export type PushResult =
  | { ok: true; version: number }
  | { conflict: true; current: RemoteState };

/** Fetch the household's state, or null if the code has never been written. */
export async function pull(
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RemoteState | null> {
  const res = await fetchImpl(`/api/sync?code=${encodeURIComponent(code)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('sync-unavailable');
  return (await res.json()) as RemoteState;
}

/**
 * Push local state. If the server has a newer version than the one we based
 * this on, it returns that instead of overwriting — the caller adopts it.
 */
export async function push(
  code: string,
  blob: Record<string, string>,
  baseVersion: number,
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult> {
  const res = await fetchImpl('/api/sync', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, baseVersion, blob }),
  });
  if (res.status === 409) {
    return { conflict: true, current: (await res.json()) as RemoteState };
  }
  if (!res.ok) throw new Error('sync-unavailable');
  const body = (await res.json()) as { version: number };
  return { ok: true, version: body.version };
}
