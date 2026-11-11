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

  it("ignores groups on another row", () => {
    expect(nameSide(group, [{ lo: 140, hi: 170, y: 150 }]).side).toBe("right");
  });

  it("goes above when groups block both sides, and stays right when there is no room above", () => {
    const both = [{ lo: 140, hi: 170, y: 50 }, { lo: 30, hi: 60, y: 50 }];
    expect(nameSide(group, both).side).toBe("above");
    expect(nameSide(group, both, [], 0).side).toBe("right");
  });
});

describe("nameSide with labels in the way", () => {
  // Two names stacked beside a group at y 200: they cover y 141 to 179.
  const group = { x: 100, y: 200, left: -15, right: 15, reach: 60, count: 2 };
  const tagOnTheLeft = { lo: 30, hi: 78, top: 150, bottom: 168 };
  const groupOnTheRight = { lo: 150, hi: 180, y: 200 };

  it("moves left when a tag covers the right", () => {
    expect(nameSide(group, [], [{ lo: 125, hi: 170, top: 150, bottom: 168 }]).side).toBe("left");
  });

  it("ignores a tag above or below the names", () => {
    expect(nameSide(group, [], [{ lo: 125, hi: 170, top: 100, bottom: 118 }]).side).toBe("right");
    expect(nameSide(group, [], [{ lo: 125, hi: 170, top: 185, bottom: 203 }]).side).toBe("right");
  });

  const wide = { lo: 121, hi: 181, top: 150, bottom: 168 };
  const narrow = { lo: 70, hi: 79, top: 150, bottom: 168 };

  it("goes above the robots when both sides are blocked", () => {
    expect(nameSide(group, [], [wide, narrow])).toEqual({ side: "above", x: 100 });
    expect(nameSide(group, [groupOnTheRight], [tagOnTheLeft]).side).toBe("above");
  });

  it("picks the side with less in the way when above is taken or off the map", () => {
    const overhead = { lo: 90, hi: 110, top: 100, bottom: 118 };
    expect(nameSide(group, [], [wide, narrow, overhead]).side).toBe("left");
    expect(nameSide(group, [], [wide, narrow], 150).side).toBe("left");
    // Robots standing on the row above are in the way too.
    expect(nameSide(group, [{ lo: 85, hi: 115, y: 104 }], [wide, narrow]).side).toBe("left");
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
