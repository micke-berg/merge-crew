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

// The fewest moves each level was won in, for the "on par" mark in the level list.

const BEST_KEY = "merge-crew:best:v1";
const NO_BEST: Readonly<Record<string, number>> = {};
let bestRaw: string | null = null;
let best: Readonly<Record<string, number>> = NO_BEST;

function parseBest(raw: string | null): Readonly<Record<string, number>> {
  if (!raw) return NO_BEST;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return NO_BEST;
    const out: Record<string, number> = {};
    for (const [id, n] of Object.entries(value)) {
      if (typeof n === "number" && Number.isInteger(n) && n >= 0) out[id] = n;
    }
    return out;
  } catch {
    return NO_BEST;
  }
}

function bestSnapshot(): Readonly<Record<string, number>> {
  const raw = readItem(BEST_KEY);
  if (raw !== bestRaw) {
    bestRaw = raw;
    best = parseBest(raw);
  }
  return best;
}

/** Remember a win's move count if it is the player's best for that level. */
export function recordBest(id: string, moves: number): void {
  const all = bestSnapshot();
  if (Object.hasOwn(all, id) && all[id] <= moves) return;
  writeItem(BEST_KEY, JSON.stringify({ ...all, [id]: moves }));
  window.dispatchEvent(new Event(EVENT));
}

/** Fewest moves per completed level id. Empty during server rendering. */
export function useBest(): Readonly<Record<string, number>> {
  return useSyncExternalStore(subscribe, bestSnapshot, () => NO_BEST);
}
