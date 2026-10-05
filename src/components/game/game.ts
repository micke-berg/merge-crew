// The game loop for one level, as plain functions with no React.
// brief -> intro (scripted scene) -> play (player turn) -> outro (scripted scene) -> won.
// The React hook (useLevel.ts) owns the timing; these functions only decide what happens next.

import { engine, queries } from "@/engine";
import type {
  ActorId,
  EngineEvent,
  Level,
  Mood,
  OutputLine,
  RepoState,
  RobotId,
  ScriptStep,
} from "@/engine/types";

export type Phase = "brief" | "intro" | "play" | "outro" | "won";

/** One line in the terminal. `actor` is who ran the command (robot lines are shown dimmed). */
export type TermLine =
  | { id: number; kind: "command"; actor: ActorId; path: string; text: string; scripted?: boolean }
  | { id: number; kind: OutputLine["kind"]; actor: ActorId; text: string; scripted?: boolean }
  | { id: number; kind: "note"; text: string };

/** A terminal line before it gets its id. */
type NewLine = TermLine extends infer T ? (T extends TermLine ? Omit<T, "id"> : never) : never;

export type Bubble = { actor: RobotId; text: string; mood: Mood };

export type GameState = {
  level: Level;
  phase: Phase;
  repo: RepoState;
  /** Events of the most recent change, for the map to play. A new array means "play these". */
  events: EngineEvent[];
  /** Position in the current script (intro or outro). */
  cursor: number;
  /** The line a robot is saying right now, if any. */
  bubble: Bubble | null;
  moods: Partial<Record<ActorId, Mood>>;
  log: TermLine[];
  nextLineId: number;
  /** One entry per level goal, in order. */
  goals: boolean[];
  /** Commands the player has run, including refused ones. */
  commands: number;
};

/** What the driver should do after a step: wait for the player, wait some time, or go on at once. */
export type Wait =
  | { kind: "click" }
  | { kind: "ms"; ms: number }
  /** A git step changed the map: wait until its animation has played. */
  | { kind: "animate"; events: EngineEvent[] }
  | { kind: "none" };

export class LevelSetupError extends Error {}

const NO_EVENTS: EngineEvent[] = [];

function applyStep(repo: RepoState, step: ScriptStep): { repo: RepoState; ok: boolean; output: OutputLine[]; events: EngineEvent[] } {
  if (step.kind === "git") {
    const r = engine.run(repo, { actor: step.actor, argv: step.argv });
    return { repo: r.state, ok: r.ok, output: r.output, events: r.events };
  }
  if (step.kind === "edit") {
    const r = engine.edit(repo, step.edit);
    return { repo: r.state, ok: r.ok, output: r.output, events: r.events };
  }
  return { repo, ok: true, output: [], events: [] };
}

export function checkGoals(level: Level, repo: RepoState): boolean[] {
  return level.goals.map((g) => {
    try {
      return g.check(repo, queries);
    } catch {
      return false;
    }
  });
}

/** Build the starting repository instantly and show the brief. Throws if the level's setup fails. */
export function startLevel(level: Level): GameState {
  let repo = engine.createRepo();
  for (const step of level.setup) {
    const r = applyStep(repo, step);
    if (!r.ok) {
      const what = step.kind === "git" ? `${step.actor}$ ${step.argv.join(" ")}` : step.kind;
      throw new LevelSetupError(`${level.id} setup failed at "${what}": ${r.output.map((l) => l.text).join(" ")}`);
    }
    repo = r.repo;
  }
  return {
    level,
    phase: "brief",
    repo,
    events: NO_EVENTS,
    cursor: 0,
    bubble: null,
    moods: {},
    log: [],
    nextLineId: 1,
    goals: level.goals.map(() => false),
    commands: 0,
  };
}

/** Leave the brief and start the opening scene (or the player turn if there is none). */
export function begin(s: GameState): GameState {
  if (s.phase !== "brief") return s;
  return enterScript({ ...s, phase: "intro", cursor: 0 });
}

function enterScript(s: GameState): GameState {
  const script = currentScript(s);
  if (s.cursor < script.length) return s;
  return endScript(s);
}

export function currentScript(s: GameState): ScriptStep[] {
  if (s.phase === "intro") return s.level.intro;
  if (s.phase === "outro") return s.level.outro;
  return [];
}

function endScript(s: GameState): GameState {
  if (s.phase === "intro") {
    return {
      ...s,
      phase: "play",
      cursor: 0,
      bubble: null,
      goals: checkGoals(s.level, s.repo),
      log: [...s.log, { id: s.nextLineId, kind: "note", text: "Your turn. Type a git command." }],
      nextLineId: s.nextLineId + 1,
    };
  }
  if (s.phase === "outro") return { ...s, phase: "won", cursor: 0, bubble: null };
  return s;
}

