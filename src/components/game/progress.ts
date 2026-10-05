"use client";

// Completed level ids, kept in the browser only (no accounts in v1).
// Storage can be missing or throw (private windows, blocked site data); the game then simply
// forgets progress between visits.

import { useSyncExternalStore } from "react";

const KEY = "merge-crew:progress:v1";
const EVENT = "merge-crew:progress";
const EMPTY: readonly string[] = [];

let cachedRaw: string | null = null;
let cached: readonly string[] = EMPTY;
/** Set when storage refused a write: progress then lives in memory for this page view. */
let memory: readonly string[] | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

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
  if (memory) return memory;
  const raw = readRaw();
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
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...done, id]));
  } catch {
    // Storage unavailable: progress lasts only for this page view.
    memory = [...done, id];
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Completed level ids. Empty during server rendering. */
export function useProgress(): readonly string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
