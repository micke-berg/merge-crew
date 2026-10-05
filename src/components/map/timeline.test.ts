import { describe, expect, it } from "vitest";
import { crew, fakeOid, forcePush, linear } from "./fixtures";
import { ACTOR_COLORS, PAPER, contrast } from "./palette";
import { CRACK_MS, buildSchedule, stopMoveAt } from "./timeline";

describe("buildSchedule", () => {
  it("plays a commit and its branch move together, and hops the robot", () => {
    const scene = linear.scenes[0];
    const s = buildSchedule(scene.events, scene.after);
    const oid = scene.after.branches.main;
    expect(s.appear.get(oid)).toBe(0);
    expect(s.branch.get("main")).toEqual({ at: 0, motion: "extend" });
    expect(s.actorMove.get("player")).toBe(0);
    expect(s.duration).toBeGreaterThan(0);
  });

  it("plays events in order, one after the other", () => {
    const scene = crew.scenes[0];
    const s = buildSchedule(scene.events, scene.after);
    expect(s.actorMove.get("blaze")!).toBeLessThan(s.actorMove.get("drift")!);
  });

  it("shakes on a forced push, snaps the reset branch and cracks lost commits before they drop", () => {
    const scene = forcePush.scenes[0];
    const s = buildSchedule(scene.events, scene.after);
    expect(s.shakes).toEqual([0]);
    expect(s.remote.get("origin/main")).toEqual({ at: 0, forced: true });
    expect(s.branch.get("main")!.motion).toBe("snap");
    // main is checked out by the player, so the player moves with the reset.
    expect(s.actorMove.get("player")).toBe(s.branch.get("main")!.at);
    const lost = fakeOid("commit:k1");
    expect(stopMoveAt(s, lost)).toBe(s.lose.get(lost)! + CRACK_MS);
    expect(s.lose.get(lost)!).toBeGreaterThan(s.branch.get("main")!.at);
  });

  it("lifts recovered commits", () => {
    const scene = forcePush.scenes[1];
    const s = buildSchedule(scene.events, scene.after);
    expect(s.recover.has(fakeOid("commit:k2"))).toBe(true);
    expect(s.shakes).toEqual([]);
  });

  it("warns a robot on conflict", () => {
    const scene = crew.scenes[1];
    expect(buildSchedule(scene.events, scene.after).conflict.get("blaze")).toBe(0);
  });
});

describe("palette", () => {
  it("keeps every robot line readable on the paper and every label readable in white", () => {
    for (const [id, c] of Object.entries(ACTOR_COLORS)) {
      expect(contrast(c.line, PAPER), `${id} line`).toBeGreaterThanOrEqual(3);
      expect(contrast("#FFFFFF", c.deep), `${id} label`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("fakeOid", () => {
  it("makes stable 40-hex ids", () => {
    expect(fakeOid("x")).toMatch(/^[0-9a-f]{40}$/);
    expect(fakeOid("x")).toBe(fakeOid("x"));
    expect(fakeOid("x")).not.toBe(fakeOid("y"));
  });
});
