"use client";

import { motion } from "motion/react";
import { actorColor } from "@/lib/palette";

// Fixed "random" numbers, so the server and the browser draw the same pieces.
const PIECES = Array.from({ length: 36 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12543.123;
  const r = (n: number) => n - Math.floor(n);
  return { left: 4 + r(a) * 92, drift: (r(b) - 0.5) * 120, delay: r(a * 1.7) * 0.5, spin: (r(b * 2.3) - 0.5) * 720, size: 6 + r(a * 3.1) * 6, round: i % 3 === 0 };
});

/**
 * A short fall of paper over the map when a level is won, in the colours of the crew that played it.
 * Decoration only: hidden from screen readers, and not drawn at all with reduced motion.
 */
export function Confetti({ actors, reduce }: { actors: readonly string[]; reduce: boolean }) {
  if (reduce) return null;
  const colors = actors.map((a) => actorColor(a).line);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {PIECES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute block"
          style={{ left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 0.55, borderRadius: p.round ? 999 : 2, backgroundColor: colors[i % colors.length] }}
          initial={{ top: "-4%", x: 0, rotate: 0, opacity: 0 }}
          animate={{ top: "104%", x: p.drift, rotate: p.spin, opacity: [0, 1, 1, 0] }}
          transition={{ delay: p.delay, duration: 2.2 + (i % 5) * 0.18, ease: [0.2, 0.6, 0.6, 1], opacity: { delay: p.delay, duration: 2.4, times: [0, 0.08, 0.8, 1] } }}
        />
      ))}
    </div>
  );
}
