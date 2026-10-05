// Turns an ordered EngineEvent[] into a schedule: when (in ms from the start of playback) each
// thing on the map should animate. Pure, so it can be tested without a browser.

import type { ActorId, EngineEvent, Oid, RepoState } from "@/engine/types";

export type BranchMotion = "extend" | "snap";

export type Schedule = {
  /** Total playback length. */
  duration: number;
  /** New stops pop in. */
  appear: Map<Oid, number>;
  /** Stops crack, then drop to the ghost lane. */
  lose: Map<Oid, number>;
  /** Stops lift back from the ghost lane. */
  recover: Map<Oid, number>;
  /** A robot moves (hops) to its new stop. */
  actorMove: Map<ActorId, number>;
  /** A robot shows a conflict warning. */
  conflict: Map<ActorId, number>;
  /** A branch label moves to its new stop. */
  branch: Map<string, { at: number; motion: BranchMotion }>;
  /** A remote ref moves; forced pushes shake the map. */
  remote: Map<string, { at: number; forced: boolean }>;
  /** Times at which the whole map shakes. */
  shakes: number[];
  /** Times at which a robot appears in a new worktree. */
  actorAppear: Map<ActorId, number>;
};

/** How long each kind of event holds the stage before the next one starts. */
export const STEP_MS: Record<EngineEvent["type"], number> = {
  "commit-created": 650,
  "branch-created": 350,
  "branch-moved": 550,
  "branch-deleted": 300,
  "head-moved": 450,
  "worktree-added": 450,
  "files-changed": 0,
  conflict: 700,
  "conflict-resolved": 300,
  operation: 0,
  "remote-updated": 600,
  "remote-tracking-updated": 250,
  "stash-pushed": 350,
  "stash-removed": 350,
  "commits-lost": 1100,
  "commits-recovered": 900,
};

/** The forced-push shake is longer than a normal remote update. */
export const FORCED_EXTRA_MS = 500;

const forwardReasons = new Set(["commit", "fast-forward", "merge", "pull", "cherry-pick", "revert", "branch"]);

/**
 * `after` is the state the events lead to. It tells us which robot has which branch checked out,
 * so a reset of a branch also moves the robot standing on it.
 */
export function buildSchedule(events: EngineEvent[], after: RepoState): Schedule {
  const s: Schedule = {
    duration: 0, appear: new Map(), lose: new Map(), recover: new Map(), actorMove: new Map(),
    conflict: new Map(), branch: new Map(), remote: new Map(), shakes: [], actorAppear: new Map(),
  };
  const holders = new Map<string, ActorId[]>();
  for (const [actor, wt] of Object.entries(after.worktrees)) {
    if (wt.head.kind !== "branch") continue;
    holders.set(wt.head.name, [...(holders.get(wt.head.name) ?? []), actor]);
  }

  let t = 0;
  let lastCommit: { oid: Oid; at: number } | null = null;
  const moveActor = (actor: ActorId, at: number) => s.actorMove.set(actor, at);

  for (const e of events) {
    let at = t;
    let step = STEP_MS[e.type];
    switch (e.type) {
      case "commit-created":
        s.appear.set(e.oid, at);
        moveActor(e.actor, at);
        lastCommit = { oid: e.oid, at };
        break;
      case "branch-created":
        s.branch.set(e.name, { at, motion: "extend" });
        break;
      case "branch-moved": {
        // The move that records a fresh commit happens together with the commit itself.
        if (lastCommit && lastCommit.oid === e.to) {
          at = lastCommit.at;
          step = 0;
        }
        s.branch.set(e.name, { at, motion: forwardReasons.has(e.reason) ? "extend" : "snap" });
        for (const actor of holders.get(e.name) ?? []) moveActor(actor, at);
        break;
      }
      case "head-moved":
        moveActor(e.actor, at);
        break;
      case "worktree-added":
        s.actorAppear.set(e.actor, at);
        break;
      case "conflict":
        s.conflict.set(e.actor, at);
        break;
      case "remote-updated": {
        const ref = `${e.remote}/${e.branch}`;
        s.remote.set(ref, { at, forced: e.forced });
        if (e.forced) {
          s.shakes.push(at);
          step += FORCED_EXTRA_MS;
        }
        break;
      }
      case "remote-tracking-updated": {
        const prev = s.remote.get(e.ref);
        // Usually follows the remote update for the same ref: animate them together.
        if (prev && t - prev.at <= STEP_MS["remote-updated"] + FORCED_EXTRA_MS) step = 0;
        else s.remote.set(e.ref, { at, forced: false });
        break;
      }
      case "commits-lost":
        for (const oid of e.oids) s.lose.set(oid, at);
        break;
      case "commits-recovered":
        for (const oid of e.oids) s.recover.set(oid, at);
        break;
      default:
        break;
    }
    t += step;
  }
  s.duration = t;
  return s;
}

/** The moment a stop should start moving to its new position: after its crack, or when lifted. */
export const CRACK_MS = 450;

export function stopMoveAt(s: Schedule, oid: Oid): number {
  const lost = s.lose.get(oid);
  if (lost !== undefined) return lost + CRACK_MS;
  return s.recover.get(oid) ?? 0;
}
