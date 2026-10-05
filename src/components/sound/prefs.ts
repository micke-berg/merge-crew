// The remembered mute setting. See src/lib/storage.ts for what happens when storage is blocked.

import { readItem, writeItem, type KeyValueStore } from "@/lib/storage";

export type { KeyValueStore };

export const MUTE_KEY = "merge-crew:sound-muted:v1";

export function readMuted(storage?: KeyValueStore | null): boolean {
  return readItem(MUTE_KEY, storage) === "1";
}

/** Returns false when the setting could not be saved. */
export function writeMuted(muted: boolean, storage?: KeyValueStore | null): boolean {
  return writeItem(MUTE_KEY, muted ? "1" : "0", storage);
}
