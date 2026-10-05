// A best-effort, in-memory rate limit for the hint route.
//
// Best effort only: every serverless instance keeps its own counters, instances come and go, and
// they share nothing. It slows down one noisy client on a warm instance; it is not a guarantee.
// The hard cap on spending is the AI Gateway budget the maintainer sets on the project.

export type RateLimitOptions = {
  /** Requests allowed per key within the window. */
  limit: number;
  windowMs: number;
  /** Keys tracked at most; the oldest are dropped first so memory stays bounded. */
  maxKeys?: number;
  now?: () => number;
};

export type RateDecision = { ok: true; remaining: number } | { ok: false; retryAfterMs: number };

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;
  private readonly now: () => number;

  constructor(options: RateLimitOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.maxKeys = options.maxKeys ?? 5000;
    this.now = options.now ?? Date.now;
  }

  /** Count one request for `key` and say whether it may go ahead. A refused request is not counted. */
  take(key: string): RateDecision {
    const now = this.now();
    const since = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { ok: false, retryAfterMs: recent[0] + this.windowMs - now };
    }
    recent.push(now);
    // Re-insert so the map's order is "least recently used first".
    this.hits.delete(key);
    this.hits.set(key, recent);
    while (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
    return { ok: true, remaining: this.limit - recent.length };
  }
}

/** The client address as Vercel reports it, or "unknown". Vercel sets x-forwarded-for itself. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
