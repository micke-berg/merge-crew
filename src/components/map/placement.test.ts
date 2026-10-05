import { describe, expect, it } from "vitest";
import type { HeadMarker } from "./layout";
import { HUDDLE, cardBox, huddle, nameSide } from "./placement";

const head = (actor: string, oid: string, slot: number): HeadMarker => ({
  actor, oid, col: 0, row: 0, branch: "main", detached: false, slot, slots: 0, conflicted: false,
});

describe("huddle", () => {
  it("centres a group on its stop and overlaps neighbours a little", () => {
    const h = huddle([head("a", "x", 0), head("b", "x", 1)], () => 40);
    expect(h.dx(head("a", "x", 0))).toBeCloseTo(-20 * HUDDLE);
    expect(h.dx(head("b", "x", 1))).toBeCloseTo(20 * HUDDLE);
    expect(h.right("x")).toBeCloseTo(20 * HUDDLE + 20);
    expect(h.left("x")).toBeCloseTo(-20 * HUDDLE - 20);
  });

  it("leaves a lone marker on its stop", () => {
    const h = huddle([head("a", "x", 0)], () => 30);
    expect(h.dx(head("a", "x", 0))).toBe(0);
    expect(h.right("x")).toBe(15);
    expect(h.right("unknown")).toBe(0);
  });
});

describe("nameSide", () => {
  const group = { x: 100, y: 50, left: -15, right: 15, reach: 60 };

  it("puts names on the right by default", () => {
    expect(nameSide(group, [])).toEqual({ side: "right", x: 121 });
  });

  it("moves them left when a group on the same height is in the way", () => {
    expect(nameSide(group, [{ lo: 140, hi: 170, y: 60 }])).toEqual({ side: "left", x: 79 });
  });

  it("ignores groups on another row, and stays right when both sides are blocked", () => {
    expect(nameSide(group, [{ lo: 140, hi: 170, y: 150 }]).side).toBe("right");
    expect(nameSide(group, [{ lo: 140, hi: 170, y: 50 }, { lo: 20, hi: 60, y: 50 }]).side).toBe("right");
  });
});

describe("cardBox", () => {
  it("shortens long messages and keeps the card inside the map", () => {
    const box = cardBox(990, 100, "x".repeat(60), 1000, 6);
    expect(box.text).toHaveLength(44);
    expect(box.text.endsWith("…")).toBe(true);
    expect(box.x + box.w).toBeLessThanOrEqual(992);
    expect(cardBox(0, 100, "short", 1000, 6).x).toBe(8);
  });
});
