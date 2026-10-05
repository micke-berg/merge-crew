// Live hint evals: `npm run eval:hints`. Calls the real hint model through the AI Gateway for every
// stuck case, runs the deterministic checks on the model's raw answer, grades it with a rubric-based
// model grader, and writes the results to evals/hints/results/ (ignored by git).
//
// Needs AI Gateway credentials (AI_GATEWAY_API_KEY, or VERCEL_OIDC_TOKEN from `vercel env pull`),
// read from the environment or .env.local. Without them every test is skipped and nothing is sent.
//
// The grader is not calibrated against human judgement. If evals/hints/labels.json exists (format:
// labels.example.json), the grader also grades each labelled hint and the agreement is reported.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hintLevel } from "@/hints/data";
import { vetHint } from "@/hints/leak";
import { HINT_MODEL, aiAvailability, getHint } from "@/hints/server";
import { CASES } from "./cases";
import { GRADER_MODEL, grade, type Grade } from "./grader";
import { caseRequest } from "./materialise";

for (const file of [".env.local", ".env"]) {
  try {
    if (existsSync(file)) process.loadEnvFile(file);
  } catch {
    // An unreadable env file is the same as none.
  }
}

const live = aiAvailability(process.env, false).ok && (process.env.HINTS_AI ?? "").toLowerCase() !== "off";
const HINT_NUMBERS = [1, 3];
const DIR = join("evals", "hints", "results");

type Row = {
  caseId: string;
  levelId: string;
  kind: string;
  hintNumber: number;
  /** What the player would have seen. */
  shown: { text: string; source: string; reason?: string };
  /** The model's own answer before the checks, if it gave one. */
  raw?: string;
  model?: string;
  deterministic: { ok: boolean; reason?: string };
  grade?: Grade;
  error?: string;
};

function situation(req: ReturnType<typeof caseRequest>): string {
  const cmds = req.recentCommands.map((c) => `$ ${c.command} (${c.ok ? "accepted" : "refused"})${c.outputFirstLines ? `\n  ${c.outputFirstLines.replace(/\n/g, "\n  ")}` : ""}`);
  return [`Status: ${req.statusSummary}`, cmds.length ? cmds.join("\n") : "(no commands yet)"].join("\n");
}

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

describe("live hint evals", () => {
  if (!live) {
    it.skip("skipped: no AI Gateway credentials (set AI_GATEWAY_API_KEY or pull VERCEL_OIDC_TOKEN), or HINTS_AI=off", () => {});
    return;
  }

  it("hints for every stuck case, checked and graded", async () => {
    const jobs = CASES.flatMap((c) => HINT_NUMBERS.map((n) => ({ c, n })));
    const rows = await inBatches(jobs, 4, async ({ c, n }): Promise<Row> => {
      const data = hintLevel(c.levelId)!;
      const req = caseRequest(c, n);
      const out = await getHint(req, data);
      const row: Row = {
        caseId: c.id,
        levelId: c.levelId,
        kind: c.kind,
        hintNumber: n,
        shown: { text: out.text, source: out.source, ...(out.reason ? { reason: out.reason } : {}) },
        raw: out.raw,
        model: out.model,
        deterministic: { ok: false, reason: out.reason },
      };
      if (out.raw === undefined) {
        row.error = `no model answer (${out.reason})`;
        return row;
      }
      const verdict = vetHint(out.raw, data.solution, data.level.suggestions);
      row.deterministic = verdict.ok ? { ok: true } : { ok: false, reason: verdict.reason };
      try {
        row.grade = await grade({
          context: data.context,
          goal: data.level.goals[req.goals.findIndex((g) => !g)]?.description ?? "All goals met",
          situation: situation(req),
          expect: c.expect,
          hint: out.raw,
        });
      } catch (e) {
        row.error = `grader failed: ${e instanceof Error ? e.message : String(e)}`;
      }
      return row;
    });

    const agreement = await checkLabels();
    const graded = rows.filter((r) => r.grade);
    const rate = (f: (r: Row) => boolean, of: Row[]) => (of.length ? Math.round((of.filter(f).length / of.length) * 100) : 0);
    const summary = {
      hintModel: HINT_MODEL,
      graderModel: GRADER_MODEL,
      graderCalibrated: false,
      runs: rows.length,
      modelAnswered: rows.filter((r) => r.raw !== undefined).length,
      passedDeterministicChecksPct: rate((r) => r.deterministic.ok, rows),
      graderOverallPassPct: rate((r) => !!r.grade?.overall, graded),
      graderPassPctByCriterion: Object.fromEntries(
        (["towardNextIdea", "noAnswer", "short", "voice"] as const).map((k) => [k, rate((r) => !!r.grade?.pass[k], graded)]),
      ),
      shownSource: { ai: rows.filter((r) => r.shown.source === "ai").length, scripted: rows.filter((r) => r.shown.source === "scripted").length },
      fallbackReasons: rows.reduce<Record<string, number>>((acc, r) => {
        if (r.shown.reason) acc[r.shown.reason] = (acc[r.shown.reason] ?? 0) + 1;
        return acc;
      }, {}),
      labelAgreement: agreement,
    };

    mkdirSync(DIR, { recursive: true });
    const file = join(DIR, `hints-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify({ summary, rows }, null, 2));
    process.stdout.write(`\nHint eval summary (written to ${file}):\n${JSON.stringify(summary, null, 2)}\n`);
    expect(rows).toHaveLength(jobs.length);
  });
});

type Label = { caseId: string; hintNumber: number; hint: string; label: "good" | "bad" };

/** Grade every human-labelled hint and report how often the grader agrees. null when there are no labels. */
async function checkLabels(): Promise<{ labels: number; agreePct: number; disagreements: { caseId: string; hint: string; human: string; grader: string }[] } | null> {
  const path = join("evals", "hints", "labels.json");
  if (!existsSync(path)) return null;
  const labels = (JSON.parse(readFileSync(path, "utf8")) as { labels: Label[] }).labels;
  const disagreements: { caseId: string; hint: string; human: string; grader: string }[] = [];
  let agree = 0;
  for (const l of labels) {
    const c = CASES.find((x) => x.id === l.caseId);
    if (!c) continue;
    const data = hintLevel(c.levelId)!;
    const req = caseRequest(c, l.hintNumber);
    const g = await grade({
      context: data.context,
      goal: data.level.goals[req.goals.findIndex((x) => !x)]?.description ?? "All goals met",
      situation: situation(req),
      expect: c.expect,
      hint: l.hint,
    });
    const graderLabel = g.overall ? "good" : "bad";
    if (graderLabel === l.label) agree++;
    else disagreements.push({ caseId: l.caseId, hint: l.hint, human: l.label, grader: graderLabel });
  }
  return { labels: labels.length, agreePct: labels.length ? Math.round((agree / labels.length) * 100) : 0, disagreements };
}
