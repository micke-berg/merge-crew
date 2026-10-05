// Robot gibberish: turns a line of text into a list of blips, one per syllable-ish chunk.
// Pure and deterministic: the same robot, mood and text always give the same notes.

import type { Mood, RobotId } from "@/engine/types";
import { semis, type Note, type Wave } from "./notes";

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

export type Pause = "none" | "comma" | "stop";

export type Chunk = {
  text: string;
  /** Index of the chunk's first character in the line, which is when the typewriter reaches it. */
  index: number;
  /** The punctuation right after this chunk's word, if this chunk ends the word. */
  pause: Pause;
  /** The sentence this chunk ends is a question or an exclamation. */
  ending: "question" | "exclaim" | null;
  /** First chunk of a word. Slightly stressed. */
  wordStart: boolean;
};

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** Splits a word into pieces of 2 or 3 characters. Words of 1 to 3 characters stay whole. */
export function splitWord(word: string): string[] {
  const chars = Array.from(word);
  const out: string[] = [];
  let i = 0;
  while (i < chars.length) {
    const left = chars.length - i;
    const size = left <= 3 ? left : left === 4 ? 2 : 3;
    out.push(chars.slice(i, i + size).join(""));
    i += size;
  }
  return out;
}

function pauseAfter(text: string, from: number): { pause: Pause; ending: Chunk["ending"] } {
  // Look at the punctuation between this word and the next one.
  let pause: Pause = "none";
  let ending: Chunk["ending"] = null;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (/[\p{L}\p{N}]/u.test(c)) break;
    if (c === "?") {
      pause = "stop";
      ending = "question";
    } else if (c === "!") {
      pause = "stop";
      ending ??= "exclaim";
    } else if (c === "." || c === "…") {
      pause = "stop";
    } else if ((c === "," || c === ";" || c === ":" || c === "—" || c === "–") && pause === "none") {
      pause = "comma";
    }
  }
  return { pause, ending };
}

