import { describe, expect, it } from "vitest";
import { buildSchedule, type Schedule } from "@/components/map/timeline";
import { effectNotes, EFFECTS, mostImportant, scheduleCues } from "./effects";
import { diffSounds, snapshot } from "./useGameSounds";
import { SoundEngine } from "./engine";
import { notesLength } from "./notes";
import { MUTE_KEY, readMuted, writeMuted, type KeyValueStore } from "./prefs";
import { chunkText, moodShift, planSpeech, splitWord, TYPEWRITER_CPS, VOICES } from "./voices";

describe("chunking", () => {
  it("splits words into 2 or 3 character pieces", () => {
    expect(splitWord("I")).toEqual(["I"]);
    expect(splitWord("git")).toEqual(["git"]);
    expect(splitWord("push")).toEqual(["pu", "sh"]);
    expect(splitWord("merge")).toEqual(["mer", "ge"]);
    expect(splitWord("rebase")).toEqual(["reb", "ase"]);
    expect(splitWord("history")).toEqual(["his", "to", "ry"]);
    for (const w of ["a", "ab", "abcd", "abcdefgh", "abcdefghijk"]) {
      const parts = splitWord(w);
      expect(parts.join("")).toBe(w);
      if (w.length > 1) for (const p of parts) expect(p.length).toBeGreaterThanOrEqual(2);
      for (const p of parts) expect(p.length).toBeLessThanOrEqual(3);
    }
  });

  it("skips spaces and punctuation and keeps the typewriter position", () => {
    const text = "Oops, I did it.";
    const chunks = chunkText(text);
    expect(chunks.map((c) => c.text)).toEqual(["Oo", "ps", "I", "did", "it"]);
    for (const c of chunks) expect(text.slice(c.index, c.index + c.text.length)).toBe(c.text);
  });

  it("marks pauses at commas and full stops, and the sentence ending", () => {
    const chunks = chunkText("Wait, what? Yes! Fine.");
    const byText = Object.fromEntries(chunks.map((c) => [c.text, c]));
    expect(byText.it.pause).toBe("comma");
    expect(byText.at.pause).toBe("stop");
    expect(byText.at.ending).toBe("question");
    expect(byText.Yes.ending).toBe("exclaim");
    expect(byText.ne.pause).toBe("stop");
    expect(byText.Fi.pause).toBe("none");
  });

  it("keeps contractions as one word and gives nothing for punctuation-only text", () => {
    expect(chunkText("don't").map((c) => c.text)).toEqual(["don", "'t"]);
    expect(chunkText("... !?")).toEqual([]);
  });
});

describe("speech plan", () => {
  const line = "Okay, so I pushed to main. Is that bad?";

  it("is deterministic: the same line sounds the same every time", () => {
    expect(planSpeech("blaze", "talking", line)).toEqual(planSpeech("blaze", "talking", line));
  });

  it("varies pitch with the text", () => {
    const a = planSpeech("tidy", "talking", "branches and merges everywhere").map((n) => n.freq);
    const b = planSpeech("tidy", "talking", "stash it all away for later").map((n) => n.freq);
    expect(new Set(a).size).toBeGreaterThan(2);
    expect(a).not.toEqual(b);
  });

  it("gives each robot its own range", () => {
    const avg = (r: "tidy" | "blaze" | "drift" | "hoarder") => {
      const f = planSpeech(r, "talking", line).filter((n) => n.wave !== "noise").map((n) => n.freq);
      return f.reduce((s, x) => s + x, 0) / f.length;
    };
    expect(avg("blaze")).toBeGreaterThan(avg("tidy"));
    expect(avg("tidy")).toBeGreaterThan(avg("hoarder"));
  });

  it("stays in sync with the typewriter", () => {
    const long = "Okay, so I pushed straight to main again. Is that bad? It felt really fast, honestly!";
    for (const robot of ["tidy", "blaze", "drift", "hoarder"] as const) {
      const notes = planSpeech(robot, "talking", long).filter((n) => n.wave !== "noise");
      expect(notes.length).toBeGreaterThan(3);
      const lastChar = long.length / TYPEWRITER_CPS;
      expect(notes[notes.length - 1].at).toBeLessThanOrEqual(lastChar + VOICES[robot].jitter);
      for (const n of notes) expect(n.gain).toBeLessThanOrEqual(0.7);
    }
  });

  it("follows a slower typewriter", () => {
    const fast = planSpeech("tidy", "talking", line);
    const slow = planSpeech("tidy", "talking", line, { charsPerSecond: 20 });
    expect(notesLength(slow)).toBeGreaterThan(notesLength(fast) * 2);
  });

  it("cuts the line short with maxSeconds", () => {
    const notes = planSpeech("drift", "talking", line, { maxSeconds: 0.2 });
    for (const n of notes) expect(n.at).toBeLessThan(0.2);
  });

  it("gives Hoarder double blips and Drift a wobble", () => {
    const hoarder = planSpeech("hoarder", "talking", "I kept every single file, just in case, you know.");
    const close = hoarder.some((n, i) => i > 0 && n.at - hoarder[i - 1].at < VOICES.hoarder.gap);
    expect(close).toBe(true);
    expect(planSpeech("drift", "talking", line)[0].vibrato).toBeDefined();
  });
});

