import { describe, expect, it } from "vitest";
import { getLevel, levels } from "@/levels";
import { entries } from "./entries";

describe("commands reference", () => {
  it("has unique slugs that work as anchors", () => {
    const slugs = entries.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("links only to levels that exist", () => {
    for (const e of entries) {
      if (e.practice) expect(getLevel(e.practice), `${e.slug} practice ${e.practice}`).toBeDefined();
      if (e.usedIn) expect(getLevel(e.usedIn), `${e.slug} usedIn ${e.usedIn}`).toBeDefined();
    }
  });

  it("agrees with the level files about which level uses a practice level's tool", () => {
    for (const e of entries.filter((x) => x.practice && x.usedIn)) {
      expect(getLevel(e.practice!)?.usedIn, e.slug).toBe(e.usedIn);
    }
  });

  it("covers every practice level", () => {
    const practised = new Set(entries.map((e) => e.practice));
    for (const level of levels.filter((l) => l.usedIn)) {
      expect(practised.has(level.id), `${level.id} is the practice of some entry`).toBe(true);
    }
  });

  it("fills in every text field and keeps examples to one to three lines", () => {
    for (const e of entries) {
      for (const text of [e.command, e.title, e.what, e.when, e.risk]) expect(text.trim().length, e.slug).toBeGreaterThan(0);
      expect(e.examples.length, e.slug).toBeGreaterThanOrEqual(1);
      expect(e.examples.length, e.slug).toBeLessThanOrEqual(3);
    }
  });
});
