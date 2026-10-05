"use client";

// The opening story: who the player is, what the crew builds and why it matters. Shown once on the
// first visit, and replayable from the start screen.

import { motion } from "motion/react";
import { actorColor } from "@/lib/palette";
import { Modal, primary, secondary } from "./Overlays";
import { RobotPortrait } from "./RobotPortrait";

export const CAFE_NAME = "Café Cog";

/** The opening, line by line. The last line is the player's job and is drawn larger. */
export const PREMISE_LINES = [
  `This is ${CAFE_NAME}, a tiny café run by robots. Lemonade, iced tea, and a sign that's never quite straight.`,
  "The crew builds the café's website: the menu, the prices, the opening hours and the sign.",
  "They keep it all in one shared project, and git remembers every version they save.",
  "Tidy is careful. Blaze is fast. Drift wanders off. Hoarder never saves anything.",
  "You're their new lead.",
  "When the crew breaks something, you fix it with real git commands.",
] as const;

const CREW = ["tidy", "blaze", "drift", "hoarder"] as const;

export function PremiseCard({ onDone, doneLabel = "Let's go" }: { onDone: () => void; doneLabel?: string }) {
  const job = PREMISE_LINES.length - 1;
  return (
    <Modal label={`Welcome to ${CAFE_NAME}`} onClose={onDone} className="max-w-xl overflow-hidden p-0">
      <CafeFront />
      <div className="px-6 pt-5 pb-6 md:px-8 md:pb-7">
        <ol className="flex flex-col gap-2.5">
          {PREMISE_LINES.map((line, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.35, type: "spring", stiffness: 300, damping: 28 }}
              className={
                i === job
                  ? "mt-1 rounded-2xl bg-ink px-4 py-3 text-[17px] leading-snug font-bold text-paper md:text-lg"
                  : i === job - 1
                    ? "text-[17px] leading-snug font-bold text-ink"
                    : "text-[15.5px] leading-snug text-body"
              }
            >
              {line}
            </motion.li>
          ))}
        </ol>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 + job * 0.35 + 0.3 }}
          className="mt-6 flex flex-wrap items-center gap-3"
        >
          <button type="button" data-autofocus onClick={onDone} className={primary}>
            {doneLabel}
            <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden><path d="M1.5 0.8 L9 5 L1.5 9.2 Z" fill="currentColor" /></svg>
          </button>
        </motion.div>
        {/* Visible from the first frame, so nobody has to wait for the lines to skip them. */}
        <button type="button" onClick={onDone} className={`${secondary} absolute top-3 right-3 bg-card/90 px-3 py-1.5 text-[13px]`}>
          Skip
        </button>
      </div>
    </Modal>
  );
}

/** The café: a striped awning, the sign, and the crew standing at the counter. */
function CafeFront() {
  const stripes = 10;
  return (
    <div className="relative bg-sunk pt-4" aria-hidden>
      <svg viewBox="0 0 400 46" className="block h-auto w-full" preserveAspectRatio="none">
        {Array.from({ length: stripes }, (_, i) => {
          const w = 400 / stripes;
          const fill = i % 2 === 0 ? actorColor("blaze").line : "var(--color-card)";
          return <path key={i} d={`M${i * w} 0 H${(i + 1) * w} V30 Q${(i + 0.5) * w} 46 ${i * w} 30 Z`} fill={fill} />;
        })}
      </svg>
      <div className="absolute top-1 left-1/2 -translate-x-1/2 rotate-[-2deg] rounded-lg border-2 border-ink bg-card px-3 py-0.5 text-[13px] font-black tracking-[0.18em] text-ink uppercase shadow-[0_2px_0_var(--color-ink)]">
        {CAFE_NAME}
      </div>
      <div className="flex items-end justify-center gap-2 px-4 pt-3 sm:gap-4">
        {CREW.map((r, i) => (
          <motion.div
            key={r}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.1, type: "spring", stiffness: 280, damping: 22 }}
            className="flex flex-col items-center"
          >
            <RobotPortrait actor={r} mood="happy" size={64} framed={false} />
            <span className="text-[11px] font-bold" style={{ color: actorColor(r).deep }}>{actorColor(r).name}</span>
          </motion.div>
        ))}
      </div>
      <div className="h-3 border-t-4 border-ink/80 bg-[repeating-linear-gradient(90deg,var(--color-line)_0_18px,var(--color-line-soft)_18px_36px)]" />
    </div>
  );
}
