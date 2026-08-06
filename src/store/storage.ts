/**
 * Storage that works in a browser and inside a native shell.
 *
 * Native storage APIs are asynchronous, but every existing call site here reads
 * synchronously — `useState(loadHousehold)` and friends. Converting all of them
 * to promises would mean loading states threaded through the whole app for data
 * that is a few kilobytes.
 *
 * So: hydrate once at startup into an in-memory cache, then serve reads
 * synchronously from it and write through asynchronously in the background.
 * The app keeps its simple shape, and the native store still gets the data.
 *
 * Why not just localStorage inside the shell: on iOS, WebView local storage is
 * treated as cache and **can be purged by the OS when the device is low on
 * space**. A household losing its recipes and history to a storage sweep is a
 * silent, unexplainable data loss. Capacitor Preferences maps to
 * UserDefaults/SharedPreferences, which is not purged.
 */

type Backend = {
  name: 'preferences' | 'localStorage' | 'memory';
  getAll(): Promise<Record<string, string>>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

/** Keys the app persists. Listed so hydration can read them in one pass. */
export const STORAGE_KEYS = [
  'mp.household.v1',
  'mp.plan.v1',
  'mp.history.v1',
  'mp.feedback.v1',
  'mp.dismissed.v1',
  'mp.retailer.v1',
  'mp.weights.v1',
  'mp.recipes.v1',
  'mp.pantry.v1',
  'mp.session.v1',
  'mp.sync.code.v1',
  'mp.sync.version.v1',
] as const;

const cache = new Map<string, string>();
let backend: Backend | null = null;
let hydrated = false;

/**
 * Capacitor is an optional dependency: the same build runs as a website. The
 * dynamic import means the web bundle never has to resolve it.
 */
async function detectBackend(): Promise<Backend> {
  try {
    const anyWindow = globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    if (anyWindow.Capacitor?.isNativePlatform?.()) {
      const { Preferences } = await import('@capacitor/preferences');
      return {
        name: 'preferences',
        async getAll() {
          const out: Record<string, string> = {};
          for (const key of STORAGE_KEYS) {
            const { value } = await Preferences.get({ key });
            if (value != null) out[key] = value;
          }
          return out;
        },
        async set(key, value) {
          await Preferences.set({ key, value });
        },
        async remove(key) {
          await Preferences.remove({ key });
        },
      };
    }
  } catch {
    // Not a native build, or the plugin isn't installed. Fall through.
  }

  try {
    localStorage.getItem('mp.probe');
    return {
      name: 'localStorage',
      async getAll() {
        const out: Record<string, string> = {};
        for (const key of STORAGE_KEYS) {
          const value = localStorage.getItem(key);
          if (value != null) out[key] = value;
        }
        return out;
      },
      async set(key, value) {
        localStorage.setItem(key, value);
      },
      async remove(key) {
        localStorage.removeItem(key);
      },
    };
  } catch {
    // Private mode with storage disabled. The app still works for this session.
    return {
      name: 'memory',
      async getAll() {
        return {};
      },
      async set() {},
      async remove() {},
    };
  }
}

/** Called once before the app renders. */
export async function hydrateStorage(): Promise<void> {
  if (hydrated) return;
  backend = await detectBackend();
  const all = await backend.getAll();
  for (const [key, value] of Object.entries(all)) cache.set(key, value);
  hydrated = true;
}

export function storageBackend(): Backend['name'] | 'not-ready' {
  return backend?.name ?? 'not-ready';
}

export function readRaw(key: string): string | null {
  return cache.get(key) ?? null;
}

export function hasRaw(key: string): boolean {
  return cache.has(key);
}

/**
 * Writes update the cache immediately and persist in the background.
 *
 * A failed write must never break the interaction that triggered it — losing a
 * saved plan is bad, but freezing mid-swap because the disk is full is worse.
 */
export function writeRaw(key: string, value: string): void {
  cache.set(key, value);
  void backend?.set(key, value).catch(() => {});
}

export function removeRaw(key: string): void {
  cache.delete(key);
  void backend?.remove(key).catch(() => {});
}
