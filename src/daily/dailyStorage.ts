"use client";

// The player's daily incident record and today's number, kept in the browser only.

import { useSyncExternalStore } from "react";
import { readItem, writeItem } from "@/lib/storage";
import { NO_RECORD, dayNumber, parseRecord, recordSolve, type DailyRecord } from "./daily";

const KEY = "merge-crew:daily:v1";
const EVENT = "merge-crew:daily";

let cachedRaw: string | null = null;
let cached: DailyRecord = NO_RECORD;

function snapshot(): DailyRecord {
  const raw = readItem(KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseRecord(raw);
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

export function saveSolve(number: number, result: { moves: number; hints: number }): void {
  const before = snapshot();
  const after = recordSolve(before, number, result);
  if (after === before) return;
  writeItem(KEY, JSON.stringify(after));
  window.dispatchEvent(new Event(EVENT));
}

/** The player's record. Empty during server rendering. */
export function useDailyRecord(): DailyRecord {
  return useSyncExternalStore(subscribe, snapshot, () => NO_RECORD);
}

const never = () => () => undefined;

/** Today's incident number, or null during server rendering (the server's day is not the player's concern). */
export function useToday(): number | null {
  return useSyncExternalStore(never, () => dayNumber(Date.now()), () => null);
}

/** The count to beat from this page's challenge link (`?beat=4`), or null. Null during server rendering. */
export function useSearchValue(name: string): string | null {
  return useSyncExternalStore(never, () => new URLSearchParams(window.location.search).get(name), () => null);
}