function addLines(s: GameState, lines: NewLine[]): Pick<GameState, "log" | "nextLineId"> {
  let id = s.nextLineId;
  const added = lines.map((l) => ({ ...l, id: id++ }) as TermLine);
  return { log: [...s.log, ...added], nextLineId: id };
}

/**
 * Play the next step of the current script. Returns the new state and what to wait for before
 * calling `advance` again. When the script runs out, the phase moves on (intro -> play, outro -> won).
 */
export function advance(s: GameState): { state: GameState; wait: Wait } {
  const script = currentScript(s);
  if (s.phase !== "intro" && s.phase !== "outro") return { state: s, wait: { kind: "none" } };
  if (s.cursor >= script.length) return { state: endScript(s), wait: { kind: "none" } };

  const step = script[s.cursor];
  const next = { ...s, cursor: s.cursor + 1 };
  switch (step.kind) {
    case "say": {
      const mood = step.mood ?? "talking";
      return {
        state: { ...next, bubble: { actor: step.actor, text: step.text, mood }, moods: { ...s.moods, [step.actor]: mood } },
        wait: { kind: "click" },
      };
    }
    case "mood":
      return { state: { ...next, moods: { ...s.moods, [step.actor]: step.mood } }, wait: { kind: "none" } };
    case "pause":
      return { state: { ...next, bubble: null }, wait: { kind: "ms", ms: step.ms } };
    case "git":
    case "edit": {
      const r = applyStep(s.repo, step);
      // A scripted step that fails is a level bug; show it rather than hide it.
      const lines: NewLine[] = [];
      if (step.kind === "git") {
        const path = s.repo.worktrees[step.actor]?.path ?? "/repo";
        lines.push({ kind: "command", actor: step.actor, path, text: step.argv.join(" "), scripted: true });
        for (const o of r.output) lines.push({ kind: o.kind, actor: step.actor, text: o.text, scripted: true });
      } else if (!r.ok) {
        for (const o of r.output) lines.push({ kind: "error", actor: step.edit.actor, text: o.text });
      }
      const changed = r.ok && r.events.length > 0;
      return {
        state: {
          ...next,
          bubble: null,
          repo: r.repo,
          events: changed ? r.events : s.events,
          // Goals tick only from the player turn on; mid-scene they would give away half-truths.
          goals: s.phase === "outro" ? checkGoals(s.level, r.repo) : s.goals,
          ...addLines(s, lines),
        },
        wait: changed ? { kind: "animate", events: r.events } : { kind: "none" },
      };
    }
  }
}

/**
 * Skip the rest of the current scene: every remaining git and edit step runs at once, and the map
 * gets all of their events together.
 */
export function skipScript(s: GameState): GameState {
  if (s.phase !== "intro" && s.phase !== "outro") return s;
  let state = s;
  const events: EngineEvent[] = [];
  let guard = 0;
  while ((state.phase === "intro" || state.phase === "outro") && state.phase === s.phase && guard++ < 1000) {
    const { state: after, wait } = advance(state);
    if (wait.kind === "animate") events.push(...wait.events);
    state = after;
  }
  return { ...state, events: events.length ? events : state.events, bubble: null };
}

/** Run everything up to the next moment the player is needed (a say step, or the player turn). */
export function advanceUntilClick(s: GameState): GameState {
  let state = s;
  let guard = 0;
  while ((state.phase === "intro" || state.phase === "outro") && guard++ < 1000) {
    const { state: after, wait } = advance(state);
    state = after;
    if (wait.kind === "click") break;
  }
  return state;
}

export type CommandOutcome = { state: GameState; ok: boolean; changed: boolean; won: boolean };

/** The player typed a line in the command box. Handles `clear` locally; everything else goes to the engine. */
export function runPlayerCommand(s: GameState, line: string): CommandOutcome {
  const text = line.trim();
  if (s.phase !== "play" || text === "") return { state: s, ok: true, changed: false, won: false };
  if (text === "clear") return { state: { ...s, log: [] }, ok: true, changed: false, won: false };

  const path = s.repo.worktrees.player?.path ?? "/repo";
  const argv = engine.parseCommandLine(text);
  const r = engine.run(s.repo, { actor: "player", argv });
  const lines: NewLine[] = [{ kind: "command", actor: "player", path, text }];
  for (const o of r.output) lines.push({ kind: o.kind, actor: "player", text: o.text });
  const changed = r.ok && r.state !== s.repo;
  const goals = changed ? checkGoals(s.level, r.state) : s.goals;
  const won = goals.length > 0 && goals.every(Boolean);
  let state: GameState = {
    ...s,
    repo: r.state,
    events: changed ? r.events : s.events,
    goals,
    commands: s.commands + 1,
    ...addLines(s, lines),
  };
  if (won) state = enterScript({ ...state, phase: "outro", cursor: 0 });
  return { state, ok: r.ok, changed, won };
}
