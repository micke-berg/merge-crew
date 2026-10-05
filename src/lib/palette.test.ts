import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACTOR_COLORS, TEXT_PAIRS, TOKENS, contrast, cssVariables, lighten } from "@/lib/palette";

describe("palette", () => {
  it.each(TEXT_PAIRS.map((p) => [p.what, p] as const))("%s reaches WCAG AA", (_, p) => {
    expect(contrast(p.text, p.on)).toBeGreaterThanOrEqual(p.min);
  });

  it("maps every CSS variable to a Tailwind colour token, and nothing else", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const mapped = new Set([...css.matchAll(/--color-([a-z0-9-]+):\s*var\(--mc-([a-z0-9-]+)\)/g)].map((m) => {
      expect(m[1]).toBe(m[2]);
      return m[2];
    }));
    const defined = new Set(Object.keys(cssVariables()).map((k) => k.slice("--mc-".length)));
    expect([...mapped].sort()).toEqual([...defined].sort());
  });

  it("writes every robot colour from one place", () => {
    const vars = cssVariables();
    for (const [id, c] of Object.entries(ACTOR_COLORS)) {
      expect(vars[`--mc-robot-${id}`]).toBe(c.line);
      expect(vars[`--mc-robot-${id}-deep`]).toBe(c.deep);
    }
    expect(TOKENS.focus).toBe(ACTOR_COLORS.player.line);
  });

  it("lightens a colour towards white", () => {
    expect(lighten("#000000", 0.5)).toBe("#808080");
    expect(lighten("#FFFFFF")).toBe("#FFFFFF");
  });
});
