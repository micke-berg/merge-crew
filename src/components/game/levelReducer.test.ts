import { describe, expect, it } from "vitest";
import { getLevel } from "@/levels";
import { initLevelModel, levelReducer, type LevelAction, type LevelModel } from "./game";

const blazeLevel = getLevel("act2-01")!;
const firstSave = getLevel("act1-01")!;

function play(m: LevelModel, ...actions: LevelAction[]): LevelModel {
  return actions.reduce(levelReducer, m);
}

/** Dispatch "step" (the timer) and "continue" (the click) until the scene is over. */
function runScene(m: LevelModel): LevelModel {
  let model = m;
  for (let i = 0; i < 500 && (model.game.phase === "intro" || model.game.phase === "outro"); i++) {
    model = levelReducer(model, { type: model.wait.kind === "click" ? "continue" : "step" });
  }
  return model;
}

describe("level reducer", () => {
  it("starts on the brief with nothing to wait for", () => {
    const m = initLevelModel(blazeLevel);
    expect(m.game.phase).toBe("brief");
    expect(m.wait).toEqual({ kind: "none" });
    expect(m.run).toBe(0);
  });

  it("begin starts the intro once and is ignored after that", () => {
    const m = play(initLevelModel(blazeLevel), { type: "begin" });
    expect(m.game.phase).toBe("intro");
    expect(levelReducer(m, { type: "begin" })).toBe(m);
  });

  it("step plays the next scene step and stops at a spoken line", () => {
    let m = play(initLevelModel(blazeLevel), { type: "begin" });
    for (let i = 0; i < 50 && m.wait.kind !== "click"; i++) m = levelReducer(m, { type: "step" });
    expect(m.wait).toEqual({ kind: "click" });
    expect(m.game.bubble).not.toBeNull();
    // The timer does not skip a line the player has not read yet.
    expect(levelReducer(m, { type: "step" })).toBe(m);
  });

  it("continue moves past a spoken line and is ignored when nothing waits for a click", () => {
    let m = play(initLevelModel(blazeLevel), { type: "begin" });
    expect(m.wait.kind).not.toBe("click");
    expect(levelReducer(m, { type: "continue" })).toBe(m);
    for (let i = 0; i < 50 && m.wait.kind !== "click"; i++) m = levelReducer(m, { type: "step" });
    const after = levelReducer(m, { type: "continue" });
    expect(after.game.cursor).toBe(m.game.cursor + 1);
  });

  it("plays a scripted git step and waits for its animation", () => {
    let m = play(initLevelModel(blazeLevel), { type: "begin" });
    let sawAnimation = false;
    for (let i = 0; i < 500 && m.game.phase === "intro"; i++) {
      m = levelReducer(m, { type: m.wait.kind === "click" ? "continue" : "step" });
      if (m.wait.kind === "animate") {
        sawAnimation = true;
        expect(m.wait.events.length).toBeGreaterThan(0);
        expect(m.game.events).toBe(m.wait.events);
      }
    }
    expect(sawAnimation).toBe(true);
    expect(m.game.phase).toBe("play");
  });

  it("skip ends the scene at once and is ignored outside a scene", () => {
    const m = play(initLevelModel(blazeLevel), { type: "begin" }, { type: "skip" });
    expect(m.game.phase).toBe("play");
    expect(m.wait).toEqual({ kind: "none" });
    expect(levelReducer(m, { type: "skip" })).toBe(m);
  });

  it("command runs during the player turn and is ignored before it", () => {
    const brief = initLevelModel(blazeLevel);
    expect(levelReducer(brief, { type: "command", line: "git status" })).toBe(brief);

    const m = play(brief, { type: "begin" }, { type: "skip" }, { type: "command", line: "git status" });
    expect(m.game.commands).toBe(1);
    expect(m.game.log.some((l) => l.kind === "command" && l.text === "git status")).toBe(true);
    expect(m.wait).toEqual({ kind: "none" });
  });

  it("edit writes a working file during the player turn and is ignored before it", () => {
    const brief = initLevelModel(firstSave);
    expect(levelReducer(brief, { type: "edit", path: "list.txt", content: "x\n" })).toBe(brief);

    const m = play(brief, { type: "begin" }, { type: "skip" }, { type: "edit", path: "list.txt", content: "x\n" });
    expect(m.game.repo.worktrees.player.workingTree["list.txt"]).toBe("x\n");
    expect(m.game.commands).toBe(0);
  });

  it("restart builds the level again and bumps the run counter", () => {
    const played = play(initLevelModel(blazeLevel), { type: "begin" }, { type: "skip" }, { type: "command", line: "git status" });
    const m = levelReducer(played, { type: "restart", level: blazeLevel });
    expect(m.game.phase).toBe("brief");
    expect(m.game.commands).toBe(0);
    expect(m.wait).toEqual({ kind: "none" });
    expect(m.run).toBe(played.run + 1);
  });

  it("a winning command first plays its animation, then the closing scene, then the level is won", () => {
    let m = play(
      initLevelModel(firstSave),
      { type: "begin" },
      { type: "skip" },
      { type: "command", line: "git add list.txt" },
    );
    expect(m.game.phase).toBe("play");
    expect(m.wait).toEqual({ kind: "none" });

    m = levelReducer(m, { type: "command", line: 'git commit -m "Add batteries to the list"' });
    expect(m.game.phase).toBe("outro");
    expect(m.game.cursor).toBe(0);
    expect(m.game.bubble).toBeNull();
    expect(m.wait.kind).toBe("animate");
    if (m.wait.kind === "animate") expect(m.wait.events).toBe(m.game.events);

    // Nothing of the closing scene shows until the animation timer fires.
    m = levelReducer(m, { type: "step" });
    expect(m.game.bubble?.actor).toBe("tidy");
    expect(m.wait).toEqual({ kind: "click" });

    m = runScene(m);
    expect(m.game.phase).toBe("won");
  });
});