/** The syllable-ish chunks of a line, skipping spaces and punctuation. */
export function chunkText(text: string): Chunk[] {
  const out: Chunk[] = [];
  for (const m of text.matchAll(WORD)) {
    const word = m[0];
    const start = m.index ?? 0;
    const parts = splitWord(word);
    const after = pauseAfter(text, start + word.length);
    let offset = start;
    parts.forEach((p, i) => {
      const last = i === parts.length - 1;
      out.push({
        text: p,
        index: offset,
        pause: last ? after.pause : "none",
        ending: last ? after.ending : null,
        wordStart: i === 0,
      });
      offset += p.length;
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

/** FNV-1a, 32 bit. Stable across runs and platforms. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A number in [0, 1) from a string. */
export const unit = (s: string) => hash(s) / 0x100000000;

// ---------------------------------------------------------------------------
// Voices
// ---------------------------------------------------------------------------

export type Voice = {
  /** Root pitch in Hz. */
  base: number;
  wave: Wave;
  /** Semitone steps a blip can land on, relative to the root. Pentatonic-ish, so lines sound musical. */
  scale: number[];
  /** Seconds one blip lasts. */
  blip: number;
  /** Shortest time between two blips. Faster typewriter chunks are skipped, so the voice stays in sync. */
  gap: number;
  /** Peak level of a blip. Brighter waves get less. */
  gain: number;
  attack: number;
  /** Low-pass cutoff in Hz and its resonance. */
  cutoff: number;
  q: number;
  /** Semitones each blip glides by (positive slides up). */
  slide: number;
  vibrato?: { rate: number; depth: number };
  /** Chance (0..1) a blip becomes a quick double blip. */
  double: number;
  /** Timing wobble in seconds, so it does not sound like a metronome. */
  jitter: number;
  /** Airy noise layered under each blip, 0..1 of the blip level. */
  breath: number;
  /** Extra pause after a comma and a full stop, in seconds. */
  comma: number;
  stop: number;
};

export const VOICES: Record<RobotId, Voice> = {
  // Calm, mid pitch, soft and round, even rhythm.
  tidy: {
    base: 330, wave: "triangle", scale: [0, 2, 4, 7, 9], blip: 0.075, gap: 0.09, gain: 0.55, attack: 0.012,
    cutoff: 1900, q: 0.7, slide: -0.6, double: 0, jitter: 0, breath: 0, comma: 0.14, stop: 0.26,
  },
  // Fast, high, a little buzzy, excited upward slides.
  blaze: {
    base: 560, wave: "square", scale: [0, 2, 4, 7, 9, 12], blip: 0.05, gap: 0.058, gain: 0.2, attack: 0.005,
    cutoff: 2700, q: 2.2, slide: 3, double: 0, jitter: 0.006, breath: 0, comma: 0.09, stop: 0.18,
  },
  // Slow, dreamy, wobbly and airy.
  drift: {
    base: 392, wave: "sine", scale: [0, 3, 5, 7, 10, 12], blip: 0.14, gap: 0.15, gain: 0.5, attack: 0.03,
    cutoff: 1500, q: 0.6, slide: -1, vibrato: { rate: 5.5, depth: 45 }, double: 0, jitter: 0.012, breath: 0.22,
    comma: 0.2, stop: 0.36,
  },
  // Low, nervous, stuttery, quick double blips.
  hoarder: {
    base: 190, wave: "sawtooth", scale: [0, 1, 3, 5, 6, 8], blip: 0.045, gap: 0.068, gain: 0.3, attack: 0.005,
    cutoff: 950, q: 3, slide: 0.5, double: 0.4, jitter: 0.018, breath: 0, comma: 0.12, stop: 0.22,
  },
};

export type MoodShift = {
  /** Semitones added to every blip. */
  pitch: number;
  /** Multiplies the gap between blips: below 1 is faster. */
  tempo: number;
  /** Multiplies the filter cutoff: above 1 is brighter. */
  bright: number;
  /** Multiplies blip length. */
  length: number;
  /** Multiplies the level. */
  level: number;
  /** Semitones added to each blip's glide. */
  slide: number;
  /** Extra tremble, if any. */
  tremble?: { rate: number; depth: number };
};

const NEUTRAL: MoodShift = { pitch: 0, tempo: 1, bright: 1, length: 1, level: 1, slide: 0 };

export const MOODS: Record<Mood, MoodShift> = {
  idle: NEUTRAL,
  talking: NEUTRAL,
  thinking: { pitch: -1, tempo: 1.2, bright: 0.85, length: 1.1, level: 0.9, slide: -0.5 },
  happy: { pitch: 2, tempo: 0.95, bright: 1.35, length: 1, level: 1, slide: 1 },
  celebrate: { pitch: 4, tempo: 0.9, bright: 1.5, length: 1, level: 1.05, slide: 2 },
  scared: { pitch: 5, tempo: 0.75, bright: 1.1, length: 0.8, level: 0.95, slide: 0.5, tremble: { rate: 12, depth: 35 } },
  surprised: { pitch: 3, tempo: 0.9, bright: 1.2, length: 1, level: 1, slide: 4 },
  guilty: { pitch: -4, tempo: 1.35, bright: 0.7, length: 1.2, level: 0.85, slide: -1.5 },
};

export function moodShift(mood: Mood | undefined): MoodShift {
  return (mood && MOODS[mood]) || NEUTRAL;
}

// ---------------------------------------------------------------------------
// Planning a line
// ---------------------------------------------------------------------------

/** The game's typewriter shows 2 characters every 22 ms (DialogueBox). */
export const TYPEWRITER_CPS = 2 / 0.022;

/** The typing speed the punctuation pauses are written for. */
const PAUSE_REFERENCE_CPS = 25;

export type SpeakOptions = {
  /** How fast the text types out. Defaults to the game's typewriter. */
  charsPerSecond?: number;
  /** Cut the line short, for text that appears at once (reduced motion). */
  maxSeconds?: number;
};

/** Semitone offset of one chunk: a scale step picked from the chunk text and its position. */
export function chunkStep(voice: Voice, chunk: Chunk, n: number): number {
  const u = unit(`${chunk.text.toLowerCase()}#${n % 7}`);
  return voice.scale[Math.floor(u * voice.scale.length)];
}

/** The blips for a line, timed against the typewriter. Times are seconds from the start of the line. */
export function planSpeech(robot: RobotId, mood: Mood | undefined, text: string, options: SpeakOptions = {}): Note[] {
  const v = VOICES[robot];
  const m = moodShift(mood);
  const cps = options.charsPerSecond && options.charsPerSecond > 0 ? options.charsPerSecond : TYPEWRITER_CPS;
  const limit = options.maxSeconds ?? Infinity;
  const gap = v.gap * m.tempo;
  const blip = v.blip * m.length;
  const cutoff = v.cutoff * m.bright;
  const vibrato = m.tremble ?? v.vibrato;
  // Punctuation pauses are tuned for a relaxed reading speed. A fast typewriter shrinks them, so
  // short lines still get enough blips.
  const pauseScale = Math.min(1, PAUSE_REFERENCE_CPS / cps);
  const chunks = chunkText(text);
  const notes: Note[] = [];

  let ready = 0;
  let sentence = 0;
  chunks.forEach((c, i) => {
    const natural = c.index / cps;
    const jitter = v.jitter ? (unit(`j${i}${c.text}`) - 0.5) * 2 * v.jitter : 0;
    const at = Math.max(0, natural + jitter);
    const blipping = at >= ready && at < limit;

    // A gentle downward drift across a sentence, like speech.
    const fall = -Math.min(2, sentence * 0.18);
    let step = chunkStep(v, c, i) + m.pitch + fall + (c.wordStart ? 0.5 : 0);
    let slide = v.slide + m.slide;
    let gain = v.gain * m.level;
    if (c.ending === "question") {
      step += 2;
      slide += 5;
    } else if (c.ending === "exclaim") {
      step += 1;
      gain *= 1.12;
    }

    if (blipping) {
      const freq = v.base * semis(step);
      const note: Note = {
        at, dur: blip, wave: v.wave, freq, freqEnd: freq * semis(slide), gain, attack: v.attack,
        filter: { type: "lowpass", freq: cutoff, q: v.q },
        ...(vibrato ? { vibrato } : {}),
      };
      notes.push(note);
      if (v.breath > 0) {
        notes.push({
          at, dur: blip * 1.1, wave: "noise", freq: 0, gain: gain * v.breath, attack: v.attack * 1.5,
          filter: { type: "bandpass", freq: freq * 3, q: 1.2 },
        });
      }
      if (v.double > 0 && unit(`d${i}${c.text}`) < v.double) {
        const second = blip * 0.75;
        notes.push({ ...note, at: at + blip * 0.85, dur: second, freq: freq * semis(1), freqEnd: freq * semis(1 + slide), gain: gain * 0.85 });
        ready = at + blip * 0.85 + second + gap * 0.4;
      } else {
        ready = at + gap;
      }
    }

    sentence++;
    if (c.pause === "comma") ready = Math.max(ready, at + v.comma * pauseScale);
    if (c.pause === "stop") {
      ready = Math.max(ready, at + v.stop * pauseScale);
      sentence = 0;
    }
  });
  return notes;
}
