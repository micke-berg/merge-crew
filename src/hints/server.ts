// One hint, end to end: decide whether the model may be asked, ask it, vet its answer, and fall back
// to the level's scripted hints whenever anything is off. Server-only.

import "server-only";
import { generateText, type LanguageModel, type TelemetryOptions } from "ai";
import type { HintLevel } from "./data";
import { vetHint } from "./leak";
import { recordSafetyCheck } from "./telemetry";
import { buildHintPrompt } from "./prompt";
import type { FallbackReason, HintRequest, HintResponse } from "./types";

/**
 * The hint model, as a plain AI Gateway model string. Gemini 2.5 Flash-Lite is available on the
 * Gateway's free credits; Claude Haiku 4.5 needs paid credits. Measure a change with `npm run eval:hints`.
 */
export const HINT_MODEL = "google/gemini-2.5-flash-lite";
/** Models the Gateway may try if the hint model fails. Each must be available on the account's plan. */
export const FALLBACK_MODELS: readonly string[] = [];
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

export type HintDeps = {
  env?: Env;
  /** The request carried Vercel's OIDC header. */
  requestHasOidc?: boolean;
  /** A model to use instead of the Gateway string (tests and evals pass a mock). */
  model?: LanguageModel;
  /** AI SDK telemetry settings for the model call. Defaults to off. */
  telemetry?: TelemetryOptions;
  timeoutMs?: number;
};

/** What happened, for tracing: the response plus the raw model text when there was one. */
export type HintOutcome = HintResponse & { raw?: string; model?: string };

export async function getHint(request: HintRequest, data: HintLevel, deps: HintDeps = {}): Promise<HintOutcome> {
  const env = deps.env ?? process.env;
  const available = aiAvailability(env, deps.requestHasOidc ?? false);
  // An injected model needs no Gateway credentials, but HINTS_AI=off still wins.
  if (!available.ok && !(deps.model && available.reason === "no-credentials")) {
    return scripted(data, request.hintNumber, available.reason);
  }

  const { instructions, prompt } = buildHintPrompt({
    context: data.context,
    goals: data.level.goals.map((g) => g.description),
    done: request.goals,
    recentCommands: request.recentCommands,
    statusSummary: request.statusSummary,
    hintNumber: request.hintNumber,
  });

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deps.timeoutMs ?? HINT_TIMEOUT_MS);

  let raw: string;
  let model: string | undefined;
  try {
    const result = await generateText({
      model: deps.model ?? HINT_MODEL,
      instructions,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
      // The Gateway's model fallback is the retry; a second attempt would only make the player wait.
      maxRetries: 0,
      abortSignal: controller.signal,
      providerOptions: { gateway: { models: [...FALLBACK_MODELS], tags: ["merge-crew-hint", request.levelId] } },
      runtimeContext: { levelId: request.levelId, hintNumber: request.hintNumber },
      telemetry: deps.telemetry ?? { isEnabled: false },
    });
    raw = result.text;
    model = servedModel(result.providerMetadata) ?? result.response?.modelId;
  } catch {
    return scripted(data, request.hintNumber, timedOut ? "timeout" : "model-error");
  } finally {
    clearTimeout(timer);
  }

  const verdict = vetHint(raw, data.solution, data.level.suggestions);
  recordSafetyCheck(raw, verdict);
  if (!verdict.ok) return { ...scripted(data, request.hintNumber, verdict.reason), raw, model };
  return { text: verdict.text, source: "ai", raw, model };
}
