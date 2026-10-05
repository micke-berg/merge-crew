"use client";

import { motion } from "motion/react";
import type { Goal } from "@/engine/types";

type Props = { goals: Goal[]; done: boolean[] };

export function GoalsPanel({ goals, done }: Props) {
  const count = done.filter(Boolean).length;
  return (
    <section aria-labelledby="goals-title" className="rounded-3xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 id="goals-title" className="text-sm font-bold">Goals</h2>
        <span className="rounded-full bg-chip px-2 py-0.5 font-mono text-[11px] font-semibold text-soft">
          {count}/{goals.length}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {goals.map((g, i) => {
          const ok = done[i] ?? false;
          return (
            <li key={g.id} className="flex items-start gap-2.5 text-[13.5px] leading-snug">
              <span
                className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300 ${
                  ok ? "border-success bg-success" : "border-line-strong bg-white"
                }`}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
                  <motion.path
                    d="M2 6.4 L4.8 9 L10 3"
                    fill="none"
                    stroke="white"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={false}
                    animate={{ pathLength: ok ? 1 : 0, opacity: ok ? 1 : 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                </svg>
              </span>
              <span className={ok ? "text-soft" : "text-ink"}>
                {g.description}
                <span className="sr-only">{ok ? " (done)" : " (not done yet)"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
