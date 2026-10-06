// One hint, end to end: decide whether the model may be asked, ask it, vet its answer, and fall back
// to the level's scripted hints whenever anything is off. Server-only.

import "server-only";
import { generateText, type LanguageModel, type TelemetryOptions } from "ai";
import type { HintLevel } from "./data";
import { FIRST_COMMAND_HINT, vetHint, type HintVerdict } from "./leak";
import { recordSafetyCheck } from "./telemetry";
import { buildHintPrompt } from "./prompt";
import type { FallbackReason, HintRequest, HintResponse } from "./types";

/**
 * The model for hints 1 and 2, as a plain AI Gateway model string. Chosen by `npm run eval:hints` on
 * 2026-10-05: against Claude Haiku 4.5 on the same 27 cases, Gemini 2.5 Flash-Lite gave away the
 * answer less often (0 of 53 graded answers vs 5 of 54), was rejected as too long less often (4 vs 9),
 * was faster and costs about a tenth. Measure any change the same way.
 */
export const HINT_MODEL = "google/gemini-2.5-flash-lite";
/**
 * The model from hint 3 on, where the hint names the git command for the player's situation.
 * `npm run eval:hints` on 2026-10-06, hint 3 of 27 cases, hints 1-2 on HINT_MODEL, ladder-aware grader,
 * right command = the case's expectedCommand (24 cases):
 *   gemini-2.5-flash-lite: right 10/23, shown AI 22/27, grader 85%, 0 leaks, median 534 ms, $0.00010
 *   gemini-2.5-flash (no thinking): right 17/24, shown AI 25/27, grader 100%, 0 leaks, median 739 ms, $0.00032
 *   claude-haiku-4.5: right 19/24, shown AI 26/27, grader 89%, 1 leak, median 985 ms, $0.00112
 *   claude-sonnet-5: right 21/24, shown AI 26/27, grader 100%, 0 leaks, median 1383 ms, $0.00286
 * Cost is the Gateway's per hint. Measure any change the same way (HINT_EVAL_LAST_MODEL).
 */
export const LAST_HINT_MODEL = "google/gemini-2.5-flash";
/** The first hint that uses LAST_HINT_MODEL: the first one allowed to name a git command. */
export const LAST_HINT_FROM = FIRST_COMMAND_HINT;
/**
 * Models the Gateway tries if a hint's own model fails, in order. A hint never lists its own model
 * as its fallback (see fallbackModelsFor). Each needs paid Gateway credits; the code check still
 * applies to their answers.
 */
export const FALLBACK_MODELS: readonly string[] = ["anthropic/claude-haiku-4.5"];
export const MAX_OUTPUT_TOKENS = 120;
export const TEMPERATURE = 0.2;
/** The player is waiting with Tidy "thinking": past this, the scripted hint is better than waiting. */
export const HINT_TIMEOUT_MS = 6000;

type Env = Record<string, string | undefined>;

/**
 * May the model be asked at all? `HINTS_AI=off` switches it off. Credentials: an AI Gateway key, a
 * Vercel OIDC token in the environment (from `vercel env pull`), or, on Vercel, the OIDC token Vercel
 * adds to each request.
 */
export function aiAvailability(env: Env, requestHasOidc: boolean): { ok: true } | { ok: false; reason: "disabled" | "no-credentials" } {
  if ((env.HINTS_AI ?? "").trim().toLowerCase() === "off") return { ok: false, reason: "disabled" };
  if (env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN || requestHasOidc) return { ok: true };
  return { ok: false, reason: "no-credentials" };
}

/** The scripted hint for this request: the first for hint 1, the second for hint 2, the third after that. */
export function scriptedHint(data: HintLevel, hintNumber: number): string {
  return data.scripted[Math.min(Math.max(hintNumber, 1), data.scripted.length) - 1];
}

function scripted(data: HintLevel, hintNumber: number, reason: FallbackReason): HintResponse {
  return { text: scriptedHint(data, hintNumber), source: "scripted", reason };
}

/**
 * The model that actually answered. When the Gateway falls back to another model, the AI SDK still
 * reports the one that was asked for; the Gateway's routing metadata names the one that served it.
 */
export function servedModel(providerMetadata: unknown): string | undefined {
  const routing = (providerMetadata as { gateway?: { routing?: { canonicalSlug?: unknown } } } | undefined)?.gateway?.routing;
  return typeof routing?.canonicalSlug === "string" ? routing.canonicalSlug : undefined;
}

/** The Gateway model string for hint `hintNumber` of a run. */
export function modelForHint(hintNumber: number): string {
  return hintNumber >= LAST_HINT_FROM ? LAST_HINT_MODEL : HINT_MODEL;
}

