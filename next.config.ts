import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * The game loads nothing from other origins: scripts, styles, fonts (self-hosted by next/font), the
 * robot sprites and the hint route are all this site's own. The policy says so, and also forbids
 * framing, plugins and form posts elsewhere.
 *
 * 'unsafe-inline' stays for scripts and styles. Next.js puts small inline scripts in every page, and
 * the only way to allow exactly those is a per-request nonce, which would turn every static page into
 * one rendered on each visit (see the Next.js content security policy guide). Nothing here renders
 * text from a visitor or another site as HTML, so the trade is a fair one for a static game.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "media-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Security headers for every page. The only server code is the hint route. */
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
