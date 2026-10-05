"use client";

// Whether this browser has seen the opening story. Shown once on the first visit and replayable
// from the start screen. When storage is blocked, the answer lasts for the page view.

import { useSyncExternalStore } from "react";
import { readItem, writeItem, type KeyValueStore } from "@/lib/storage";

const KEY = "merge-crew:premise-seen:v1";
const EVENT = "merge-crew:premise";

export function premiseSeen(storage?: KeyValueStore | null): boolean {
  return (storage === undefined ? readItem(KEY) : readItem(KEY, storage)) === "1";
}

export function markPremiseSeen(storage?: KeyValueStore | null): void {
  if (storage === undefined) writeItem(KEY, "1");
  else writeItem(KEY, "1", storage);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/**
 * True once the opening has been seen. During server rendering it reports true, so the server never
 * renders the opening and a returning player never sees it flash; a first-time player gets it right
 * after hydration.
 */
export function usePremiseSeen(): boolean {
  return useSyncExternalStore(subscribe, () => premiseSeen(), () => true);
}
