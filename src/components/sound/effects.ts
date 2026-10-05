// Event sounds as note lists, plus the mapping from a map schedule to sounds. Pure.

import type { Schedule } from "@/components/map/timeline";
import type { Note } from "./notes";

export type Effect =
  | "commit"
  | "hop"
  | "branch"
  | "lost"
  | "recovered"
  | "forcePush"
  | "conflict"
  | "goal"
  | "win"
  | "error"
  | "click";

export const EFFECTS: readonly Effect[] = [
  "commit", "hop", "branch", "lost", "recovered", "forcePush", "conflict", "goal", "win", "error", "click",
];

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.5;

function recipe(effect: Effect): Note[] {
  switch (effect) {
    // A round bubble pop: a quick upward sine sweep.
    case "commit":
      return [
        { at: 0, dur: 0.1, wave: "sine", freq: 480, freqEnd: 1000, gain: 0.5, attack: 0.004 },
        { at: 0, dur: 0.04, wave: "noise", freq: 0, gain: 0.08, attack: 0.002, filter: { type: "bandpass", freq: 2500, q: 2 } },
      ];
    // A springy boing: rises and wobbles.
    case "hop":
      return [
        {
          at: 0, dur: 0.24, wave: "triangle", freq: 170, freqEnd: 430, gain: 0.45, attack: 0.006,
          vibrato: { rate: 16, depth: 70 }, filter: { type: "lowpass", freq: 1800 },
        },
      ];
    // Air moving past: filtered noise sweeping up.
    case "branch":
      return [
        { at: 0, dur: 0.32, wave: "noise", freq: 0, gain: 0.3, attack: 0.1, filter: { type: "bandpass", freq: 500, freqEnd: 2600, q: 1.4 } },
      ];
    // Things crumbling away: falling knocks over a gritty rumble.
    case "lost": {
      const steps = [440, 370, 311, 262, 220, 185];
      return [
        ...steps.map((f, i): Note => ({
          at: i * 0.075, dur: 0.09, wave: "triangle", freq: f, freqEnd: f * 0.8, gain: 0.32 - i * 0.03, attack: 0.004,
          filter: { type: "lowpass", freq: 1400 },
        })),
        { at: 0, dur: 0.55, wave: "noise", freq: 0, gain: 0.12, attack: 0.02, filter: { type: "bandpass", freq: 1200, freqEnd: 300, q: 1.5 } },
      ];
    }
    // A rising sparkle.
    case "recovered":
      return [G5, C6, E6, G5 * 2].map((f, i): Note => ({
        at: i * 0.075, dur: 0.38, wave: "sine", freq: f, gain: 0.26, attack: 0.005,
      }));
    // The dramatic one: a falling noise wash over a soft thump. Still kept well under the limiter.
    case "forcePush":
      return [
        { at: 0, dur: 0.4, wave: "sine", freq: 130, freqEnd: 42, gain: 0.7, attack: 0.005 },
        { at: 0, dur: 0.8, wave: "noise", freq: 0, gain: 0.42, attack: 0.006, filter: { type: "lowpass", freq: 3200, freqEnd: 300, q: 0.8 } },
        { at: 0.03, dur: 0.5, wave: "sawtooth", freq: 98, freqEnd: 55, gain: 0.18, attack: 0.01, filter: { type: "lowpass", freq: 600 } },
      ];
    // Two warning blips, high then low.
    case "conflict":
      return [
        { at: 0, dur: 0.1, wave: "square", freq: 740, gain: 0.16, attack: 0.005, filter: { type: "lowpass", freq: 1600 } },
        { at: 0.14, dur: 0.12, wave: "square", freq: 587, gain: 0.16, attack: 0.005, filter: { type: "lowpass", freq: 1600 } },
      ];
    // A small bell.
    case "goal":
      return [
        { at: 0, dur: 0.55, wave: "sine", freq: E6, gain: 0.3, attack: 0.004 },
        { at: 0, dur: 0.18, wave: "sine", freq: E6 * 2.01, gain: 0.07, attack: 0.004 },
      ];
    // A short happy jingle, about 1.3 s.
    case "win": {
      const melody: [number, number][] = [[C5, 0], [E5, 0.11], [G5, 0.22], [C6, 0.33], [G5, 0.5], [C6, 0.6]];
      return [
        ...melody.map(([f, at]): Note => ({
          at, dur: 0.16, wave: "triangle", freq: f, gain: 0.32, attack: 0.006, filter: { type: "lowpass", freq: 3000 },
        })),
        // The final chord rings out.
        ...[C6, E6, G5].map((f): Note => ({
          at: 0.72, dur: 0.6, wave: "triangle", freq: f, gain: 0.18, attack: 0.01, filter: { type: "lowpass", freq: 2600 },
        })),
        { at: 0.72, dur: 0.5, wave: "sine", freq: C6 * 2, gain: 0.06, attack: 0.01, vibrato: { rate: 7, depth: 20 } },
      ];
    }
    // A soft, low "nope".
    case "error":
      return [
        { at: 0, dur: 0.2, wave: "sawtooth", freq: 120, freqEnd: 98, gain: 0.22, attack: 0.008, filter: { type: "lowpass", freq: 520, q: 1.5 } },
      ];
    // A tiny tick.
    case "click":
      return [{ at: 0, dur: 0.03, wave: "sine", freq: 1700, freqEnd: 1300, gain: 0.18, attack: 0.002 }];
  }
}

