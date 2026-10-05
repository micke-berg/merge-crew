"use client";

// Completed level ids, kept in the browser only (no accounts in v1). When storage is blocked,
// progress lasts for the page view (see src/lib/storage.ts).

import { useSyncExternalStore } from "react";
import { readItem, writeItem } from "@/lib/storage";

const KEY = "merge-crew:progress:v1";
const EVENT = "merge-crew:progress";
const EMPTY: readonly string[] = [];

let cachedRaw: string | null = null;
let cached: readonly string[] = EMPTY;

function parse(raw: string | null): readonly string[] {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : EMPTY;
  } catch {
    return EMPTY;
  }
}

function snapshot(): readonly string[] {
  const raw = readItem(KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function markLevelComplete(id: string): void {
  const done = snapshot();
  if (done.includes(id)) return;
  writeItem(KEY, JSON.stringify([...done, id]));
  window.dispatchEvent(new Event(EVENT));
}

/** Completed level ids. Empty during server rendering. */
export function useProgress(): readonly string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
