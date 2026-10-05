// Deterministic hint evals: no network, no real model. They run with the normal test suite.
// The live evals (real model plus a model grader) are in hints.eval.ts, run by `npm run eval:hints`.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { levels } from "@/levels";
import { hintLevel } from "@/hints/data";
import { buildHintPrompt } from "@/hints/prompt";
import { getHint } from "@/hints/server";
import { replyModel } from "@/hints/test-helpers";
import { MAX_RECENT_COMMANDS } from "@/hints/types";
import { parseHintRequest } from "@/hints/validate";
import { recentCommands } from "@/components/game/hintRequest";
import { CASES } from "./cases";
import { CRITERIA, grade, parseGrade } from "./grader";
import { caseRequest, playCase } from "./materialise";

const goalCount = (id: string) => hintLevel(id)?.level.goals.length;

describe("stuck cases", () => {
  it("cover every level with two or three cases, one of each kind where it fits", () => {
    for (const level of levels) {
      const mine = CASES.filter((c) => c.levelId === level.id);
      expect(mine.length, level.id).toBeGreaterThanOrEqual(2);
      expect(mine.length, level.id).toBeLessThanOrEqual(3);
    }
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
  });

  it.each(CASES.map((c) => [c.id, c] as const))("%s plays out to a stuck player turn", (_id, c) => {
    const game = playCase(c);
    expect(game.phase).toBe("play");
    expect(game.goals.every(Boolean)).toBe(false);
    // Every typed command reaches the terminal (none is silently dropped).
    expect(game.commands).toBe(c.commands.length);
  });

  it.each(CASES.map((c) => [c.id, c] as const))("%s builds a request the route accepts, and a prompt", (_id, c) => {
    const req = caseRequest(c, 2);
    const parsed = parseHintRequest(JSON.parse(JSON.stringify(req)), goalCount);
    expect(parsed).toEqual({ ok: true, request: req });
    expect(req.recentCommands.map((r) => r.command)).toEqual(c.commands.slice(-MAX_RECENT_COMMANDS));

    const data = hintLevel(c.levelId)!;
    const { prompt } = buildHintPrompt({
      context: data.context,
      goals: data.level.goals.map((g) => g.description),
      done: req.goals,
      recentCommands: req.recentCommands,
      statusSummary: req.statusSummary,
      hintNumber: req.hintNumber,
    });
    const current = data.level.goals[req.goals.findIndex((g) => !g)].description;
    expect(prompt).toContain(`<current_goal>\n${current}\n</current_goal>`);
    for (const cmd of c.commands) expect(prompt).toContain(cmd.replace(/</g, "‹").replace(/>/g, "›"));
  });

  it.each(CASES.map((c) => [c.id, c] as const))("%s: a leaking model answer falls back to the scripted hint", async (_id, c) => {
    const data = hintLevel(c.levelId)!;
    const shown = new Set(data.level.suggestions);
    const secret = data.solution.find((argv) => !shown.has(argv.join(" ")));
    const leak = secret ? `Just type ${secret.join(" ")}.` : "Then git push --force.";
    for (const n of [1, 3]) {
      const out = await getHint(caseRequest(c, n), data, { model: replyModel(leak), env: {} });
      expect(out.source).toBe("scripted");
      expect(out.reason === "leak-solution" || out.reason === "leak-force").toBe(true);
      expect(out.text).toBe(data.scripted[Math.min(n, 3) - 1]);
    }
  });

  it.each(CASES.map((c) => [c.id, c] as const))("%s: without credentials the scripted hint comes back cleanly", async (_id, c) => {
    const data = hintLevel(c.levelId)!;
    const out = await getHint(caseRequest(c, 1), data, { env: {} });
    expect(out).toEqual({ text: data.scripted[0], source: "scripted", reason: "no-credentials" });
  });
});

describe("recent commands", () => {
  it("keeps the player's own last commands, oldest first, with whether git accepted them", () => {
    const c = CASES.find((x) => x.id === "act1-04-push-rejected")!;
    const game = playCase({ ...c, commands: [...Array.from({ length: 6 }, () => "git status"), ...c.commands] });
    const recent = recentCommands(game);
    expect(recent).toHaveLength(MAX_RECENT_COMMANDS);
    expect(recent.at(-1)).toMatchObject({ command: "git push", ok: false });
    expect(recent.at(-1)!.outputFirstLines).toMatch(/rejected/);
    // Robot commands from the opening scene are not the player's.
    expect(recent.some((r) => r.command.includes("tidy:main"))).toBe(false);
  });
});

describe("model grader (offline parts)", () => {
  it("reads a JSON verdict, and fails everything on an unreadable one", () => {
    const ok = parseGrade('Here: {"towardNextIdea": true, "noAnswer": true, "short": true, "voice": false, "notes": "a bit stiff"}');
    expect(ok).toEqual({
      pass: { towardNextIdea: true, noAnswer: true, short: true, voice: false },
      notes: "a bit stiff",
      overall: false,
    });
    const bad = parseGrade("I think it is fine.");
    expect(bad.overall).toBe(false);
    expect(Object.values(bad.pass).every((p) => p === false)).toBe(true);
  });

  it("grades with the rubric through a (mock) model", async () => {
    const model = replyModel('{"towardNextIdea": true, "noAnswer": true, "short": true, "voice": true, "notes": "fine"}');
    const g = await grade({ context: "ctx", goal: "goal", situation: "sit", expect: "push", hint: "Time to share it." }, model);
    expect(g.overall).toBe(true);
    const sent = JSON.stringify(model.doGenerateCalls[0].prompt);
    for (const k of Object.keys(CRITERIA)) expect(sent).toContain(k);
    expect(sent).toContain("Time to share it.");
  });

  it("labels.example.json uses known cases and the documented fields", () => {
    const example = JSON.parse(readFileSync(new URL("./labels.example.json", import.meta.url), "utf8")) as {
      labels: { caseId: string; hintNumber: number; hint: string; label: string }[];
    };
    for (const l of example.labels) {
      expect(CASES.some((c) => c.id === l.caseId)).toBe(true);
      expect(["good", "bad"]).toContain(l.label);
      expect(l.hint.length).toBeGreaterThan(0);
    }
  });
});
