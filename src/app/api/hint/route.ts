// POST /api/hint: one hint from Tidy. See "AI hints" in docs/architecture.md.

import { after } from "next/server";
import { startActiveObservation } from "@langfuse/tracing";
import { hintLevel } from "@/hints/data";
import { RateLimiter, clientKey } from "@/hints/rateLimit";
import { getHint, type HintOutcome } from "@/hints/server";
import { flushTraces, langfuseGenerations, tracingEnabled } from "@/hints/telemetry";
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
    ? await traced(parsed.request, (telemetry) => getHint(parsed.request, data, { requestHasOidc, telemetry }))
    : await getHint(parsed.request, data, { requestHasOidc });

  const response: HintResponse = { text: outcome.text, source: outcome.source, ...(outcome.reason ? { reason: outcome.reason } : {}) };
  return json(response);
}

/** Run one hint inside a Langfuse span that records the outcome, and flush after responding. */
async function traced(
  request: HintRequest,
  run: (telemetry: NonNullable<Parameters<typeof getHint>[2]>["telemetry"]) => Promise<HintOutcome>,
): Promise<HintOutcome> {
  after(flushTraces);
  const meta = { levelId: request.levelId, hintNumber: request.hintNumber };
  return startActiveObservation("merge-crew-hint", async (span) => {
    span.update({ input: request, metadata: meta });
    const outcome = await run({
      functionId: "merge-crew-hint",
      integrations: [langfuseGenerations(meta)],
      includeRuntimeContext: { levelId: true, hintNumber: true },
    });
    span.update({
      output: { text: outcome.text, source: outcome.source, raw: outcome.raw },
      metadata: { ...meta, source: outcome.source, reason: outcome.reason ?? null, model: outcome.model ?? null },
      level: outcome.reason && outcome.reason !== "disabled" && outcome.reason !== "no-credentials" ? "WARNING" : "DEFAULT",
    });
    return outcome;
  });
}
