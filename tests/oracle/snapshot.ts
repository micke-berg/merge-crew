// A Snapshot is a repository state with every oid replaced by a commit label, so real git and the
// engine can be compared directly. A commit's label is its message. When two different commits in
// the same snapshot share a message (amend --no-edit, for example), the label gets a short hash of
// the commit's tree added, which is the same on both sides when the trees match.
//
// Full oids inside working files (pull conflict markers name the fetched commit) are replaced by
// "<label>" on both sides, and so are 7-character abbreviations of known commits.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import type { RepoState, ReflogEntry } from "@/engine/types";
import { gitOut, readObjectStore, runGit, type GitObject } from "./git-cli";

export type Files = Record<string, string>;

export type CommitSnap = {
  parents: string[];
  author: string;
  tree: Files;
};

export type ConflictSnap = { base: string | null; ours: string | null; theirs: string | null };

export type WorktreeSnap = {
  /** A branch name (also when unborn), or "detached:<label>". */
  head: string;
  index: Files;
  working: Files;
  conflicts: Record<string, ConflictSnap>;
  inProgress: string | null;
  /** HEAD reflog, oldest first, as commit labels. Entries that point at the zero oid are left out. */
  headReflog: string[];
};

export type Snapshot = {
  branches: Record<string, string>;
  /** Remote-tracking refs as the local repository sees them, e.g. "origin/main". */
  remoteTracking: Record<string, string>;
  /** Branches on the server side of each remote. */
  remotes: Record<string, Record<string, string>>;
  /** Branch -> "origin/main". */
  upstreams: Record<string, string>;
  commits: Record<string, CommitSnap>;
  worktrees: Record<string, WorktreeSnap>;
  /** Newest first, with the abbreviated oid removed. */
  stash: string[];
  /** Branch reflogs, oldest first. Only main for now. */
  branchReflogs: Record<string, string[]>;
};

/** Branches whose reflog is part of the snapshot. */
const BRANCH_REFLOGS = ["main"];

const ZERO_OID = /^0{40}$/;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type RawCommit = { id: string; parents: string[]; author: string; message: string; tree: Files };

function sortKeys<T>(rec: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(rec).sort()) out[key] = rec[key];
  return out;
}

function mapValues<T, U>(rec: Record<string, T>, fn: (v: T) => U): Record<string, U> {
  const out: Record<string, U> = {};
  for (const key of Object.keys(rec).sort()) out[key] = fn(rec[key]);
  return out;
}

function treeHash(tree: Files): string {
  return createHash("sha1").update(JSON.stringify(sortKeys(tree))).digest("hex").slice(0, 8);
}

function normaliseStash(message: string): string {
  return message.replace(/^((?:WIP on|On) [^:]+: )[0-9a-f]{7,40} /, "$1");
}

type Labeling = {
  commits: Record<string, CommitSnap>;
  label: (id: string) => string;
  /** Replace full oids of known commits inside file text with "<label>". */
  text: (s: string) => string;
};

