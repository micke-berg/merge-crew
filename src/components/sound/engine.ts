// The sound engine: one AudioContext, created on the first user gesture, with a soft master chain.
// Safe to import on the server: nothing touches `window` until a method runs in the browser.

import type { Mood, RobotId } from "@/engine/types";
import type { Schedule } from "@/components/map/timeline";
import { effectNotes, mostImportant, scheduleCues, type Effect } from "./effects";
import { notesLength, renderNote, type Note } from "./notes";
import { readMuted, writeMuted, type KeyValueStore } from "./prefs";
import { planSpeech, type SpeakOptions } from "./voices";

export const DEFAULT_VOLUME = 0.35;
/** Voices sit a little under the effects, so lines never feel shouty. */
const VOICE_LEVEL = 0.8;
const EFFECT_LEVEL = 1;

export type StopHandle = { stop: () => void };

const NOOP: StopHandle = { stop: () => {} };

type AudioContextCtor = new () => AudioContext;

type Chain = {
  ctx: AudioContext;
  master: GainNode;
  voices: GainNode;
  effects: GainNode;
};

export type SoundEngineOptions = {
  /** Injected in tests. Defaults to the browser's AudioContext. */
  createContext?: () => AudioContext;
  storage?: KeyValueStore | null;
};

type Listener = () => void;

export class SoundEngine {
  private chain: Chain | null = null;
  private muted: boolean | null = null;
  private volume = DEFAULT_VOLUME;
  private speaking: { gain: GainNode; sources: AudioScheduledSourceNode[] } | null = null;
  private listeners = new Set<Listener>();
  private readonly options: SoundEngineOptions;

  constructor(options: SoundEngineOptions = {}) {
    this.options = options;
  }

  // --- state -----------------------------------------------------------------

  /** True once unlock() has created the audio context. */
  get unlocked(): boolean {
    return this.chain !== null;
  }

  isMuted(): boolean {
    if (this.muted === null) this.muted = readMuted(this.storage());
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    writeMuted(muted, this.storage());
    if (muted) this.stopSpeaking();
    this.applyLevel();
    this.emit();
  }

  toggleMuted(): boolean {
    this.setMuted(!this.isMuted());
    return this.muted as boolean;
  }

  getVolume(): number {
    return this.volume;
  }

