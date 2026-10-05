// POST /api/hint: one hint from Tidy. See "AI hints" in docs/architecture.md.

import { after } from "next/server";
import { context, trace } from "@opentelemetry/api";
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";
import { hintLevel, type HintLevel } from "@/hints/data";
import { RateLimiter, clientKey } from "@/hints/rateLimit";
import { getHint, type HintOutcome } from "@/hints/server";
import { TRACE_NAMES, flushTraces, tracingEnabled } from "@/hints/telemetry";
import { LIMITS, type HintRequest, type HintResponse } from "@/hints/types";
import { parseHintRequest } from "@/hints/validate";

// The model call has its own 6 second timeout; this is the platform's outer limit.
export const maxDuration = 15;

/**
 * Best effort only: counters live in this instance's memory, and serverless instances share
 * nothing. The real cap on spending is the AI Gateway budget set on the project.
 */
const perClient = new RateLimiter({ limit: 20, windowMs: 10 * 60_000 });
const perInstance = new RateLimiter({ limit: 120, windowMs: 60_000, maxKeys: 1 });

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** Read the body, giving up as soon as it passes `max` bytes. */
async function readCapped(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Browsers send Origin on cross-site POSTs; only this site's own pages may ask for hints. */
function crossSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

export async function POST(request: Request) {
  if (crossSite(request)) return json({ error: "forbidden" }, 403);
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return json({ error: "expected application/json" }, 415);
  }
  const raw = await readCapped(request, LIMITS.bodyBytes);
  if (raw === null) return json({ error: "body too large" }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const parsed = parseHintRequest(body, (id) => hintLevel(id)?.level.goals.length);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  for (const [limiter, key] of [
    [perClient, clientKey(request.headers)],
    [perInstance, "all"],
  ] as const) {
    const decision = limiter.take(key);
    if (!decision.ok) {
      return json({ error: "rate limited" }, 429, { "Retry-After": String(Math.ceil(decision.retryAfterMs / 1000)) });
    }
  }

  const data = hintLevel(parsed.request.levelId)!;
  const requestHasOidc = request.headers.has("x-vercel-oidc-token");
  const outcome = tracingEnabled()
    ? await traced(parsed.request, data, (telemetry) => getHint(parsed.request, data, { requestHasOidc, telemetry }))
    : await getHint(parsed.request, data, { requestHasOidc });

  const response: HintResponse = { text: outcome.text, source: outcome.source, ...(outcome.reason ? { reason: outcome.reason } : {}) };
  return json(response);
}

/**
 * Run one hint as one Langfuse trace, and flush after responding. The root span shows what a reviewer
 * needs at a glance: the goal the player is on and what they tried (input), and the hint they got
 * (output). Request details and the fallback reason go to metadata; the model call is recorded by
 * Langfuse's AI SDK integration as a generation under this span.
 */
async function traced(
  request: HintRequest,
  data: HintLevel,
  run: (telemetry: NonNullable<Parameters<typeof getHint>[2]>["telemetry"]) => Promise<HintOutcome>,
): Promise<HintOutcome> {
  after(flushTraces);
  const currentGoal = data.level.goals.find((_, i) => !request.goals[i])?.description ?? "All goals met";
  // Start from a clean root: Next.js's own request span is not exported, so a hint trace should not
  // point at it as a parent.
  return context.with(trace.deleteSpan(context.active()), () => propagateAttributes(
    {
      traceName: TRACE_NAMES.trace,
      ...(request.runId ? { sessionId: request.runId } : {}),
      tags: ["hints"],
      metadata: { levelId: request.levelId, hintNumber: String(request.hintNumber) },
    },
    () =>
      startActiveObservation(TRACE_NAMES.trace, async (span) => {
        span.update({
          input: {
            goal: currentGoal,
            recentCommands: request.recentCommands.map((c) => `${c.ok ? "" : "(refused) "}${c.command}`),
            status: request.statusSummary,
          },
          metadata: { levelId: request.levelId, hintNumber: request.hintNumber, goalsMet: request.goals, request },
        });
        const outcome = await run({
          functionId: TRACE_NAMES.generation,
          includeRuntimeContext: { levelId: true, hintNumber: true },
        });
        span.update({
          output: outcome.text,
          metadata: {
            source: outcome.source,
            reason: outcome.reason ?? null,
            model: outcome.model ?? null,
            ...(outcome.source === "scripted" && outcome.raw ? { rejectedModelAnswer: outcome.raw } : {}),
          },
          level: outcome.reason && outcome.reason !== "disabled" && outcome.reason !== "no-credentials" ? "WARNING" : "DEFAULT",
          ...(outcome.reason ? { statusMessage: `Scripted hint used: ${outcome.reason}` } : {}),
        });
        return outcome;
      }),
  ));
}
