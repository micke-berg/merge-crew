import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hintLevel } from "@/hints/data";
import { LIMITS } from "@/hints/types";

const body = {
  levelId: "act2-01",
  hintNumber: 1,
  recentCommands: [{ command: "git status", outputFirstLines: "On branch main", ok: true }],
  goals: [false, true, false],
  statusSummary: "On branch main. Working tree clean.",
};

function post(payload: unknown, headers: Record<string, string> = {}) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return new Request("http://localhost:3000/api/hint", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", "x-forwarded-for": "198.51.100.7", ...headers },
    body: text,
  });
}

describe("POST /api/hint", () => {
  beforeEach(() => {
    // No credentials and no tracing: the route must answer with scripted hints and send nothing.
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubEnv("LANGFUSE_PUBLIC_KEY", "");
    vi.stubEnv("LANGFUSE_SECRET_KEY", "");
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("answers with the scripted hint and says why", async () => {
    const { POST } = await import("./route");
    const res = await POST(post(body));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ text: hintLevel("act2-01")!.scripted[0], source: "scripted", reason: "no-credentials" });
  });

  it("says disabled when HINTS_AI is off", async () => {
    vi.stubEnv("HINTS_AI", "off");
    vi.stubEnv("AI_GATEWAY_API_KEY", "present-but-unused");
    const { POST } = await import("./route");
    expect(await (await POST(post({ ...body, hintNumber: 3 }))).json()).toMatchObject({ source: "scripted", reason: "disabled" });
  });

  it("rejects oversized, malformed and cross-site requests", async () => {
    const { POST } = await import("./route");
    const big = { ...body, statusSummary: "x".repeat(LIMITS.bodyBytes) };
    expect((await POST(post(big))).status).toBe(413);
    expect((await POST(post("{not json"))).status).toBe(400);
    expect((await POST(post({ ...body, levelId: "nope" }))).status).toBe(400);
    expect((await POST(post(body, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(post(body, { origin: "https://elsewhere.example" }))).status).toBe(403);
    expect((await POST(post(body, { origin: "http://localhost:3000" }))).status).toBe(200);
  });

  it("limits one client, best effort, with Retry-After", async () => {
    const { POST } = await import("./route");
    const headers = { "x-forwarded-for": "192.0.2.44" };
    for (let i = 0; i < 20; i++) expect((await POST(post(body, headers))).status).toBe(200);
    const limited = await POST(post(body, headers));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another client is unaffected.
    expect((await POST(post(body, { "x-forwarded-for": "192.0.2.45" }))).status).toBe(200);
  });
});