  /** Master volume, 0..1. Default 0.35. */
  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : DEFAULT_VOLUME));
    this.applyLevel();
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- lifecycle -------------------------------------------------------------

  /**
   * Call from a user gesture (click, key press). Creates the audio context on the first call and
   * resumes it if the browser suspended it. Safe to call many times.
   */
  unlock(): void {
    if (!this.chain) {
      const ctx = this.createContext();
      if (!ctx) return;
      this.chain = this.buildChain(ctx);
      this.emit();
    }
    const { ctx } = this.chain;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  }

  // --- playing ---------------------------------------------------------------

  /** Plays an event sound now, or `delayMs` from now. Silent before unlock() or while muted. */
  play(effect: Effect, delayMs = 0): void {
    const chain = this.ready();
    if (!chain) return;
    this.renderAll(effectNotes(effect), chain.effects, chain.ctx.currentTime + Math.max(0, delayMs) / 1000);
  }

  /** Plays the sounds for one map playback (from buildSchedule), timed with its animations. */
  playSchedule(schedule: Schedule, { reduce = false }: { reduce?: boolean } = {}): void {
    const chain = this.ready();
    if (!chain) return;
    const t0 = chain.ctx.currentTime;
    const cues = scheduleCues(schedule);
    // With reduced motion the map jumps straight to the end, so play only the most important sound.
    const play = reduce ? mostImportant(cues) : cues;
    for (const cue of play) this.renderAll(effectNotes(cue.effect), chain.effects, t0 + (reduce ? 0 : cue.at / 1000));
  }

  /**
   * Speaks a line in the robot's gibberish voice, timed to the typewriter. A new line stops the one
   * before. Returns a handle that stops this line (for example when the player skips the typing).
   */
  speak(robot: RobotId, mood: Mood | undefined, text: string, options: SpeakOptions = {}): StopHandle {
    this.stopSpeaking();
    const chain = this.ready();
    if (!chain) return NOOP;
    const notes = planSpeech(robot, mood, text, options);
    if (notes.length === 0) return NOOP;
    const { ctx } = chain;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(chain.voices);
    const sources = this.renderAll(notes, gain, ctx.currentTime + 0.01);
    const line = { gain, sources };
    this.speaking = line;
    const end = (notesLength(notes) + 0.2) * 1000;
    const timer = setTimeout(() => {
      if (this.speaking === line) this.speaking = null;
      this.release(line, 0);
    }, end);
    return {
      stop: () => {
        clearTimeout(timer);
        if (this.speaking === line) this.speaking = null;
        this.release(line, 0.03);
      },
    };
  }

  /** Fades out whatever a robot is saying. */
  stopSpeaking(): void {
    const line = this.speaking;
    this.speaking = null;
    if (line) this.release(line, 0.03);
  }

  // --- internals -------------------------------------------------------------

  private storage(): KeyValueStore | null | undefined {
    return this.options.storage;
  }

  private createContext(): AudioContext | null {
    try {
      if (this.options.createContext) return this.options.createContext();
      if (typeof window === "undefined") return null;
      const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      return Ctor ? new Ctor() : null;
    } catch {
      return null;
    }
  }

  private buildChain(ctx: AudioContext): Chain {
    const voices = ctx.createGain();
    voices.gain.value = VOICE_LEVEL;
    const effects = ctx.createGain();
    effects.gain.value = EFFECT_LEVEL;
    const master = ctx.createGain();
    master.gain.value = this.level();

    // Take the edge off anything sharp, then squash peaks so nothing gets loud.
    const tame = ctx.createBiquadFilter();
    tame.type = "lowpass";
    tame.frequency.value = 7000;
    tame.Q.value = 0.5;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -20;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.2;
    const trim = ctx.createGain();
    trim.gain.value = 0.9;

    voices.connect(master);
    effects.connect(master);
    master.connect(tame);
    tame.connect(limiter);
    limiter.connect(trim);
    trim.connect(ctx.destination);
    return { ctx, master, voices, effects };
  }

  private level(): number {
    return this.isMuted() ? 0 : this.volume;
  }

  private applyLevel(): void {
    if (!this.chain) return;
    const { ctx, master } = this.chain;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(this.level(), now + 0.05);
  }

  private ready(): Chain | null {
    if (!this.chain || this.isMuted()) return null;
    return this.chain;
  }

  private renderAll(notes: readonly Note[], out: AudioNode, t0: number): AudioScheduledSourceNode[] {
    const { ctx } = this.chain as Chain;
    const sources: AudioScheduledSourceNode[] = [];
    for (const n of notes) {
      try {
        sources.push(...renderNote(ctx, out, n, t0));
      } catch {
        // A browser that rejects one node should not break the game.
      }
    }
    return sources;
  }

  private release(line: { gain: GainNode; sources: AudioScheduledSourceNode[] }, fade: number): void {
    const ctx = this.chain?.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      line.gain.gain.cancelScheduledValues(now);
      line.gain.gain.setValueAtTime(line.gain.gain.value, now);
      line.gain.gain.linearRampToValueAtTime(0, now + fade);
      for (const s of line.sources) {
        try {
          s.stop(now + fade + 0.01);
        } catch {
          // Already stopped.
        }
      }
      setTimeout(() => {
        try {
          line.gain.disconnect();
        } catch {
          // Already disconnected.
        }
      }, (fade + 0.05) * 1000);
    } catch {
      // The context may be closed.
    }
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

/** The game's one sound engine. */
export const sound = new SoundEngine();
