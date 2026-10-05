import { describe, expect, it } from "vitest";
import { forcePush, linear } from "./fixtures";
import { layoutRepo } from "./layout";
import { glide, moveAt, travelMs } from "./motion";
import { buildSchedule, stopMoveAt } from "./timeline";

describe("moveAt", () => {
  it("keeps everything still on the first layout", () => {
    const scene = forcePush.scenes[0];
    const layout = layoutRepo(scene.after);
    const schedule = buildSchedule(scene.events, scene.after);
    const lanes = new Map(layout.lanes.map((l) => [l.id, l]));
    expect(layout.stops.every((s) => moveAt(schedule, null, lanes, s) === 0)).toBe(true);
  });

  it("drops lost stops when their event plays", () => {
    const scene = forcePush.scenes[0];
    const before = layoutRepo(scene.before);
    const layout = layoutRepo(scene.after);
    const schedule = buildSchedule(scene.events, scene.after);
    const lanes = new Map(layout.lanes.map((l) => [l.id, l]));
    const prevStops = new Map(before.stops.map((s) => [s.oid, s]));
    const lost = layout.stops.filter((s) => s.lost);
    expect(lost.length).toBeGreaterThan(0);
    for (const s of lost) expect(moveAt(schedule, prevStops, lanes, s)).toBe(stopMoveAt(schedule, s.oid));
  });

  it("leaves stops that did not change alone", () => {
    const scene = linear.scenes[0];
    const before = layoutRepo(scene.before);
    const layout = layoutRepo(scene.after);
    const schedule = buildSchedule(scene.events, scene.after);
    const lanes = new Map(layout.lanes.map((l) => [l.id, l]));
    const prevStops = new Map(before.stops.map((s) => [s.oid, s]));
    const old = layout.stops.filter((s) => prevStops.has(s.oid));
    expect(old.every((s) => moveAt(schedule, prevStops, lanes, s) === 0)).toBe(true);
  });
});

describe("travel and glide", () => {
  it("clamps travel time", () => {
    expect(travelMs(0)).toBe(450);
    expect(travelMs(10_000)).toBe(1100);
  });

  it("jumps with reduced motion and delays in seconds otherwise", () => {
    expect(glide(500, "snap", true)).toEqual({ duration: 0 });
    expect(glide(500, "snap")).toMatchObject({ type: "spring", delay: 0.5 });
  });
});
