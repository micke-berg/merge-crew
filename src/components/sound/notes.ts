// A note is one tiny synthesized sound: an oscillator (or noise) with a filter and a soft envelope.
// Voices and effects are both described as lists of notes, so the planning stays pure and testable
// and only `renderNote` touches the Web Audio API.

export type Wave = "sine" | "triangle" | "square" | "sawtooth" | "noise";

export type Note = {
  /** Seconds from the start of the sound. */
  at: number;
  /** Seconds the note lasts, including its release. */
  dur: number;
  wave: Wave;
  /** Start pitch in Hz. For noise it is ignored (the filter shapes noise). */
  freq: number;
  /** Pitch at the end of the note, reached with an exponential glide. */
  freqEnd?: number;
  /** Peak level, 0..1, before the master volume. */
  gain: number;
  /** Seconds to reach the peak. Never below 4 ms, so notes never click. */
  attack?: number;
  filter?: { type: BiquadFilterType; freq: number; freqEnd?: number; q?: number };
  /** Pitch wobble: rate in Hz, depth in cents. */
  vibrato?: { rate: number; depth: number };
};

export const MIN_ATTACK = 0.004;
/** The envelope floor. Exponential ramps cannot reach zero. */
const FLOOR = 0.0001;

let noiseBuffer: { ctx: BaseAudioContext; buffer: AudioBuffer } | null = null;

function noise(ctx: BaseAudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.ctx === ctx) return noiseBuffer.buffer;
  const length = Math.floor(ctx.sampleRate * 1);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // A fixed pseudo-random sequence: the same noise every session.
  let seed = 0x2f6b9a1d;
  for (let i = 0; i < length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    data[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
  }
  noiseBuffer = { ctx, buffer };
  return buffer;
}

/** Schedules one note at `t0` (AudioContext time) into `out`. Returns the sources, so a caller can stop them. */
export function renderNote(ctx: BaseAudioContext, out: AudioNode, note: Note, t0: number): AudioScheduledSourceNode[] {
  const start = t0 + Math.max(0, note.at);
  const dur = Math.max(0.02, note.dur);
  const end = start + dur;
  const attack = Math.min(Math.max(MIN_ATTACK, note.attack ?? 0.008), dur * 0.6);
  const sources: AudioScheduledSourceNode[] = [];

  const env = ctx.createGain();
  env.gain.setValueAtTime(FLOOR, start);
  env.gain.linearRampToValueAtTime(Math.max(FLOOR, note.gain), start + attack);
  env.gain.exponentialRampToValueAtTime(FLOOR, end);

  let head: AudioNode = env;
  if (note.filter) {
    const f = ctx.createBiquadFilter();
    f.type = note.filter.type;
    f.Q.value = note.filter.q ?? 0.7;
    f.frequency.setValueAtTime(note.filter.freq, start);
    if (note.filter.freqEnd) f.frequency.exponentialRampToValueAtTime(note.filter.freqEnd, end);
    f.connect(env);
    head = f;
  }
  env.connect(out);

  let src: AudioScheduledSourceNode;
  if (note.wave === "noise") {
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx);
    n.loop = true;
    src = n;
  } else {
    const osc = ctx.createOscillator();
    osc.type = note.wave;
    osc.frequency.setValueAtTime(note.freq, start);
    if (note.freqEnd) osc.frequency.exponentialRampToValueAtTime(note.freqEnd, end);
    if (note.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = note.vibrato.rate;
      depth.gain.value = note.vibrato.depth;
      lfo.connect(depth);
      depth.connect(osc.detune);
      lfo.start(start);
      lfo.stop(end + 0.02);
      sources.push(lfo);
    }
    src = osc;
  }
  src.connect(head);
  src.start(start);
  src.stop(end + 0.02);
  sources.push(src);
  // Free the graph once the note has finished.
  src.onended = () => {
    try {
      env.disconnect();
    } catch {
      // Already disconnected.
    }
  };
  return sources;
}

/** When the last note of a list ends, in seconds. */
export function notesLength(notes: readonly Note[]): number {
  return notes.reduce((m, n) => Math.max(m, n.at + n.dur), 0);
}

/** Semitones to a frequency ratio. */
export const semis = (n: number) => Math.pow(2, n / 12);
