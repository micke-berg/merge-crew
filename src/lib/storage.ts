// Small values kept in the browser, such as finished levels and the mute setting.
//
// Storage can be missing or throw: private windows, blocked site data, server rendering. Reads
// then return null, and a refused write is kept in memory for the rest of the page view, so the
// game behaves the same and only forgets the value on the next visit.

export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/** The page's localStorage, or null where there is none or it may not be touched. */
export function browserStorage(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

// Values that a storage refused, per storage. `null` stands for "no storage at all".
const fallbacks = new WeakMap<KeyValueStore, Map<string, string>>();
const noStorage = new Map<string, string>();

function fallback(storage: KeyValueStore | null): Map<string, string> {
  if (!storage) return noStorage;
  let m = fallbacks.get(storage);
  if (!m) {
    m = new Map();
    fallbacks.set(storage, m);
  }
  return m;
}

export function readItem(key: string, storage: KeyValueStore | null = browserStorage()): string | null {
  const kept = fallback(storage).get(key);
  if (kept !== undefined) return kept;
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns false when the value could not be saved and lives in memory only. */
export function writeItem(key: string, value: string, storage: KeyValueStore | null = browserStorage()): boolean {
  if (storage) {
    try {
      storage.setItem(key, value);
      fallback(storage).delete(key);
      return true;
    } catch {
      // Fall through to memory.
    }
  }
  fallback(storage).set(key, value);
  return false;
}
