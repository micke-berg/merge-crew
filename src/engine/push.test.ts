// git push is split into parse, plan, check and apply. These tests cover each part on its own;
// tests/oracle/scenarios/remotes.ts compares whole pushes with real git.

import { describe, expect, it } from "vitest";
import { Ctx, Fail } from "./context";
import { cloneState, deepEqual } from "./objects";
import { applyPush, checkPush, parsePush, planPush } from "./commands/remote";
import { Repo, failOnEngineErrors } from "./test-helpers";
import type { RepoState } from "./types";

failOnEngineErrors();

const ctxFor = (state: RepoState) => new Ctx(cloneState(state), "player", state.clock + 1);

/** main pushed to origin, then one more local commit. */
function pushedRepo(): { r: Repo; first: string; second: string } {
  const r = new Repo();
  const first = r.commitFile("a.txt", "1\n", "First");
  r.git("push -u origin main");
  const second = r.commitFile("a.txt", "2\n", "Second");
  return { r, first, second };
}

describe("parsePush", () => {
  it("reads the remote, refspecs and flags", () => {
    expect(parsePush(["-u", "origin", "main", "+HEAD:fix"])).toEqual({
      remote: "origin",
      specs: ["main", "+HEAD:fix"],
      setUpstream: true,
      force: false,
      lease: undefined,
      delete: false,
    });
    expect(parsePush(["--force-with-lease"]).lease).toBe("");
    expect(parsePush(["--force-with-lease=main:abc", "-f", "-d"])).toMatchObject({ lease: "main:abc", force: true, delete: true });
    expect(parsePush([]).remote).toBeUndefined();
  });

  it("refuses options Merge Crew does not support", () => {
    expect(() => parsePush(["--tags"])).toThrow(Fail);
  });
});

describe("planPush", () => {
  it("pushes the current branch to its upstream by default", () => {
    const { r, second } = pushedRepo();
    const updates = planPush(ctxFor(r.state), parsePush([]), "origin");
    expect(updates).toEqual([{ src: "main", srcBranch: "main", oid: second, dst: "main", force: false }]);
  });

  it("understands src:dst, a leading +, HEAD and deletes", () => {
    const { r, first, second } = pushedRepo();
    const ctx = ctxFor(r.state);
    expect(planPush(ctx, parsePush(["origin", "+HEAD~1:refs/heads/old", "HEAD"]), "origin")).toEqual([
      { src: "HEAD~1", srcBranch: null, oid: first, dst: "old", force: true },
      { src: "HEAD", srcBranch: "main", oid: second, dst: "main", force: false },
    ]);
    expect(planPush(ctx, parsePush(["origin", ":gone"]), "origin")).toEqual([
      { src: null, srcBranch: null, oid: null, dst: "gone", force: false },
    ]);
    expect(planPush(ctx, parsePush(["-d", "origin", "x"]), "origin")[0]).toMatchObject({ oid: null, dst: "x" });
  });

  it("fails on a source that does not exist, without an upstream, or for a commit without a destination", () => {
    const { r } = pushedRepo();
    expect(() => planPush(ctxFor(r.state), parsePush(["origin", "nope"]), "origin")).toThrow(/src refspec nope does not match any/);
    expect(() => planPush(ctxFor(r.state), parsePush(["origin", "HEAD~1"]), "origin")).toThrow(/not a full refname/);
    r.git("switch -c side");
    expect(() => planPush(ctxFor(r.state), parsePush([]), "origin")).toThrow(/has no upstream branch/);
  });
});

describe("checkPush", () => {
  it("accepts a fast-forward and reports it, without changing anything", () => {
    const { r, first, second } = pushedRepo();
    const ctx = ctxFor(r.state);
    const before = cloneState(ctx.state);
    const req = parsePush([]);
    const check = checkPush(ctx, req, "origin", planPush(ctx, req, "origin"));
    expect(check.rejected).toBeNull();
    expect(check.accepted).toEqual([{ u: expect.objectContaining({ oid: second }), old: first, forced: false }]);
    expect(check.lines.map((l) => l.text)).toEqual(["To origin", `   ${first.slice(0, 7)}..${second.slice(0, 7)}  main -> main`]);
    expect(deepEqual(ctx.state, before)).toBe(true);
  });

  it("rejects a non-fast-forward unless forced", () => {
    const { r } = pushedRepo();
    r.git("push");
    r.git("reset --hard HEAD~1");
    r.commitFile("b.txt", "b\n", "Other");
    const ctx = ctxFor(r.state);
    const plain = parsePush([]);
    expect(checkPush(ctx, plain, "origin", planPush(ctx, plain, "origin")).rejected).toBe("non-fast-forward");
    const forced = parsePush(["-f"]);
    expect(checkPush(ctx, forced, "origin", planPush(ctx, forced, "origin")).accepted[0].forced).toBe(true);
  });

  it("rejects a lease whose expected value is stale", () => {
    const { r, first } = pushedRepo();
    const ctx = ctxFor(r.state);
    const req = parsePush([`--force-with-lease=main:${r.head()}`]);
    const check = checkPush(ctx, req, "origin", planPush(ctx, req, "origin"));
    expect(check.rejected).toBe("stale");
    expect(check.lines.some((l) => l.text.includes("(stale info)"))).toBe(true);
    expect(first).not.toBe(r.head());
  });

  it("says everything is up to date when nothing would change", () => {
    const { r } = pushedRepo();
    r.git("push");
    const ctx = ctxFor(r.state);
    const req = parsePush([]);
    expect(checkPush(ctx, req, "origin", planPush(ctx, req, "origin")).lines.map((l) => l.text)).toEqual(["Everything up-to-date"]);
  });
});

describe("applyPush", () => {
  it("moves the remote branch and the remote-tracking ref, and sets upstreams when asked", () => {
    const { r, second } = pushedRepo();
    r.git("switch -c side");
    const ctx = ctxFor(r.state);
    const req = parsePush(["-u", "origin", "side", "main"]);
    const check = checkPush(ctx, req, "origin", planPush(ctx, req, "origin"));
    applyPush(ctx, "origin", check.accepted, req.setUpstream);
    expect(ctx.state.remotes.origin.branches).toEqual({ main: second, side: second });
    expect(ctx.state.remoteTracking).toEqual({ "origin/main": second, "origin/side": second });
    expect(ctx.state.upstreams.side).toEqual({ remote: "origin", branch: "side" });
    expect(ctx.events.map((e) => e.type)).toEqual([
      "remote-updated",
      "remote-tracking-updated",
      "remote-updated",
      "remote-tracking-updated",
    ]);
  });
});
