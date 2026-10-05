// Shared types for the git engine, the levels and the views.
// Changing a type here is a contract change: update docs/architecture.md with it.

// ---------------------------------------------------------------------------
// Repository model
// ---------------------------------------------------------------------------

/** A commit id. 40 lowercase hex characters, generated deterministically by the engine. Shown shortened to 7. */
export type Oid = string;

/** A file path relative to the worktree root, with forward slashes, e.g. "src/app.ts". */
export type Path = string;

/** File contents keyed by path. A flat map stands in for git's tree objects. */
export type FileTree = Readonly<Record<Path, string>>;

/** Who ran a command: "player", or a robot id such as "blaze". */
export type ActorId = string;

export type Commit = {
  oid: Oid;
  parents: Oid[];
  message: string;
  tree: FileTree;
  author: ActorId;
  /** Logical clock value at creation. */
  time: number;
};

export type HeadRef =
  | { kind: "branch"; name: string }
  | { kind: "detached"; oid: Oid };

/**
 * One reflog line. `message` follows git's wording, e.g. "commit: Add login", "reset: moving to HEAD~2".
 * Reflog arrays are stored oldest first.
 */
export type ReflogEntry = {
  oid: Oid;
  previous: Oid | null;
  message: string;
  time: number;
};

/** A path with an unresolved merge conflict. null means the file did not exist on that side. */
export type ConflictEntry = {
  base: string | null;
  ours: string | null;
  theirs: string | null;
};

/** An operation that stopped part-way, usually on a conflict. */
export type InProgress =
  | { kind: "merge"; theirs: Oid; message: string }
  | { kind: "rebase"; onto: Oid; todo: Oid[]; done: Oid[]; origHead: Oid; branch: string | null }
  | { kind: "cherry-pick"; oid: Oid; todo?: Oid[]; head?: Oid | null }
  | { kind: "revert"; oid: Oid; todo?: Oid[]; head?: Oid | null };

/**
 * One checkout of the shared repository. The player owns the main worktree, and each robot works in
 * its own linked worktree, the way parallel coding agents do. Worktrees share commits, branches,
 * remotes and the stash, but each has its own HEAD, index, working files and HEAD reflog.
 */
export type Worktree = {
  actor: ActorId;
  /** Display path, e.g. "/repo" for the player or "/crew/blaze". */
  path: string;
  head: HeadRef;
  /** The staging area. Conflicted paths are absent here and listed in `conflicts`. */
  index: FileTree;
  conflicts: Readonly<Record<Path, ConflictEntry>>;
  workingTree: FileTree;
  headReflog: ReflogEntry[];
  inProgress: InProgress | null;
};

export type StashEntry = {
  /** The stash commit. Stored in `commits`, so it can be recovered like any other commit. */
  oid: Oid;
  /** e.g. "WIP on main: 1a2b3c4 Add login" or "On main: my message". */
  message: string;
  base: Oid;
  index: FileTree;
  workingTree: FileTree;
};

/** The server side of a remote, such as origin. Its commits live in the shared `commits` store. */
export type Remote = {
  name: string;
  branches: Record<string, Oid>;
};

export type RepoState = {
  /** Every object the repository has ever created. Nothing is garbage collected during a game. */
  commits: Record<Oid, Commit>;
  branches: Record<string, Oid>;
  branchReflogs: Record<string, ReflogEntry[]>;
  /** Branch name -> upstream, e.g. { main: { remote: "origin", branch: "main" } }. */
  upstreams: Record<string, { remote: string; branch: string }>;
  /** Remote-tracking refs as the local repository last saw them, keyed like "origin/main". */
  remoteTracking: Record<string, Oid>;
  remotes: Record<string, Remote>;
  worktrees: Record<ActorId, Worktree>;
  /** Newest first, like stash@{0}. */
  stash: StashEntry[];
  /** Increases by one for every command that changes state. */
  clock: number;
};