describe("moods", () => {
  const line = "I am not sure what happened to the branch.";
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const pitch = (mood: Parameters<typeof planSpeech>[1]) =>
    mean(planSpeech("tidy", mood, line, { charsPerSecond: 15 }).map((n) => n.freq));
  const count = (mood: Parameters<typeof planSpeech>[1]) => planSpeech("tidy", mood, line).length;

  it("scared is higher and faster, guilty lower and slower, happy brighter", () => {
    expect(pitch("scared")).toBeGreaterThan(pitch("talking"));
    expect(pitch("guilty")).toBeLessThan(pitch("talking"));
    expect(count("scared")).toBeGreaterThanOrEqual(count("talking"));
    expect(count("guilty")).toBeLessThanOrEqual(count("talking"));
    expect(moodShift("scared").tempo).toBeLessThan(1);
    expect(moodShift("guilty").tempo).toBeGreaterThan(1);
    const happy = planSpeech("tidy", "happy", line)[0].filter!.freq;
    const plain = planSpeech("tidy", "talking", line)[0].filter!.freq;
    expect(happy).toBeGreaterThan(plain);
  });

  it("treats a missing mood as neutral", () => {
    expect(planSpeech("blaze", undefined, line)).toEqual(planSpeech("blaze", "talking", line));
  });
});

describe("effects", () => {
  it("every effect has short, soft notes", () => {
    for (const e of EFFECTS) {
      const notes = effectNotes(e);
      expect(notes.length).toBeGreaterThan(0);
      expect(notesLength(notes)).toBeLessThanOrEqual(e === "win" ? 2 : 1);
      for (const n of notes) expect(n.gain).toBeLessThanOrEqual(0.7);
    }
  });

  it("plays one sound for things that happen together", () => {
    const empty = (): Schedule => ({
      duration: 0, appear: new Map(), lose: new Map(), recover: new Map(), actorMove: new Map(), conflict: new Map(),
      branch: new Map(), remote: new Map(), shakes: [], actorAppear: new Map(),
    });
    const s = empty();
    s.appear.set("a", 0);
    s.actorMove.set("tidy", 0);
    s.branch.set("main", { at: 0, motion: "extend" });
    s.lose.set("b", 650);
    s.lose.set("c", 650);
    s.shakes.push(1800);
    s.remote.set("origin/main", { at: 1800, forced: true });
    expect(scheduleCues(s)).toEqual([
      { at: 0, effect: "commit" },
      { at: 650, effect: "lost" },
      { at: 1800, effect: "forcePush" },
    ]);
  });

  it("reads a real schedule", () => {
    const s = buildSchedule([], {
      commits: {}, branches: {}, branchReflogs: {}, upstreams: {}, remoteTracking: {}, remotes: {}, worktrees: {}, stash: [], clock: 0,
    });
    expect(scheduleCues(s)).toEqual([]);
  });
});

