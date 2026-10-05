import { describe, expect, it } from "vitest";
import { crew, forcePush, linear } from "./fixtures";
import { resolveFocus } from "./focus";
import { layoutRepo } from "./layout";

describe("resolveFocus", () => {
  it("highlights nothing without a focus", () => {
    expect(resolveFocus(layoutRepo(linear.state), null)).toEqual({ stops: [], lanes: [], lost: false });
  });

  it("matches commits by their exact message", () => {
    const layout = layoutRepo(linear.state);
    const f = resolveFocus(layout, { commits: ["Add README", "No such commit"] });
    expect(f.stops).toEqual([layout.stops.find((s) => s.message === "Add README")!.oid]);
  });

  it("matches branch lines by name", () => {
    const f = resolveFocus(layoutRepo(crew.state), { branches: ["main"] });
    expect(f.lanes.map((l) => l.name)).toEqual(["main"]);
  });

  it("falls back to every branch line except main when no named branch exists", () => {
    const layout = layoutRepo(crew.state);
    const f = resolveFocus(layout, { branches: ["a-name-the-player-did-not-pick"] });
    expect(f.lanes.length).toBeGreaterThan(0);
    expect(f.lanes.every((l) => l.kind === "branch")).toBe(true);
  });

  it("outlines the lost band only when commits are lost", () => {
    expect(resolveFocus(layoutRepo(linear.state), { lost: true }).lost).toBe(false);
    expect(resolveFocus(layoutRepo(forcePush.scenes[0].after), { lost: true }).lost).toBe(true);
  });
});