// ---------------------------------------------------------------------------
// Running commands
// ---------------------------------------------------------------------------

export type CommandInput = {
  actor: ActorId;
  /** The command split into words, e.g. ["git", "commit", "-m", "Add login"]. Quoting is already resolved. */
  argv: string[];
};

export type OutputLine = {
  kind: "out" | "error" | "hint";
  text: string;
};

export type CommandResult = {
  /**
   * false when the command was refused and nothing changed. A merge, pull or similar that stops on a
   * conflict is ok: true (git exits non-zero there, but the state did change), with a "conflict" event.
   */
  ok: boolean;
  /**
   * The new state. Equal to the input state when `ok` is false. A refused command never leaves partial
   * changes, even where real git does (for example a failed pull keeping fetched refs). Those cases are
   * listed as known differences in docs/decisions.md.
   */
  state: RepoState;
  output: OutputLine[];
  events: EngineEvent[];
};

/** Direct file edits by an actor, used by scripted robots and the conflict editor. Not git commands. */
export type FileEdit =
  | { kind: "write"; actor: ActorId; path: Path; content: string }
  | { kind: "delete"; actor: ActorId; path: Path };

// ---------------------------------------------------------------------------
// Events: what changed, in order. The views animate these.
// ---------------------------------------------------------------------------

export type RefChangeReason =
  | "commit"
  | "amend"
  | "reset"
  | "merge"
  | "fast-forward"
  | "rebase"
  | "cherry-pick"
  | "revert"
  | "pull"
  | "branch"
  | "other";

export type EngineEvent =
  | { type: "commit-created"; actor: ActorId; oid: Oid; parents: Oid[]; branch: string | null }
  | { type: "branch-created"; actor: ActorId; name: string; oid: Oid }
  | { type: "branch-moved"; actor: ActorId; name: string; from: Oid; to: Oid; reason: RefChangeReason }
  | { type: "branch-deleted"; actor: ActorId; name: string; oid: Oid }
  | { type: "head-moved"; actor: ActorId; from: HeadRef; to: HeadRef }
  | { type: "worktree-added"; actor: ActorId; path: string; head: HeadRef }
  | { type: "files-changed"; actor: ActorId; area: "working" | "index"; paths: Path[] }
  | { type: "conflict"; actor: ActorId; paths: Path[] }
  | { type: "conflict-resolved"; actor: ActorId; paths: Path[] }
  | { type: "operation"; actor: ActorId; kind: InProgress["kind"]; phase: "started" | "stopped" | "completed" | "aborted" }
  | { type: "remote-updated"; actor: ActorId; remote: string; branch: string; from: Oid | null; to: Oid | null; forced: boolean }
  | { type: "remote-tracking-updated"; actor: ActorId; ref: string; from: Oid | null; to: Oid | null }
  | { type: "stash-pushed"; actor: ActorId; oid: Oid }
  | { type: "stash-removed"; actor: ActorId; oid: Oid; applied: boolean }
  /** Commits that no ref or remote branch reaches any more. They still exist and the reflog still knows them. */
  | { type: "commits-lost"; oids: Oid[] }
  /** Commits that were lost and are reachable again. */
  | { type: "commits-recovered"; oids: Oid[] };

// ---------------------------------------------------------------------------
// Engine API, implemented in src/engine/index.ts
// ---------------------------------------------------------------------------

export type CreateRepoOptions = {
  /** Add a bare remote called "origin" with no branches. Default true. */
  withOrigin?: boolean;
};

export interface Engine {
  /** An empty repository: the player's worktree at "/repo" on an unborn "main", plus an empty origin. */
  createRepo(options?: CreateRepoOptions): RepoState;
  /** Run one command. Never throws for user mistakes: those return ok: false with an error line. */
  run(state: RepoState, input: CommandInput): CommandResult;
  /** Apply a direct file edit to an actor's working files. */
  edit(state: RepoState, edit: FileEdit): CommandResult;
  /** Split a typed command line into argv, handling single and double quotes. */
  parseCommandLine(line: string): string[];
}