describe("mute setting", () => {
  const memory = (): KeyValueStore & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };
  const broken: KeyValueStore = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };

  it("is remembered", () => {
    const store = memory();
    expect(readMuted(store)).toBe(false);
    expect(writeMuted(true, store)).toBe(true);
    expect(store.data.get(MUTE_KEY)).toBe("1");
    expect(readMuted(store)).toBe(true);
  });

  it("falls back to sound on when storage is missing or throws", () => {
    expect(readMuted(null)).toBe(false);
    expect(readMuted(broken)).toBe(false);
    expect(writeMuted(true, broken)).toBe(false);
    expect(readMuted()).toBe(false); // no window in node
  });

  it("keeps the setting in memory when storage refuses it", () => {
    const engine = new SoundEngine({ storage: broken });
    engine.setMuted(true);
    expect(engine.isMuted()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// A small fake of the Web Audio API: enough to count what gets scheduled.
// ---------------------------------------------------------------------------

function fakeContext() {
  const started: { kind: string; at: number }[] = [];
  const param = (value = 0) => ({
    value,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
  });
  const node = () => ({ connect() {}, disconnect() {} });
  const source = (kind: string) => ({
    ...node(),
    onended: null as null | (() => void),
    start(at: number) {
      started.push({ kind, at });
    },
    stop() {},
  });
  let state: AudioContextState = "suspended";
  let resumed = 0;
  const ctx = {
    currentTime: 10,
    sampleRate: 8000,
    get state() {
      return state;
    },
    destination: node(),
    resume: async () => {
      resumed++;
      state = "running";
    },
    createGain: () => ({ ...node(), gain: param(1) }),
    createBiquadFilter: () => ({ ...node(), type: "lowpass", frequency: param(), Q: param() }),
    createDynamicsCompressor: () => ({ ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createOscillator: () => ({ ...source("osc"), type: "sine", frequency: param(), detune: param() }),
    createBufferSource: () => ({ ...source("noise"), buffer: null, loop: false }),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  };
  return { ctx: ctx as unknown as AudioContext, started, resumes: () => resumed };
}

describe("engine", () => {
  const store = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };

  it("plays nothing before unlock", () => {
    const fake = fakeContext();
    const engine = new SoundEngine({ createContext: () => fake.ctx, storage: store() });
    engine.play("commit");
    expect(engine.speak("tidy", "talking", "Hello there").stop).toBeTypeOf("function");
    expect(fake.started).toHaveLength(0);
  });

  it("plays after unlock and resumes a suspended context", () => {
    const fake = fakeContext();
    const engine = new SoundEngine({ createContext: () => fake.ctx, storage: store() });
    engine.unlock();
    expect(fake.resumes()).toBe(1);
    engine.play("commit");
    expect(fake.started.length).toBeGreaterThan(0);
    expect(fake.started.every((s) => s.at >= 10)).toBe(true);
  });

  it("plays nothing while muted, and the line can be stopped", () => {
    const fake = fakeContext();
    const engine = new SoundEngine({ createContext: () => fake.ctx, storage: store() });
    engine.unlock();
    engine.setMuted(true);
    engine.play("win");
    engine.speak("blaze", "happy", "Shipping it now!");
    expect(fake.started).toHaveLength(0);
    engine.setMuted(false);
    const line = engine.speak("blaze", "happy", "Shipping it now!");
    expect(fake.started.length).toBeGreaterThan(0);
    line.stop();
    line.stop();
  });

  it("is safe without any audio support", () => {
    const engine = new SoundEngine({ storage: null });
    engine.unlock();
    expect(engine.unlocked).toBe(false);
    engine.play("goal");
    engine.stopSpeaking();
  });

  it("clamps volume", () => {
    const engine = new SoundEngine({ storage: null });
    expect(engine.getVolume()).toBe(0.35);
    engine.setVolume(4);
    expect(engine.getVolume()).toBe(1);
    engine.setVolume(-1);
    expect(engine.getVolume()).toBe(0);
  });
});

describe("game sounds", () => {
  const base = { events: [], repo: {} as never, goals: [false, false], phase: "play", log: [{ id: 1, kind: "command", actor: "player" }] };

  it("dings for a new goal, plays the jingle on a win, buzzes on the player's errors", () => {
    const before = snapshot(base);
    expect(diffSounds(before, base)).toEqual([]);
    expect(diffSounds(before, { ...base, goals: [true, false] })).toEqual(["goal"]);
    expect(diffSounds(before, { ...base, goals: [true, true], phase: "won" })).toEqual(["win"]);
    const err = { ...base, log: [...base.log, { id: 2, kind: "error", actor: "player" }] };
    expect(diffSounds(before, err)).toEqual(["error"]);
    const robotErr = { ...base, log: [...base.log, { id: 2, kind: "error", actor: "blaze", scripted: true }] };
    expect(diffSounds(before, robotErr)).toEqual([]);
    expect(diffSounds(snapshot(err), err)).toEqual([]);
  });

  it("keeps only the most important cue when motion is reduced", () => {
    expect(mostImportant([{ at: 0, effect: "commit" }, { at: 900, effect: "lost" }])).toEqual([{ at: 0, effect: "lost" }]);
    expect(mostImportant([])).toEqual([]);
  });
});
