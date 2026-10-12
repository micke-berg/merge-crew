"use client";

// Which levels this browser has already played the intro of. A returning player goes straight to
// their turn and can replay the intro from the level header. When storage is blocked, the answer
// lasts for the page view.

import { useSyncExternalStore } from "react";
import { readItem, writeItem, type KeyValueStore } from "@/lib/storage";

const KEY = "merge-crew:intro-seen:v1";
const EVENT = "merge-crew:intro";

function read(storage?: KeyValueStore | null): string[] {
  const raw = storage === undefined ? readItem(KEY) : readItem(KEY, storage);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[], storage?: KeyValueStore | null): void {
  const text = JSON.stringify(ids);
  if (storage === undefined) writeItem(KEY, text);
  else writeItem(KEY, text, storage);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function introSeen(levelId: string, storage?: KeyValueStore | null): boolean {
  return read(storage).includes(levelId);
}

export function markIntroSeen(levelId: string, storage?: KeyValueStore | null): void {
  const ids = read(storage);
  if (!ids.includes(levelId)) write([...ids, levelId], storage);
}

/** The player asked to see the intro again. */
export function forgetIntro(levelId: string, storage?: KeyValueStore | null): void {
  const ids = read(storage);
  if (ids.includes(levelId)) write(ids.filter((id) => id !== levelId), storage);
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
 * True once this level's intro has been played. During server rendering it reports true, so the
 * server never renders the brief card and a returning player never sees it flash; a first-time
 * player gets the card right after hydration.
 */
export function useIntroSeen(levelId: string): boolean {
  return useSyncExternalStore(subscribe, () => introSeen(levelId), () => true);
}