/** Read-only questions about a state, for goal checks, hints and views. Implemented in src/engine/query.ts. */
export interface Queries {
  /** Resolve a revision (branch, oid prefix, HEAD, HEAD~2, HEAD^2, main@{1}, origin/main) in an actor's worktree. */
  resolve(state: RepoState, actor: ActorId, rev: string): Oid | null;
  isAncestor(state: RepoState, ancestor: Oid, descendant: Oid): boolean;
  /** Every commit reachable from local branches, remote branches, remote-tracking refs, worktree HEADs and the stash. */
  reachable(state: RepoState): Set<Oid>;
  /** Commits that exist but are not reachable. These are the "lost" commits. */
  lost(state: RepoState): Oid[];
  /** First-parent and merge history from a commit, newest first. */
  history(state: RepoState, from: Oid): Commit[];
  /** The branch an actor has checked out, or null when detached or unborn. */
  currentBranch(state: RepoState, actor: ActorId): string | null;
  /** Paths that differ between HEAD, index and working files, the way `git status` groups them. */
  status(state: RepoState, actor: ActorId): {
    staged: { path: Path; change: "added" | "modified" | "deleted" }[];
    unstaged: { path: Path; change: "modified" | "deleted" }[];
    untracked: Path[];
    conflicted: Path[];
  };
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export type RobotId = "tidy" | "blaze" | "drift" | "hoarder";

export type Mood = "idle" | "talking" | "thinking" | "happy" | "celebrate" | "scared" | "guilty" | "surprised";

/** One step of a script. Setup steps run instantly; scene steps are played back with animation. */
export type ScriptStep =
  | { kind: "git"; actor: ActorId; argv: string[] }
  | { kind: "edit"; edit: FileEdit }
  /** A robot line. `files` names working files the line talks about; the files panel highlights them while it shows. */
  | { kind: "say"; actor: RobotId; text: string; mood?: Mood; files?: Path[] }
  | { kind: "mood"; actor: RobotId; mood: Mood }
  | { kind: "pause"; ms: number }
  /**
   * A guided-tour step: a robot explains one part of the screen while the game highlights it.
   * `target` names a screen region; `focus` optionally narrows a map highlight to commits (by message)
   * or branches (by name). Waits for a click like a spoken line.
   */
  | {
      kind: "point";
      actor: RobotId;
      target: ScreenTarget;
      text: string;
      mood?: Mood;
      focus?: { commits?: string[]; branches?: string[]; lost?: boolean };
    };

/** Screen regions a guided-tour step can point at. */
export type ScreenTarget = "map" | "jobbar" | "terminal" | "suggestions" | "goals" | "files";

export type Goal = {
  id: string;
  /** Shown to the player, e.g. "Get Tidy's two commits back onto main on origin". */
  description: string;
  check: (state: RepoState, queries: Queries) => boolean;
};

export type Level = {
  id: string;
  act: 1 | 2 | 3;
  /** Order within the act, starting at 1. */
  order: number;
  title: string;
  /** One or two sentences shown before the level starts, and in the level list. */
  brief: string;
  /**
   * The level's mission card, in plain words rather than robot voice. Shown on the brief card above
   * the goals. `practise` lists the commands the level teaches, e.g. ["git add", "git commit"].
   */
  mission?: { situation: string; job: string; practise: string[] };
  crew: RobotId[];
  /** Runs instantly from createRepo() to build the starting repository. */
  setup: ScriptStep[];
  /** Played as the opening scene. */
  intro: ScriptStep[];
  goals: Goal[];
  /** What the hint helper may know: the problem and the intended fix. Never shown to the player directly. */
  hintContext: string;
  /** Commands the suggestion buttons offer, e.g. ["git status", "git reflog"]. */
  suggestions: string[];
  /** Played when every goal passes. */
  outro: ScriptStep[];
};