function labelCommits(raw: RawCommit[]): Labeling {
  const byMessage = new Map<string, RawCommit[]>();
  for (const c of raw) {
    const msg = c.message.trimEnd();
    byMessage.set(msg, [...(byMessage.get(msg) ?? []), c]);
  }
  const labels = new Map<string, string>();
  for (const [msg, group] of byMessage) {
    for (const c of group) labels.set(c.id, group.length === 1 ? msg : `${msg} {tree:${treeHash(c.tree)}}`);
  }
  // A message that names another commit by full oid ("This reverts commit <oid>.") names it by
  // label instead. A commit can only name older commits, so this always terminates.
  const resolved = new Map<string, string>();
  const finalLabel = (id: string, depth = 0): string => {
    const done = resolved.get(id);
    if (done !== undefined) return done;
    const raw = labels.get(id) ?? `<unknown ${id.slice(0, 7)}>`;
    const out =
      depth > 50
        ? raw
        : raw.replace(/\b[0-9a-f]{40}\b/g, (oid) => (labels.has(oid) && oid !== id ? `<${finalLabel(oid, depth + 1)}>` : oid));
    resolved.set(id, out);
    return out;
  };
  for (const id of [...labels.keys()]) finalLabel(id);
  for (const [id, label] of resolved) labels.set(id, label);
  const label = (id: string) => labels.get(id) ?? `<unknown ${id.slice(0, 7)}>`;
  // Abbreviated oids (rebase and cherry-pick conflict markers say ">>>>>>> 1a2b3c4 (Subject)") are
  // replaced too when exactly one known commit starts with them.
  const byPrefix = (short: string) => {
    const hits = [...labels.keys()].filter((id) => id.startsWith(short));
    return hits.length === 1 ? `<${labels.get(hits[0])}>` : short;
  };
  const text = (s: string) =>
    s
      .replace(/\b[0-9a-f]{40}\b/g, (oid) => (labels.has(oid) ? `<${labels.get(oid)}>` : oid))
      .replace(/\b[0-9a-f]{7}\b/g, byPrefix);
  const commits: Record<string, CommitSnap> = {};
  for (const c of raw) {
    commits[label(c.id)] = { parents: c.parents.map(label), author: c.author, tree: sortKeys(c.tree) };
  }
  return { commits: sortKeys(commits), label, text };
}

// ---------------------------------------------------------------------------
// Engine adapter
// ---------------------------------------------------------------------------

/** Reflog arrays in the engine are oldest first. */
function reflogOids(entries: ReflogEntry[] | undefined): string[] {
  return (entries ?? []).map((e) => e.oid).filter((oid) => oid && !ZERO_OID.test(oid));
}

export function fromEngine(state: RepoState): Snapshot {
  const starts: string[] = [
    ...Object.values(state.branches),
    ...Object.values(state.remoteTracking),
    ...Object.values(state.remotes).flatMap((r) => Object.values(r.branches)),
  ];
  for (const wt of Object.values(state.worktrees)) {
    if (wt.head.kind === "detached") starts.push(wt.head.oid);
    starts.push(...reflogOids(wt.headReflog));
  }
  for (const name of BRANCH_REFLOGS) starts.push(...reflogOids(state.branchReflogs[name]));

  const seen = new Set<string>();
  const stack = [...starts];
  while (stack.length) {
    const oid = stack.pop()!;
    if (seen.has(oid) || !state.commits[oid]) continue;
    seen.add(oid);
    stack.push(...state.commits[oid].parents);
  }
  const raw: RawCommit[] = [...seen].map((oid) => {
    const c = state.commits[oid];
    return { id: oid, parents: c.parents, author: c.author, message: c.message, tree: { ...c.tree } };
  });
  const { commits, label, text } = labelCommits(raw);

  const worktrees: Record<string, WorktreeSnap> = {};
  for (const [actor, wt] of Object.entries(state.worktrees)) {
    worktrees[actor] = {
      head: wt.head.kind === "branch" ? wt.head.name : `detached:${label(wt.head.oid)}`,
      index: sortKeys({ ...wt.index }),
      working: mapValues({ ...wt.workingTree }, text),
      conflicts: mapValues(wt.conflicts, (c) => ({ base: c.base, ours: c.ours, theirs: c.theirs })),
      inProgress: wt.inProgress?.kind ?? null,
      headReflog: reflogOids(wt.headReflog).map(label),
    };
  }

  const branchReflogs: Record<string, string[]> = {};
  for (const name of BRANCH_REFLOGS) {
    if (state.branches[name] !== undefined) branchReflogs[name] = reflogOids(state.branchReflogs[name]).map(label);
  }

  return {
    branches: mapValues(state.branches, label),
    remoteTracking: mapValues(state.remoteTracking, label),
    remotes: mapValues(state.remotes, (r) => mapValues(r.branches, label)),
    upstreams: mapValues(state.upstreams, (u) => `${u.remote}/${u.branch}`),
    commits,
    worktrees: sortKeys(worktrees),
    stash: state.stash.map((s) => normaliseStash(s.message)),
    branchReflogs,
  };
}

