// Live hint evals: `npm run eval:hints`. Calls the real hint model through the AI Gateway for hints
// 1, 2 and 3 of every stuck case in order (each request carries the hints shown before it), runs the
// deterministic checks on the model's raw answer, grades it with a rubric-based model grader, and
// writes the results to evals/hints/results/ (ignored by git).
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
import { namedCommands, normalise, vetHint } from "@/hints/leak";
import { HINT_MODEL, LAST_HINT_FROM, LAST_HINT_MODEL, aiAvailability, getHint } from "@/hints/server";
import { CASES, expectedCommands, namesExpectedCommand, type StuckCase } from "./cases";
import { CRITERIA, GRADER_MODEL, grade, type Criterion, type Grade } from "./grader";
import { caseRequest } from "./materialise";

for (const file of [".env.local", ".env"]) {
  try {
    if (existsSync(file)) process.loadEnvFile(file);
  } catch {
    // An unreadable env file is the same as none.
  }
}

const live = aiAvailability(process.env, false).ok && (process.env.HINTS_AI ?? "").toLowerCase() !== "off";
/** Every case asks for these hints in order, as a player pressing "Ask Tidy" again and again would. */
const HINT_NUMBERS = [1, 2, 3];
const DIR = join("evals", "hints", "results");

type Row = {
  caseId: string;
  levelId: string;
  kind: string;
  hintNumber: number;
  /** The hints the request carried: what the game had shown before this one, oldest first. */
  previousHints: string[];
  /** What the player would have seen. */
  shown: { text: string; source: string; reason?: string };
  /** The model's own answer before the checks, if it gave one. */
  raw?: string;
  /** The model asked for this hint, and the one that answered (they differ after a Gateway fallback). */
  requestedModel: string;
  model?: string;
  /** Wall time of the hint call, in milliseconds (with HINT_EVAL_BATCH cases running at once). */
  latencyMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  /** The Gateway's cost for the call, in US dollars, when reported. */
  costUsd?: number;
  /** The `git <subcommand>`s the model's raw answer names (see namedCommands). */
  namedCommands: string[];
  /** The case's expected commands for hint 3 (cases.ts), and whether the raw answer names one. */
  expectedCommands: readonly string[];
  namesExpectedCommand?: boolean;
  deterministic: { ok: boolean; reason?: string };
  /** The shown hint is word for word one the player already saw (case and spacing ignored). */
  repeatsPrevious: boolean;
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

const same = (a: string, b: string) => normalise(a) === normalise(b);

/**
 * Compare models without editing code (AI Gateway model strings, for this run only): HINT_EVAL_MODEL
 * overrides the model for hints 1 and 2 (HINT_MODEL), HINT_EVAL_LAST_MODEL the model from hint 3 on
 * (LAST_HINT_MODEL). HINT_EVAL_BATCH sets how many cases run at once (default 4; use 1 on
 * rate-limited plans). The hints of one case always run in order, each request carrying the hints
 * shown before it.
 */
const evalModel = process.env.HINT_EVAL_MODEL || HINT_MODEL;
const evalLastModel = process.env.HINT_EVAL_LAST_MODEL || LAST_HINT_MODEL;
const batchSize = Math.max(1, Number(process.env.HINT_EVAL_BATCH) || 4);

async function hintRow(c: StuckCase, n: number, shownBefore: string[]): Promise<Row> {
  const data = hintLevel(c.levelId)!;
  const req = caseRequest(c, n, shownBefore);
  const started = performance.now();
  const out = await getHint(req, data, {
    ...(evalModel === HINT_MODEL ? {} : { hintModel: evalModel }),
    ...(evalLastModel === LAST_HINT_MODEL ? {} : { lastHintModel: evalLastModel }),
  });
  const latencyMs = Math.round(performance.now() - started);
  const previousHints = req.previousHints ?? [];
  const named = out.raw === undefined ? [] : namedCommands(out.raw);
  const row: Row = {
    caseId: c.id,
    levelId: c.levelId,
    kind: c.kind,
    hintNumber: n,
    previousHints,
    shown: { text: out.text, source: out.source, ...(out.reason ? { reason: out.reason } : {}) },
    raw: out.raw,
    requestedModel: n >= LAST_HINT_FROM ? evalLastModel : evalModel,
    model: out.model,
    latencyMs,
    ...(out.usage ? { usage: out.usage } : {}),
    ...(out.costUsd === undefined ? {} : { costUsd: out.costUsd }),
    namedCommands: named,
    expectedCommands: expectedCommands(c),
    ...(out.raw === undefined ? {} : { namesExpectedCommand: namesExpectedCommand(named, c) }),
    deterministic: { ok: false, reason: out.reason },
    repeatsPrevious: previousHints.some((p) => same(p, out.text)),
  };
  if (out.raw === undefined) {
    row.error = `no model answer (${out.reason})`;
    return row;
  }
  const verdict = vetHint(out.raw, data.solution, n, previousHints);
  row.deterministic = verdict.ok ? { ok: true } : { ok: false, reason: verdict.reason };
  try {
    row.grade = await grade({
      context: data.context,
      goal: data.level.goals[req.goals.findIndex((g) => !g)]?.description ?? "All goals met",
      situation: situation(req),
      expect: c.expect,
      hint: out.raw,
      hintNumber: n,
      previousHints,
    });
  } catch (e) {
    row.error = `grader failed: ${e instanceof Error ? e.message : String(e)}`;
  }
  return row;
}

/** One case's hint ladder: hint 1, then 2, then 3, each request carrying the hints shown before it. */
async function ladder(c: StuckCase): Promise<Row[]> {
  const rows: Row[] = [];
  const shown: string[] = [];
  for (const n of HINT_NUMBERS) {
    const row = await hintRow(c, n, [...shown]);
    rows.push(row);
    shown.push(row.shown.text);
  }
  return rows;
}

const rate = (f: (r: Row) => boolean, of: Row[]) => (of.length ? Math.round((of.filter(f).length / of.length) * 100) : 0);

function reasons(rows: Row[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, r) => {
    if (r.shown.reason) acc[r.shown.reason] = (acc[r.shown.reason] ?? 0) + 1;
    return acc;
  }, {});
}

