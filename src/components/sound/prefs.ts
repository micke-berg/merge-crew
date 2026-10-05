// The remembered mute setting. Storage can be missing or throw (private windows, blocked site
// data, server rendering); the setting then lives in memory for this page view.

export const MUTE_KEY = "merge-crew:sound-muted:v1";

export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readMuted(storage: KeyValueStore | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Returns false when the setting could not be saved. */
export function writeMuted(muted: boolean, storage: KeyValueStore | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(MUTE_KEY, muted ? "1" : "0");
    return true;
  } catch {
    return false;
  }
}