// ---------------------------------------------------------------------------
// Real git adapter
// ---------------------------------------------------------------------------
// Refs and the index come from git plumbing (for-each-ref, ls-files -s, cat-file). HEAD files,
// reflogs, worktree registrations and in-progress markers are read straight from the .git folder,
// which keeps a snapshot to a handful of git calls.

export type RealGitLayout = {
  /** The player's repository (main worktree). */
  repo: string;
  /** Bare repositories by remote name, e.g. { origin: "/tmp/x/origin.git" }. */
  remotes: Record<string, string>;
};

function lines(text: string): string[] {
  return text.split("\n").filter((l) => l.length > 0);
}

function readText(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/** The git dir of a worktree: <dir>/.git for the main one, the "gitdir:" target for linked ones. */
function gitDirOf(worktreeDir: string): string {
  const dotGit = join(worktreeDir, ".git");
  if (statSync(dotGit).isDirectory()) return dotGit;
  const target = readFileSync(dotGit, "utf8").replace(/^gitdir: /, "").trim();
  return isAbsolute(target) ? target : join(worktreeDir, target);
}

/** Target oids of a reflog file, oldest first, without zero oids. */
function readReflog(path: string): { oids: string[]; subjects: string[] } {
  const text = readText(path);
  if (text === null) return { oids: [], subjects: [] };
  const oids: string[] = [];
  const subjects: string[] = [];
  for (const line of lines(text)) {
    const [, next] = line.split(" ");
    subjects.push(line.slice(line.indexOf("\t") + 1));
    if (!ZERO_OID.test(next)) oids.push(next);
  }
  return { oids, subjects };
}

function inProgressKind(gitDir: string): string | null {
  if (existsSync(join(gitDir, "rebase-merge")) || existsSync(join(gitDir, "rebase-apply"))) return "rebase";
  if (existsSync(join(gitDir, "MERGE_HEAD"))) return "merge";
  if (existsSync(join(gitDir, "CHERRY_PICK_HEAD"))) return "cherry-pick";
  if (existsSync(join(gitDir, "REVERT_HEAD"))) return "revert";
  return null;
}

/**
 * What an operation stopped part-way leaves in a worktree: the in-progress marker and its target,
 * plus the unmerged index entries. Empty when nothing is in progress.
 */
export async function stopSignature(worktreeDir: string): Promise<string> {
  if (!existsSync(join(worktreeDir, ".git"))) return "";
  const gitDir = gitDirOf(worktreeDir);
  const kind = inProgressKind(gitDir);
  const target = kind === "merge" ? (readText(join(gitDir, "MERGE_HEAD")) ?? "") : "";
  const r = await runGit(worktreeDir, ["ls-files", "-u"]);
  const unmerged = r.code === 0 ? r.stdout.trim() : "";
  return kind === null && unmerged === "" ? "" : `${kind ?? "none"} ${target.trim()}\n${unmerged}`;
}

type RealWorktree = { actor: string; dir: string; gitDir: string };

function listWorktrees(repo: string): RealWorktree[] {
  const commonDir = join(repo, ".git");
  const out: RealWorktree[] = [{ actor: "player", dir: repo, gitDir: commonDir }];
  const linkedRoot = join(commonDir, "worktrees");
  if (!existsSync(linkedRoot)) return out;
  for (const id of readdirSync(linkedRoot).sort()) {
    const gitDir = join(linkedRoot, id);
    const dir = dirname(readFileSync(join(gitDir, "gitdir"), "utf8").trim());
    out.push({ actor: basename(dir), dir, gitDir });
  }
  return out;
}

/** Every file under dir except the top-level .git, read as UTF-8. */
function readWorkingFiles(dir: string): Files {
  const out: Files = {};
  const walk = (abs: string, rel: string) => {
    for (const name of readdirSync(abs).sort()) {
      if (rel === "" && name === ".git") continue;
      const childAbs = join(abs, name);
      const childRel = rel === "" ? name : `${rel}/${name}`;
      if (statSync(childAbs).isDirectory()) walk(childAbs, childRel);
      else out[childRel] = readFileSync(childAbs, "utf8");
    }
  };
  walk(dir, "");
  return out;
}

type ParsedCommit = { tree: string; parents: string[]; author: string; message: string };

function parseCommit(obj: GitObject): ParsedCommit {
  const text = obj.data.toString("utf8");
  const split = text.indexOf("\n\n");
  const header = split < 0 ? text : text.slice(0, split);
  const message = split < 0 ? "" : text.slice(split + 2);
  let tree = "";
  const parents: string[] = [];
  let author = "";
  for (const line of header.split("\n")) {
    if (line.startsWith("tree ")) tree = line.slice(5);
    else if (line.startsWith("parent ")) parents.push(line.slice(7));
    else if (line.startsWith("author ")) author = line.slice(7, line.indexOf(" <"));
  }
  return { tree, parents, author, message };
}

/** Flatten a tree object into path -> blob content. */
function flattenTree(store: Map<string, GitObject>, treeOid: string, prefix = "", out: Files = {}): Files {
  const data = store.get(treeOid)!.data;
  let pos = 0;
  while (pos < data.length) {
    const space = data.indexOf(0x20, pos);
    const nul = data.indexOf(0x00, space);
    const mode = data.subarray(pos, space).toString("utf8");
    const name = data.subarray(space + 1, nul).toString("utf8");
    const oid = data.subarray(nul + 1, nul + 21).toString("hex");
    pos = nul + 21;
    const path = prefix + name;
    if (mode === "40000") flattenTree(store, oid, `${path}/`, out);
    else if (mode !== "160000") out[path] = store.get(oid)!.data.toString("utf8");
  }
  return out;
}

async function refMap(dir: string, patterns: string[]): Promise<Map<string, { oid: string; upstream: string }>> {
  const out = new Map<string, { oid: string; upstream: string }>();
  const text = await gitOut(dir, ["for-each-ref", "--format=%(refname)%00%(objectname)%00%(upstream:short)", ...patterns]);
  for (const line of lines(text)) {
    const [ref, oid, upstream] = line.split("\0");
    out.set(ref, { oid, upstream });
  }
  return out;
}

async function readIndex(dir: string, blob: (oid: string) => string): Promise<{ index: Files; conflicts: Record<string, ConflictSnap> }> {
  const index: Files = {};
  const conflicts: Record<string, ConflictSnap> = {};
  for (const entry of (await gitOut(dir, ["ls-files", "-s", "-z"])).split("\0")) {
    if (!entry) continue;
    const tab = entry.indexOf("\t");
    const [, oid, stage] = entry.slice(0, tab).split(" ");
    const path = entry.slice(tab + 1);
    if (stage === "0") {
      index[path] = blob(oid);
      continue;
    }
    const c = (conflicts[path] ??= { base: null, ours: null, theirs: null });
    if (stage === "1") c.base = blob(oid);
    else if (stage === "2") c.ours = blob(oid);
    else c.theirs = blob(oid);
  }
  return { index: sortKeys(index), conflicts: sortKeys(conflicts) };
}

export async function fromRealGit(layout: RealGitLayout): Promise<Snapshot> {
  const { repo } = layout;
  const commonDir = join(repo, ".git");

  // All objects from the local repository and the remotes, in one cat-file call each.
  const store = await readObjectStore(repo);
  for (const dir of Object.values(layout.remotes)) {
    for (const [oid, obj] of await readObjectStore(dir)) if (!store.has(oid)) store.set(oid, obj);
  }
  const blob = (oid: string) => store.get(oid)!.data.toString("utf8");

  const refs = await refMap(repo, ["refs/heads", "refs/remotes"]);
  const remoteRefs: Record<string, Record<string, string>> = {};
  for (const [name, dir] of Object.entries(layout.remotes)) {
    remoteRefs[name] = {};
    for (const [ref, { oid }] of await refMap(dir, ["refs/heads"])) remoteRefs[name][ref.slice("refs/heads/".length)] = oid;
  }

  const worktreeList = listWorktrees(repo).map((wt) => {
    const headText = readFileSync(join(wt.gitDir, "HEAD"), "utf8").trim();
    const headRef = headText.startsWith("ref: ") ? headText.slice(5) : null;
    return { ...wt, headRef, headOid: headRef ? null : headText, reflog: readReflog(join(wt.gitDir, "logs", "HEAD")).oids };
  });
  const branchReflogOids: Record<string, string[]> = {};
  for (const name of BRANCH_REFLOGS) {
    if (refs.has(`refs/heads/${name}`)) branchReflogOids[name] = readReflog(join(commonDir, "logs", "refs", "heads", name)).oids;
  }

  // Commits reachable from refs, detached HEADs and the reflogs we snapshot.
  const starts = [
    ...[...refs.entries()].filter(([ref]) => !ref.endsWith("/HEAD")).map(([, r]) => r.oid),
    ...Object.values(remoteRefs).flatMap((r) => Object.values(r)),
    ...worktreeList.flatMap((wt) => [...(wt.headOid ? [wt.headOid] : []), ...wt.reflog]),
    ...Object.values(branchReflogOids).flat(),
  ];
  const raw: RawCommit[] = [];
  const seen = new Set<string>();
  const stack = [...starts];
  while (stack.length) {
    const oid = stack.pop()!;
    if (seen.has(oid)) continue;
    seen.add(oid);
    const obj = store.get(oid);
    if (!obj || obj.type !== "commit") throw new Error(`commit ${oid} missing from the object store`);
    const c = parseCommit(obj);
    // A pull merge message names the remote's URL ("Merge branch 'main' of /tmp/.../origin").
    // The engine has no URLs, so the remote's name stands in for it.
    let message = c.message;
    for (const [name, dir] of Object.entries(layout.remotes)) {
      message = message.split(dir).join(name).split(dir.replace(/\.git$/, "")).join(name);
    }
    raw.push({ id: oid, parents: c.parents, author: c.author, message, tree: flattenTree(store, c.tree) });
    stack.push(...c.parents);
  }
  const { commits, label, text } = labelCommits(raw);

  const branches: Record<string, string> = {};
  const upstreams: Record<string, string> = {};
  const remoteTracking: Record<string, string> = {};
  for (const [ref, { oid, upstream }] of refs) {
    if (ref.startsWith("refs/heads/")) {
      const name = ref.slice("refs/heads/".length);
      branches[name] = label(oid);
      if (upstream) upstreams[name] = upstream;
    } else if (!ref.endsWith("/HEAD")) {
      remoteTracking[ref.slice("refs/remotes/".length)] = label(oid);
    }
  }

  const worktrees: Record<string, WorktreeSnap> = {};
  for (const wt of worktreeList) {
    const { index, conflicts } = await readIndex(wt.dir, blob);
    worktrees[wt.actor] = {
      head: wt.headRef ? wt.headRef.replace(/^refs\/heads\//, "") : `detached:${label(wt.headOid!)}`,
      index,
      working: mapValues(readWorkingFiles(wt.dir), text),
      conflicts,
      inProgress: inProgressKind(wt.gitDir),
      headReflog: wt.reflog.map(label),
    };
  }

  const stash = readReflog(join(commonDir, "logs", "refs", "stash")).subjects.reverse().map(normaliseStash);

  return {
    branches: sortKeys(branches),
    remoteTracking: sortKeys(remoteTracking),
    remotes: mapValues(remoteRefs, (r) => mapValues(r, label)),
    upstreams: sortKeys(upstreams),
    commits,
    worktrees: sortKeys(worktrees),
    stash,
    branchReflogs: mapValues(branchReflogOids, (oids) => oids.map(label)),
  };
}
