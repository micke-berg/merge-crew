// The Merge Crew git engine: pure functions from (state, command) to (new state, output, events).

import { Ctx, Fail } from "./context";
import { cloneState, deepEqual, changedPaths } from "./objects";
import { queries } from "./query";
import { branch } from "./commands/branch";
import { checkout, restore, switchCommand } from "./commands/checkout";
import { commit } from "./commands/commit";
import { diff, show } from "./commands/diff";
import { add, rm } from "./commands/files";
import { log, reflog } from "./commands/log";
import { merge } from "./commands/merge";
import { cherryPick, revert } from "./commands/pick";
import { rebase } from "./commands/rebase";
import { fetch, pull, push } from "./commands/remote";
import { reset } from "./commands/reset";
import { cat, ls } from "./commands/shell";
import { stash } from "./commands/stash";
import { status } from "./commands/status";
import { worktree } from "./commands/worktree";
import type {
  CommandInput,
  CommandResult,
  CreateRepoOptions,
  Engine,
  EngineEvent,
  FileEdit,
  OutputLine,
  RepoState,
} from "./types";

export * from "./types";
export { queries } from "./query";

type Command = (ctx: Ctx, args: string[]) => void;

const COMMANDS: Record<string, Command> = {
  add,
  rm,
  commit,
  status,
  log,
  reflog,
  branch,
  switch: switchCommand,
  checkout,
  restore,
  reset,
  merge,
  push,
  fetch,
  pull,
  worktree,
  rebase,
  "cherry-pick": cherryPick,
  revert,
  stash,
  diff,
  show,
};

/** Read-only shell commands for looking at files. */
const SHELL: Record<string, Command> = { cat, ls };

/** Real git commands that a later wave will add. */
const PLANNED = new Set(["tag", "remote", "clean", "mv"]);

function createRepo(options: CreateRepoOptions = {}): RepoState {
  return {
    commits: {},
    branches: {},
    branchReflogs: {},
    upstreams: {},
    remoteTracking: {},
    remotes: options.withOrigin === false ? {} : { origin: { name: "origin", branches: {} } },
    worktrees: {
      player: {
        actor: "player",
        path: "/repo",
        head: { kind: "branch", name: "main" },
        index: {},
        conflicts: {},
        workingTree: {},
        headReflog: [],
        inProgress: null,
      },
    },
    stash: [],
    clock: 0,
  };
}

function failure(state: RepoState, output: OutputLine[]): CommandResult {
  return { ok: false, state, output, events: [] };
}

/**
 * Events every command gets for free by comparing before and after: file changes per worktree,
 * resolved conflicts, and commits that became lost or found again.
 */
function derivedEvents(before: RepoState, after: RepoState, ctx: Ctx): EngineEvent[] {
  const events: EngineEvent[] = [];
  for (const [actor, wt] of Object.entries(after.worktrees)) {
    const old = before.worktrees[actor];
    if (!old) continue;
    const working = changedPaths(old.workingTree, wt.workingTree);
    if (working.length) events.push({ type: "files-changed", actor, area: "working", paths: working });
    const index = changedPaths(old.index, wt.index);
    if (index.length) events.push({ type: "files-changed", actor, area: "index", paths: index });
    const resolved = Object.keys(old.conflicts).filter((p) => !wt.conflicts[p]).sort();
    if (resolved.length && !ctx.conflictsDiscarded) events.push({ type: "conflict-resolved", actor, paths: resolved });
  }
  const lostBefore = new Set(queries.lost(before));
  const lostAfter = queries.lost(after);
  const newlyLost = lostAfter.filter((o) => !lostBefore.has(o) && before.commits[o]);
  const lostAfterSet = new Set(lostAfter);
  const recovered = [...lostBefore].filter((o) => !lostAfterSet.has(o));
  if (newlyLost.length) events.push({ type: "commits-lost", oids: newlyLost });
  if (recovered.length) events.push({ type: "commits-recovered", oids: recovered });
  return events;
}

function finish(before: RepoState, ctx: Ctx): CommandResult {
  const after = ctx.state;
  after.clock = before.clock;
  if (deepEqual(before, after)) return { ok: true, state: before, output: ctx.output, events: ctx.events };
  after.clock = ctx.time;
  return { ok: true, state: after, output: ctx.output, events: [...ctx.events, ...derivedEvents(before, after, ctx)] };
}

function execute(state: RepoState, actor: string, body: (ctx: Ctx) => void): CommandResult {
  const ctx = new Ctx(cloneState(state), actor, state.clock + 1);
  try {
    body(ctx);
  } catch (e) {
    if (e instanceof Fail) return failure(state, [...ctx.output, ...e.lines]);
    const message = e instanceof Error ? e.message : String(e);
    return failure(state, [{ kind: "error", text: `internal engine error: ${message}` }]);
  }
  return finish(state, ctx);
}

function run(state: RepoState, input: CommandInput): CommandResult {
  const [program, sub, ...args] = input.argv;
  if (program !== "git") {
    const shell = program !== undefined ? SHELL[program] : undefined;
    if (!shell) {
      return failure(state, [{ kind: "error", text: `${program ?? ""}: shell commands are not supported in Merge Crew yet` }]);
    }
    if (!state.worktrees[input.actor]) {
      return failure(state, [{ kind: "error", text: `${program}: '${input.actor}' has no worktree` }]);
    }
    return execute(state, input.actor, (ctx) => shell(ctx, input.argv.slice(1)));
  }
  if (sub === undefined) return failure(state, [{ kind: "error", text: "usage: git <command> [<args>]" }]);
  const command = COMMANDS[sub];
  if (!command) {
    const text = PLANNED.has(sub)
      ? `git ${sub} is not supported in Merge Crew yet`
      : `git: '${sub}' is not a git command. See 'git --help'.`;
    return failure(state, [{ kind: "error", text }]);
  }
  if (!state.worktrees[input.actor]) {
    return failure(state, [{ kind: "error", text: "fatal: not a git repository (or any of the parent directories): .git" }]);
  }
  return execute(state, input.actor, (ctx) => command(ctx, args));
}

function edit(state: RepoState, change: FileEdit): CommandResult {
  return execute(state, change.actor, (ctx) => {
    const wt = ctx.wt;
    const path = change.path.replace(/^(\.\/)+/, "");
    const working = { ...wt.workingTree };
    if (change.kind === "write") working[path] = change.content;
    else delete working[path];
    const sorted: Record<string, string> = {};
    for (const key of Object.keys(working).sort()) sorted[key] = working[key];
    wt.workingTree = sorted;
  });
}

/** Split a command line into words. Supports single quotes, double quotes and backslash escapes. */
function parseCommandLine(line: string): string[] {
  const words: string[] = [];
  let current = "";
  let inWord = false;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && (line[i + 1] === '"' || line[i + 1] === "\\")) current += line[++i];
      else current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      inWord = true;
    } else if (ch === "\\" && i + 1 < line.length) {
      current += line[++i];
      inWord = true;
    } else if (/\s/.test(ch)) {
      if (inWord) words.push(current);
      current = "";
      inWord = false;
    } else {
      current += ch;
      inWord = true;
    }
  }
  if (inWord) words.push(current);
  return words;
}

export const engine: Engine = { createRepo, run, edit, parseCommandLine };

export default engine;
