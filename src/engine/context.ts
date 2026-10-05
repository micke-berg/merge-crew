// The working state of one command: a private copy of the repository, the output and the events.

import { get, shortOid, subject, treeOf } from "./objects";
import { headOid } from "./revisions";
import type {
  ActorId,
  EngineEvent,
  FileTree,
  HeadRef,
  Oid,
  OutputLine,
  Path,
  RefChangeReason,
  RepoState,
  Worktree,
} from "./types";

/** Thrown inside a command to stop it. The engine turns it into ok: false and the unchanged state. */
export class Fail extends Error {
  constructor(readonly lines: OutputLine[]) {
    super(lines.map((l) => l.text).join("\n"));
  }
}

export function fail(...texts: string[]): never {
  throw new Fail(texts.flatMap((t) => t.split("\n")).map((text) => ({ kind: "error" as const, text })));
}

export function failWith(lines: OutputLine[]): never {
  throw new Fail(lines);
}

export function notSupported(what: string): never {
  fail(`${what} is not supported in Merge Crew yet`);
}

export class Ctx {
  readonly output: OutputLine[] = [];
  readonly events: EngineEvent[] = [];
  /** Set when a command drops conflicts without resolving them (abort, reset). */
  conflictsDiscarded = false;

  constructor(
    readonly state: RepoState,
    readonly actor: ActorId,
    /** The logical time stamped on everything this command creates. */
    readonly time: number,
  ) {}

  get wt(): Worktree {
    const wt = this.state.worktrees[this.actor];
    if (!wt) fail(`fatal: '${this.actor}' has no worktree. Create one with git worktree add`);
    return wt;
  }

  out(...texts: string[]): void {
    for (const t of texts) for (const text of t.split("\n")) this.output.push({ kind: "out", text });
  }

  err(...texts: string[]): void {
    for (const t of texts) for (const text of t.split("\n")) this.output.push({ kind: "error", text });
  }

  hint(...texts: string[]): void {
    for (const t of texts) for (const text of t.split("\n")) this.output.push({ kind: "hint", text });
  }

  emit(event: EngineEvent): void {
    this.events.push(event);
  }

  headOid(wt: Worktree = this.wt): Oid | null {
    return headOid(this.state, wt);
  }

  headTree(wt: Worktree = this.wt): FileTree {
    return treeOf(this.state, this.headOid(wt));
  }

  tree(oid: Oid | null): FileTree {
    return treeOf(this.state, oid);
  }

  oneline(oid: Oid): string {
    return `${shortOid(oid)} ${subject(this.state.commits[oid]?.message ?? "")}`;
  }

  logHead(wt: Worktree, previous: Oid | null, oid: Oid, message: string): void {
    wt.headReflog.push({ oid, previous, message, time: this.time });
  }

  /** The worktree (other than `except`) that has `branch` checked out. */
  worktreeUsing(branch: string, except?: ActorId): Worktree | null {
    for (const wt of Object.values(this.state.worktrees)) {
      if (wt.actor !== except && wt.head.kind === "branch" && wt.head.name === branch) return wt;
    }
    return null;
  }

  /**
   * Point a branch at a commit, writing its reflog. The running worktree's HEAD reflog gets the
   * same line when HEAD is that branch. Git skips the branch reflog when the value does not change
   * but still logs HEAD.
   */
  updateBranch(name: string, to: Oid, reason: RefChangeReason, message: string): void {
    const from = this.state.branches[name] ?? null;
    if (from !== to) {
      this.state.branches[name] = to;
      const log = this.state.branchReflogs[name] ?? (this.state.branchReflogs[name] = []);
      log.push({ oid: to, previous: from, message, time: this.time });
      if (from === null) this.emit({ type: "branch-created", actor: this.actor, name, oid: to });
      else this.emit({ type: "branch-moved", actor: this.actor, name, from, to, reason });
    }
    const wt = this.state.worktrees[this.actor];
    if (wt && wt.head.kind === "branch" && wt.head.name === name) this.logHead(wt, from, to, message);
  }

  setHead(wt: Worktree, to: HeadRef): void {
    const from = wt.head;
    const same =
      from.kind === to.kind &&
      (from.kind === "branch" ? from.name === (to as { name: string }).name : from.oid === (to as { oid: Oid }).oid);
    wt.head = to;
    if (!same) this.emit({ type: "head-moved", actor: wt.actor, from, to });
  }

  /** Move whatever HEAD points at (the branch, or HEAD itself when detached) to a commit. */
  advanceHead(to: Oid, reason: RefChangeReason, message: string): void {
    const wt = this.wt;
    if (wt.head.kind === "branch") {
      this.updateBranch(wt.head.name, to, reason, message);
    } else {
      const from = wt.head.oid;
      this.logHead(wt, from, to, message);
      this.setHead(wt, { kind: "detached", oid: to });
    }
  }
}

export type TwoWayResult = { index: Record<Path, string>; working: Record<Path, string> };

/**
 * Move a worktree from one tree to another the way `git checkout` does (unpack-trees' two-way
 * merge): paths that are the same in both trees keep their local changes, paths that differ are
 * replaced, and the command stops if that would overwrite uncommitted work.
 */
export function twoWayCheckout(
  oldTree: FileTree,
  newTree: FileTree,
  index: FileTree,
  working: FileTree,
  action: "checkout" | "merge",
): TwoWayResult {
  const nextIndex: Record<Path, string> = { ...index };
  const nextWorking: Record<Path, string> = { ...working };
  const local: Path[] = [];
  const untracked: Path[] = [];
  const paths = new Set<Path>([...Object.keys(oldTree), ...Object.keys(newTree), ...Object.keys(index)]);
  for (const path of [...paths].sort()) {
    const o = get(oldTree, path);
    const n = get(newTree, path);
    const i = get(index, path);
    const w = get(working, path);
    if (o === n || i === n) continue;
    if (i !== o) {
      local.push(path);
      continue;
    }
    if (i === undefined) {
      if (w !== undefined) {
        untracked.push(path);
        continue;
      }
    } else if (w !== undefined && w !== i) {
      local.push(path);
      continue;
    }
    if (n === undefined) {
      delete nextIndex[path];
      delete nextWorking[path];
    } else {
      nextIndex[path] = n;
      nextWorking[path] = n;
    }
  }
  if (local.length) {
    fail(
      `error: Your local changes to the following files would be overwritten by ${action}:`,
      ...local.map((p) => `\t${p}`),
      action === "checkout"
        ? "Please commit your changes or stash them before you switch branches."
        : "Please commit your changes or stash them before you merge.",
      "Aborting",
    );
  }
  if (untracked.length) {
    fail(
      `error: The following untracked working tree files would be overwritten by ${action}:`,
      ...untracked.map((p) => `\t${p}`),
      action === "checkout"
        ? "Please move or remove them before you switch branches."
        : "Please move or remove them before you merge.",
      "Aborting",
    );
  }
  return { index: nextIndex, working: nextWorking };
}