/** Pass rates for a set of rows; moreSpecificThanPrevious counts only rows where it was graded. */
function stats(rows: Row[]) {
  const graded = rows.filter((r) => r.grade);
  return {
    runs: rows.length,
    modelAnswered: rows.filter((r) => r.raw !== undefined).length,
    shownSource: { ai: rows.filter((r) => r.shown.source === "ai").length, scripted: rows.filter((r) => r.shown.source === "scripted").length },
    fallbackReasons: reasons(rows),
    passedDeterministicChecksPct: rate((r) => r.deterministic.ok, rows),
    repeatsPrevious: rows.filter((r) => r.repeatsPrevious).length,
    graded: graded.length,
    graderOverallPassPct: rate((r) => !!r.grade?.overall, graded),
    graderPassPctByCriterion: Object.fromEntries(
      (Object.keys(CRITERIA) as Criterion[]).flatMap((k) => {
        const applies = graded.filter((r) => r.grade!.pass[k] !== undefined);
        return applies.length ? [[k, rate((r) => r.grade!.pass[k] === true, applies)]] : [];
      }),
    ),
  };
}

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

/**
 * The hint-3 view: does the last rung name the right command for the situation, and is it shown?
 * Percentages of model answers unless named otherwise; the expected-command rates count only cases
 * with an expectedCommand.
 */
