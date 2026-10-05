// The game loop for one level, as plain functions with no React.
// brief -> intro (scripted scene) -> play (player turn) -> outro (scripted scene) -> won.
// The React hook (useLevel.ts) owns the timing; these functions only decide what happens next.

import { engine, queries, validateCommandLine } from "@/engine";
import { MAX_HINTS_PER_RUN } from "@/hints/types";
import type {
  ActorId,
  EngineEvent,
  Level,
  Mood,
  OutputLine,
  Path,
  RepoState,
  RobotId,
  ScreenTarget,
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

/** A guided-tour step: the screen region a robot is pointing at, and what to single out on the map. */
export type PointStep = Extract<ScriptStep, { kind: "point" }>;
export type Pointer = { target: ScreenTarget; focus: NonNullable<PointStep["focus"]> | null };

/**
 * A robot line on screen. `files` are working files the line mentions, highlighted in the files panel.
 * `point` is set for a guided-tour line: the game highlights that part of the screen while it shows.
 */
export type Bubble = { actor: RobotId; text: string; mood: Mood; files: readonly Path[]; point?: Pointer };

/** The bubble a point step shows. Shared by scenes and the on-demand screen tour. */
export function pointBubble(step: PointStep): Bubble {
  return {
    actor: step.actor,
    text: step.text,
    mood: step.mood ?? "talking",
    files: [],
    point: { target: step.target, focus: step.focus ?? null },
  };
}

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

/**
 * Check every goal of the level against the repository. A goal that throws is a bug in the level:
 * the player sees it as not met (the game keeps running), and outside production it is logged so
 * tests and development builds notice it.
 */
export function checkGoals(level: Level, repo: RepoState): boolean[] {
  return level.goals.map((g) => {
    try {
      return g.check(repo, queries);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`Goal "${g.id}" of level ${level.id} threw while being checked:`, error);
      }
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
        state: { ...next, bubble: { actor: step.actor, text: step.text, mood, files: step.files ?? [] }, moods: { ...s.moods, [step.actor]: mood } },
        wait: { kind: "click" },
      };
    }
    case "point": {
      // Spoken like a say line; the bubble also carries what to highlight.
      const bubble = pointBubble(step);
      return {
        state: { ...next, bubble, moods: { ...s.moods, [step.actor]: bubble.mood } },
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
  const problem = validateCommandLine(text);
  if (problem) {
    const lines: NewLine[] = [
      { kind: "command", actor: "player", path, text },
      { kind: "error", actor: "player", text: problem },
    ];
    return { state: { ...s, commands: s.commands + 1, ...addLines(s, lines) }, ok: false, changed: false, won: false };
  }
  const argv = engine.parseCommandLine(text);
  const r = engine.run(s.repo, { actor: "player", argv });
  const lines: NewLine[] = [{ kind: "command", actor: "player", path, text }];
  for (const o of r.output) lines.push({ kind: o.kind, actor: "player", text: o.text });
  const changed = r.ok && r.state !== s.repo;
  // Re-check after every accepted command, not only when the state object changed, so a goal can
  // never be left stale. A refused command changes nothing (see CommandResult), so it keeps the goals.
  const goals = r.ok ? checkGoals(s.level, r.state) : s.goals;
  const won = r.ok && goals.length > 0 && goals.every(Boolean);
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

/**
 * The player saved a file in the conflict editor. Not a git command: it writes the working file
 * through the engine, so events, goals and the win check work the same way a command's would.
 * Does not count as a command.
 */
export function editPlayerFile(s: GameState, path: string, content: string): CommandOutcome {
  if (s.phase !== "play") return { state: s, ok: true, changed: false, won: false };
  const r = engine.edit(s.repo, { kind: "write", actor: "player", path, content });
  const changed = r.ok && r.state !== s.repo;
  const lines: NewLine[] = r.ok
    ? [{ kind: "note", text: `You saved ${path}.` }]
    : r.output.map((o) => ({ kind: o.kind, actor: "player", text: o.text }));
  const conflicts = s.repo.worktrees.player?.conflicts;
  if (r.ok && conflicts && Object.hasOwn(conflicts, path)) {
    lines.push({ kind: "hint", actor: "player", text: `Now stage it with git add ${path}` });
  }
  const goals = r.ok ? checkGoals(s.level, r.state) : s.goals;
  const won = r.ok && goals.length > 0 && goals.every(Boolean);
  let state: GameState = {
    ...s,
    repo: r.state,
    events: changed ? r.events : s.events,
    goals,
    ...addLines(s, lines),
  };
  if (won) state = enterScript({ ...state, phase: "outro", cursor: 0 });
  return { state, ok: r.ok, changed, won };
}

// ---------------------------------------------------------------------------
// The level model: the game state plus what the driver is waiting for. useLevel runs this reducer
// with React's useReducer and adds the timers; it lives here so it can be tested without React.
// ---------------------------------------------------------------------------

export type LevelModel = {
  game: GameState;
  wait: Wait;
  /** Bumped on restart so the map remounts instead of animating back. */
  run: number;
  /**
   * The on-demand screen tour, played over the player turn: point steps only, no git. null when
   * no tour is showing. It never touches the game state, so the level carries on where it was.
   */
  tour: { steps: PointStep[]; at: number } | null;
  /**
   * Tidy's hint during the player turn: "thinking" while the request runs, then the hint itself.
   * Shown next to the command box; it never stops the player typing. null when no hint shows.
   */
  hint: HintView | null;
  /** Hints asked for in this run (restart starts a new run). At most MAX_HINTS_PER_RUN. */
  hintsUsed: number;
  /**
   * The hint texts Tidy has shown in this run, oldest first. Refunded answers (the offline and busy
   * lines) are not hints and are left out. The next hint request sends these as `previousHints`.
   */
  hintsShown: string[];
};

/** `key` ties an answer to the request that asked for it, so a late answer after a restart is dropped. */
export type HintView = { key: string; status: "thinking" } | { key: string; status: "shown"; text: string };

/** What Tidy says while a hint request runs. */
export const HINT_THINKING_TEXT = "Hmm, let me think…";

export type LevelAction =
  | { type: "begin" }
  /** A timer ran out: play the next scene step. Ignored while a robot line waits for a click. */
  | { type: "step" }
  /** The player clicked past a robot line. */
  | { type: "continue" }
  | { type: "skip" }
  | { type: "command"; line: string }
  | { type: "edit"; path: string; content: string }
  | { type: "restart"; level: Level }
  /** Show the screen tour (the "?" button). Only during the player turn. */
  | { type: "tour"; steps: PointStep[] }
  /** The player asked Tidy for a hint ("Ask Tidy"). Only during the player turn, with hints left. */
  | { type: "hint-ask" }
  /** The hint for request `key` arrived. `refund` gives the hint back (the request never reached the model). */
  | { type: "hint-answer"; key: string; text: string; refund?: boolean }
  /** The player put the hint away. */
  | { type: "hint-dismiss" };

const NO_WAIT: Wait = { kind: "none" };

export function initLevelModel(level: Level): LevelModel {
  return { game: startLevel(level), wait: NO_WAIT, run: 0, tour: null, hint: null, hintsUsed: 0, hintsShown: [] };
}

/** Hints left in this run. */
export function hintsLeft(m: LevelModel): number {
  return Math.max(0, MAX_HINTS_PER_RUN - m.hintsUsed);
}

/** The key the next hint request will get: unique per run and per hint. */
export function nextHintKey(m: LevelModel): string {
  return `${m.run}:${m.hintsUsed + 1}`;
}

/** Can the player ask for a hint right now? */
export function canAskHint(m: LevelModel): boolean {
  return m.game.phase === "play" && !m.tour && m.hint?.status !== "thinking" && hintsLeft(m) > 0;
}

/** Tidy's hint line, while one shows. */
export function hintBubble(m: LevelModel): Bubble | null {
  if (!m.hint || m.tour || m.game.phase !== "play") return null;
  return m.hint.status === "thinking"
    ? { actor: "tidy", text: HINT_THINKING_TEXT, mood: "thinking", files: [] }
    : { actor: "tidy", text: m.hint.text, mood: "talking", files: [] };
}

/** The line on screen: the tour's current step while a tour shows, otherwise the scene's. */
export function shownBubble(m: LevelModel): Bubble | null {
  if (m.tour) return pointBubble(m.tour.steps[m.tour.at]);
  return m.game.bubble;
}

export function levelReducer(m: LevelModel, a: LevelAction): LevelModel {
  if (m.tour) return tourReducer(m, m.tour, a);
  switch (a.type) {
    case "tour":
      return m.game.phase === "play" && a.steps.length > 0 ? { ...m, tour: { steps: a.steps, at: 0 }, hint: null } : m;
    case "hint-ask":
      return canAskHint(m) ? { ...m, hint: { key: nextHintKey(m), status: "thinking" }, hintsUsed: m.hintsUsed + 1 } : m;
    case "hint-answer":
      if (m.hint?.key !== a.key || m.hint.status !== "thinking") return m;
      return {
        ...m,
        hint: m.game.phase === "play" ? { key: a.key, status: "shown", text: a.text } : null,
        hintsUsed: a.refund ? Math.max(0, m.hintsUsed - 1) : m.hintsUsed,
        hintsShown: a.refund ? m.hintsShown : [...m.hintsShown, a.text],
      };
    case "hint-dismiss":
      return m.hint ? { ...m, hint: null } : m;
    case "begin":
      return m.game.phase === "brief" ? { ...m, game: begin(m.game), wait: NO_WAIT } : m;
    case "step": {
      if (m.wait.kind === "click") return m;
      const { state, wait } = advance(m.game);
      return { ...m, game: state, wait };
    }
    case "continue": {
      if (m.wait.kind !== "click") return m;
      const { state, wait } = advance(m.game);
      return { ...m, game: state, wait };
    }
    case "skip": {
      const game = skipScript(m.game);
      return game === m.game ? m : { ...m, game, wait: NO_WAIT };
    }
    case "command": {
      const out = runPlayerCommand(m.game, a.line);
      if (out.state === m.game) return m;
      // A winning command plays out on the map before the closing scene starts.
      const wait: Wait = out.won && out.changed ? { kind: "animate", events: out.state.events } : NO_WAIT;
      return { ...m, game: out.state, wait, hint: out.won ? null : m.hint };
    }
    case "edit": {
      const out = editPlayerFile(m.game, a.path, a.content);
      if (out.state === m.game) return m;
      const wait: Wait = out.won && out.changed ? { kind: "animate", events: out.state.events } : NO_WAIT;
      return { ...m, game: out.state, wait, hint: out.won ? null : m.hint };
    }
    case "restart":
      return { ...initLevelModel(a.level), run: m.run + 1 };
  }
}

/** While the screen tour shows: continue walks it, skip (Esc) ends it, restart restarts. The rest waits. */
function tourReducer(m: LevelModel, tour: NonNullable<LevelModel["tour"]>, a: LevelAction): LevelModel {
  switch (a.type) {
    case "continue": {
      const at = tour.at + 1;
      return { ...m, tour: at < tour.steps.length ? { ...tour, at } : null };
    }
    case "skip":
      return { ...m, tour: null };
    case "restart":
      return levelReducer({ ...m, tour: null }, a);
    default:
      return m;
  }
}