/**
 * The Gateway fallback list for a hint whose model is `primary`: FALLBACK_MODELS without the primary.
 * If that leaves nothing (the primary is the only fallback), the other hint model stands in, so a
 * failing model always has somewhere to go.
 */
export function fallbackModelsFor(primary: string): string[] {
  const rest = FALLBACK_MODELS.filter((m) => m !== primary);
  if (rest.length) return [...new Set(rest)];
  return [HINT_MODEL, LAST_HINT_MODEL].filter((m, i, all) => m !== primary && all.indexOf(m) === i);
}

function modelId(model: LanguageModel): string {
  return typeof model === "string" ? model : model.modelId;
}

/** Spend reported by the Gateway for this call, in US dollars, when it says. */
export function gatewayCost(providerMetadata: unknown): number | undefined {
  const cost = (providerMetadata as { gateway?: { cost?: unknown } } | undefined)?.gateway?.cost;
  const n = typeof cost === "string" ? Number(cost) : typeof cost === "number" ? cost : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export type HintDeps = {
  env?: Env;
  /** The request carried Vercel's OIDC header. */
  requestHasOidc?: boolean;
  /** A model for every hint instead of the Gateway strings (tests pass a mock). */
  model?: LanguageModel;
  /** Instead of HINT_MODEL for hints 1 and 2 (evals compare models with it). */
  hintModel?: LanguageModel;
  /** Instead of LAST_HINT_MODEL from hint 3 on (evals compare models with it). */
  lastHintModel?: LanguageModel;
  /** AI SDK telemetry settings for the model call. Defaults to off. */
  telemetry?: TelemetryOptions;
  timeoutMs?: number;
};

/**
 * What happened, for tracing and evals: the response plus the raw model text when there was one, the
 * model that answered, its token usage and the Gateway's cost for the call when reported.
 */
export type HintOutcome = HintResponse & {
  raw?: string;
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  costUsd?: number;
};

export async function getHint(request: HintRequest, data: HintLevel, deps: HintDeps = {}): Promise<HintOutcome> {
  const env = deps.env ?? process.env;
  const available = aiAvailability(env, deps.requestHasOidc ?? false);
  const injected = deps.model ?? (request.hintNumber >= LAST_HINT_FROM ? deps.lastHintModel : deps.hintModel);
  // An injected model needs no Gateway credentials, but HINTS_AI=off still wins.
  if (!available.ok && !(injected && available.reason === "no-credentials")) {
    return scripted(data, request.hintNumber, available.reason);
  }

  const { instructions, prompt } = buildHintPrompt({
    context: data.context,
    goals: data.level.goals.map((g) => g.description),
    done: request.goals,
    recentCommands: request.recentCommands,
    statusSummary: request.statusSummary,
    hintNumber: request.hintNumber,
    previousHints: request.previousHints ?? [],
  });

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deps.timeoutMs ?? HINT_TIMEOUT_MS);

  const primary: LanguageModel = injected ?? modelForHint(request.hintNumber);

  let raw: string;

  let finishReason: string | undefined;
  let model: string | undefined;
  let usage: HintOutcome["usage"];
  let costUsd: number | undefined;
  try {
    const result = await generateText({
      model: primary,
      instructions,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
      // The Gateway's model fallback is the retry; a second attempt would only make the player wait.
      maxRetries: 0,
      abortSignal: controller.signal,
      providerOptions: {
        gateway: { models: fallbackModelsFor(modelId(primary)), tags: ["merge-crew-hint", request.levelId] },
        // No thinking: it would spend the 120 output tokens before the hint (Gemini 2.5 Flash returned
        // cut-off fragments in the evals). Other providers ignore this key.
        google: { thinkingConfig: { thinkingBudget: 0 } },
      },
      runtimeContext: { levelId: request.levelId, hintNumber: request.hintNumber },
      telemetry: deps.telemetry ?? { isEnabled: false },
    });
    raw = result.text;
    finishReason = result.finishReason;
    model = servedModel(result.providerMetadata) ?? result.response?.modelId;
    usage = { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens };
    costUsd = gatewayCost(result.providerMetadata);
  } catch {
    return scripted(data, request.hintNumber, timedOut ? "timeout" : "model-error");
  } finally {
    clearTimeout(timer);
  }

  // An answer that hit the output limit stops mid-sentence ("…a new commit that undoes"); never show it.
  const verdict: HintVerdict =
    finishReason === "length" ? { ok: false, reason: "cut-off" } : vetHint(raw, data.solution, request.hintNumber, request.previousHints ?? []);
  recordSafetyCheck(raw, verdict);
  const call = { raw, model, usage, ...(costUsd === undefined ? {} : { costUsd }) };
  if (!verdict.ok) return { ...scripted(data, request.hintNumber, verdict.reason), ...call };
  return { text: verdict.text, source: "ai", ...call };
}