const cache = new Map<Effect, Note[]>();

export function effectNotes(effect: Effect): readonly Note[] {
  let notes = cache.get(effect);
  if (!notes) {
    notes = recipe(effect);
    cache.set(effect, notes);
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Map schedule -> sounds
// ---------------------------------------------------------------------------

export type Cue = { at: number; effect: Effect };

/** Which sound wins when several things happen at once. Highest first. */
const PRIORITY: Effect[] = ["forcePush", "lost", "recovered", "conflict", "commit", "branch", "hop"];

/** Events closer together than this (ms) play as one sound. */
export const MERGE_MS = 40;

/**
 * The sounds for one map playback, in ms from its start. Events that happen together (a commit, its
 * branch moving and its robot hopping) play only the most important sound, so nothing piles up.
 */
export function scheduleCues(s: Schedule): Cue[] {
  const raw: Cue[] = [];
  const add = (at: number, effect: Effect) => raw.push({ at, effect });
  for (const at of s.shakes) add(at, "forcePush");
  for (const at of s.lose.values()) add(at, "lost");
  for (const at of s.recover.values()) add(at, "recovered");
  for (const at of s.conflict.values()) add(at, "conflict");
  for (const at of s.appear.values()) add(at, "commit");
  for (const { at } of s.branch.values()) add(at, "branch");
  for (const { at, forced } of s.remote.values()) if (!forced) add(at, "branch");
  for (const at of s.actorMove.values()) add(at, "hop");
  for (const at of s.actorAppear.values()) add(at, "hop");

  raw.sort((a, b) => a.at - b.at || PRIORITY.indexOf(a.effect) - PRIORITY.indexOf(b.effect));
  const out: Cue[] = [];
  for (const cue of raw) {
    const last = out[out.length - 1];
    if (last && cue.at - last.at < MERGE_MS) {
      if (PRIORITY.indexOf(cue.effect) < PRIORITY.indexOf(last.effect)) out[out.length - 1] = { at: last.at, effect: cue.effect };
      continue;
    }
    out.push(cue);
  }
  return out;
}

/** The single most important cue, for when the playback is collapsed (reduced motion). */
export function mostImportant(cues: readonly Cue[]): Cue[] {
  let best: Cue | null = null;
  for (const c of cues) if (!best || PRIORITY.indexOf(c.effect) < PRIORITY.indexOf(best.effect)) best = c;
  return best ? [{ at: 0, effect: best.effect }] : [];
}
