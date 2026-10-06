"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Goal } from "@/engine/types";

type Props = { goals: Goal[]; done: boolean[]; won: boolean };

/**
 * The player's current task, always right above the terminal: the first goal that is not met yet,
 * one dot per goal. The goals panel keeps the full list; this bar is what keeps the task in view
 * at every window width.
 */
export function JobBar({ goals, done, won }: Props) {
  const current = goals.findIndex((_, i) => !done[i]);
  const allDone = won || current === -1;
  const goal = allDone ? null : goals[current];
  return (
    <section
      data-tour="jobbar"
      aria-label="Your job"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border-2 px-3 py-2 transition-colors duration-300 sm:flex-nowrap md:px-4 ${
        allDone ? "border-success bg-success-soft" : "border-ink bg-card"
      }`}
    >
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${
          allDone ? "bg-success-strong text-white" : "bg-ink text-paper"
        }`}
      >
        Your job
      </span>
      {/* On phones the label and dots share the top line and the task gets the full width below. */}
      <div className="relative order-3 min-w-0 basis-full overflow-hidden sm:order-none sm:flex-1 sm:basis-auto" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={goal?.id ?? "done"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className={`text-[14.5px] leading-snug font-semibold md:text-[15px] ${allDone ? "text-success-ink" : "text-ink"}`}
          >
            {goal ? goal.description : "All done. Nice work, lead."}
          </motion.p>
        </AnimatePresence>
      </div>
      {goals.length > 1 && (
        <ol className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0" aria-label={`${done.filter(Boolean).length} of ${goals.length} done`}>
          {goals.map((g, i) => (
            <li
              key={g.id}
              className={`h-2.5 w-2.5 rounded-full border-2 transition-colors duration-300 ${
                done[i] ? "border-success bg-success" : i === current ? "border-ink bg-white" : "border-line-strong bg-white"
              }`}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