function lastHintStats(rows: Row[]) {
  const answered = rows.filter((r) => r.raw !== undefined);
  const withExpected = answered.filter((r) => r.namesExpectedCommand !== undefined);
  const graded = rows.filter((r) => r.grade);
  const tokens = answered.flatMap((r) => (r.usage?.outputTokens === undefined ? [] : [r.usage.outputTokens]));
  const costs = answered.flatMap((r) => (r.costUsd === undefined ? [] : [r.costUsd]));
  const latencies = rows.map((r) => r.latencyMs).sort((a, b) => a - b);
  const leaks = rows.filter((r) => r.shown.reason?.startsWith("leak-")).length;
  return {
    runs: rows.length,
    shownAi: rows.filter((r) => r.shown.source === "ai").length,
    shownScripted: rows.filter((r) => r.shown.source === "scripted").length,
    fallbackReasons: reasons(rows),
    leakRejections: leaks,
    namesCommandPct: rate((r) => r.namedCommands.length > 0, answered),
    casesWithExpectedCommand: withExpected.length,
    namesRightCommand: withExpected.filter((r) => r.namesExpectedCommand).length,
    namesRightCommandPct: rate((r) => !!r.namesExpectedCommand, withExpected),
    /** What the player gets: the model's hint was shown and names the right command. */
    shownAiAndRightCommand: withExpected.filter((r) => r.namesExpectedCommand && r.shown.source === "ai").length,
    wrongCommandCases: withExpected
      .filter((r) => !r.namesExpectedCommand && r.namedCommands.length > 0)
      .map((r) => `${r.caseId}: ${r.namedCommands.join(", ")} (expected ${r.expectedCommands.join(" or ")})`),
    noCommandCases: withExpected.filter((r) => r.namedCommands.length === 0).map((r) => r.caseId),
    graded: graded.length,
    graderOverallPassPct: rate((r) => !!r.grade?.overall, graded),
    graderNoAnswerPassPct: rate((r) => r.grade!.pass.noAnswer === true, graded),
    avgOutputTokens: average(tokens),
    avgCostUsd: average(costs),
    medianLatencyMs: latencies[Math.floor(latencies.length / 2)],
    maxLatencyMs: latencies.at(-1),
  };
}

describe("live hint evals", () => {
  if (!live) {
    it.skip("skipped: no AI Gateway credentials (set AI_GATEWAY_API_KEY or pull VERCEL_OIDC_TOKEN), or HINTS_AI=off", () => {});
    return;
  }

  it("hint ladders for every stuck case, checked and graded", async () => {
    const startedAt = Date.now();
    const rows = (await inBatches(CASES, batchSize, ladder)).flat();
    const wallTimeSec = Math.round((Date.now() - startedAt) / 1000);

    const agreement = await checkLabels();
    const hint3 = rows.filter((r) => r.hintNumber === 3);
    const summary = {
      hintModel: evalModel,
      lastHintModel: evalLastModel,
      lastHintFrom: LAST_HINT_FROM,
      /** The grader judges noAnswer by hint number since the hint-3 model change; earlier runs are not comparable on it. */
      graderLadderAware: true,
      batchSize,
      /** The ladders only, before the label check. */
      wallTimeSec,
      graderModel: GRADER_MODEL,
      graderCalibrated: false,
      hintNumbers: HINT_NUMBERS,
      ...stats(rows),
      /** Deterministic: hint 3 shown word for word the same as hint 1 or 2 of its case. */
      hint3IdenticalToEarlier: hint3.filter((r) => r.repeatsPrevious).map((r) => r.caseId),
      hint3: lastHintStats(hint3),
      byHintNumber: Object.fromEntries(HINT_NUMBERS.map((n) => [n, stats(rows.filter((r) => r.hintNumber === n))])),
      labelAgreement: agreement,
    };

    mkdirSync(DIR, { recursive: true });
    const file = join(DIR, `hints-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify({ summary, rows }, null, 2));
    process.stdout.write(`\nHint eval summary (written to ${file}):\n${JSON.stringify(summary, null, 2)}\n`);
    expect(rows).toHaveLength(CASES.length * HINT_NUMBERS.length);
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
      hintNumber: l.hintNumber,
    });
    const graderLabel = g.overall ? "good" : "bad";
    if (graderLabel === l.label) agree++;
    else disagreements.push({ caseId: l.caseId, hint: l.hint, human: l.label, grader: graderLabel });
  }
  return { labels: labels.length, agreePct: labels.length ? Math.round((agree / labels.length) * 100) : 0, disagreements };
}
