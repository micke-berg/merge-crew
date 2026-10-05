import { describe, expect, it } from "vitest";
import { getLevel } from "@/levels";
import { MAX_HINTS_PER_RUN } from "@/hints/types";
import {
  canAskHint,
  hintBubble,
  hintsLeft,
  initLevelModel,
  levelReducer,
  nextHintKey,
  shownBubble,
  type LevelAction,
  type LevelModel,
  type PointStep,
} from "./game";

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

describe("the screen tour", () => {
  const steps = firstSave.intro.filter((s): s is PointStep => s.kind === "point");
  const playing = () => play(initLevelModel(firstSave), { type: "begin" }, { type: "skip" });

  it("the first level carries the tour: map, main, files, job bar, command box", () => {
    expect(steps.map((s) => s.target)).toEqual(["map", "map", "files", "jobbar", "terminal"]);
  });

  it("only starts during the player turn", () => {
    const brief = initLevelModel(firstSave);
    expect(levelReducer(brief, { type: "tour", steps })).toBe(brief);
    const m = levelReducer(playing(), { type: "tour", steps });
    expect(m.tour).toEqual({ steps, at: 0 });
    expect(shownBubble(m)?.point?.target).toBe("map");
  });

  it("continue walks the tour and leaves the game untouched", () => {
    const start = playing();
    let m = levelReducer(start, { type: "tour", steps });
    for (let i = 1; i < steps.length; i++) {
      m = levelReducer(m, { type: "continue" });
      expect(m.tour?.at).toBe(i);
    }
    m = levelReducer(m, { type: "continue" });
    expect(m.tour).toBeNull();
    expect(m.game).toBe(start.game);
    expect(shownBubble(m)).toBeNull();
  });

  it("commands wait while the tour shows, and skip ends it", () => {
    const m = levelReducer(playing(), { type: "tour", steps });
    expect(levelReducer(m, { type: "command", line: "git status" })).toBe(m);
    expect(levelReducer(m, { type: "skip" }).tour).toBeNull();
  });

  it("restart ends the tour", () => {
    const m = levelReducer(levelReducer(playing(), { type: "tour", steps }), { type: "restart", level: firstSave });
    expect(m.tour).toBeNull();
    expect(m.game.phase).toBe("brief");
  });
});

describe("Tidy's hints", () => {
  const inPlay = () => runScene(play(initLevelModel(firstSave), { type: "begin" }));

  it("can be asked for only during the player turn", () => {
    const brief = initLevelModel(firstSave);
    expect(canAskHint(brief)).toBe(false);
    expect(levelReducer(brief, { type: "hint-ask" })).toBe(brief);
    const m = inPlay();
    expect(m.game.phase).toBe("play");
    expect(canAskHint(m)).toBe(true);
  });

  it("thinks, then shows the answer for its own request as Tidy's line", () => {
    let m = inPlay();
    const key = nextHintKey(m);
    m = levelReducer(m, { type: "hint-ask" });
    expect(m.hintsUsed).toBe(1);
    expect(hintBubble(m)).toMatchObject({ actor: "tidy", mood: "thinking" });
    // A second ask while thinking does nothing.
    expect(levelReducer(m, { type: "hint-ask" })).toBe(m);
    // An answer for another request is dropped.
    expect(levelReducer(m, { type: "hint-answer", key: "other", text: "x" })).toBe(m);
    m = levelReducer(m, { type: "hint-answer", key, text: "Look at git status." });
    expect(hintBubble(m)).toMatchObject({ actor: "tidy", text: "Look at git status." });
    // The scene line is unaffected: hints sit beside the player turn.
    expect(shownBubble(m)).toBeNull();
    expect(levelReducer(m, { type: "hint-dismiss" }).hint).toBeNull();
  });

  it("keeps the hint up while the player types", () => {
    let m = inPlay();
    const key = nextHintKey(m);
    m = play(m, { type: "hint-ask" }, { type: "hint-answer", key, text: "Stage it first." }, { type: "command", line: "git status" });
    expect(m.hint).toMatchObject({ status: "shown" });
    expect(m.game.commands).toBe(1);
  });

  it(`allows ${MAX_HINTS_PER_RUN} per run, refunds failed requests, and restart starts a new run`, () => {
    let m = inPlay();
    for (let i = 0; i < MAX_HINTS_PER_RUN; i++) {
      const key = nextHintKey(m);
      m = play(m, { type: "hint-ask" }, { type: "hint-answer", key, text: `hint ${i}` });
    }
    expect(hintsLeft(m)).toBe(0);
    expect(canAskHint(m)).toBe(false);
    expect(levelReducer(m, { type: "hint-ask" })).toBe(m);

    let r = runScene(play(m, { type: "restart", level: firstSave }, { type: "begin" }));
    expect(hintsLeft(r)).toBe(MAX_HINTS_PER_RUN);
    const key = nextHintKey(r);
    r = play(r, { type: "hint-ask" }, { type: "hint-answer", key, text: "offline", refund: true });
    expect(hintsLeft(r)).toBe(MAX_HINTS_PER_RUN);
  });

  it("an answer that arrives after a restart is dropped", () => {
    let m = inPlay();
    const key = nextHintKey(m);
    m = play(m, { type: "hint-ask" }, { type: "restart", level: firstSave });
    expect(levelReducer(m, { type: "hint-answer", key, text: "late" })).toBe(m);
  });

  it("the screen tour puts the hint away", () => {
    const steps = firstSave.intro.filter((s): s is PointStep => s.kind === "point");
    let m = inPlay();
    const key = nextHintKey(m);
    m = play(m, { type: "hint-ask" }, { type: "hint-answer", key, text: "A hint." }, { type: "tour", steps });
    expect(m.hint).toBeNull();
    expect(canAskHint(m)).toBe(false);
  });
});
