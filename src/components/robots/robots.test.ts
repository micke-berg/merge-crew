import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Mood } from "@/engine/types";
import { levels } from "@/levels";
import { moodState, restAfter } from "./moods";
import { levelSheets } from "./preload";
import { ANCHOR, CROP, ROBOTS, SHEET_SIZES, STATES, sheetUrl, portraitUrl } from "./sheets.generated";

const MOODS: Mood[] = ["idle", "talking", "thinking", "happy", "celebrate", "scared", "guilty", "surprised"];
const publicFile = (url: string) => path.join(process.cwd(), "public", url);

describe("robot sprites", () => {
  it("has a web sheet for every robot, state and size", () => {
    for (const size of ["map", "portrait"] as const) {
      for (const r of ROBOTS) for (const s of STATES) expect(fs.existsSync(publicFile(sheetUrl(size, r, s))), `${size} ${r}-${s}`).toBe(true);
    }
    for (const r of ROBOTS) expect(fs.existsSync(publicFile(portraitUrl(r)))).toBe(true);
  });

  it("keeps the ground anchor inside the cropped frame", () => {
    expect(ANCHOR.x).toBeGreaterThan(0);
    expect(ANCHOR.x).toBeLessThan(CROP.width);
    expect(ANCHOR.y).toBeGreaterThan(CROP.height * 0.9);
    expect(ANCHOR.y).toBeLessThan(CROP.height);
    expect(SHEET_SIZES.map.frameHeight).toBeLessThan(SHEET_SIZES.portrait.frameHeight);
  });

  it("maps every mood of every robot to a sheet", () => {
    for (const r of ROBOTS) for (const m of MOODS) expect(STATES).toContain(moodState(r, m));
    expect(moodState("blaze", "celebrate")).toBe("signature");
    expect(moodState("drift", "celebrate")).toBe("happy");
  });

  it("settles one-shots: guilty holds, the rest return to idle", () => {
    expect(restAfter("guilty")).toBe("hold");
    expect(restAfter("happy")).toBe("idle");
    expect(restAfter("talk")).toBe("talk");
  });

  it("preloads only sheets that exist, a handful per level", () => {
    for (const level of levels) {
      const sheets = levelSheets(level);
      for (const s of sheets) expect(fs.existsSync(publicFile(sheetUrl(s.size, s.robot, s.state)))).toBe(true);
      expect(sheets.length).toBeLessThanOrEqual(level.crew.length * 12);
    }
  });
});
