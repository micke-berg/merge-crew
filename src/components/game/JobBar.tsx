"use client";

import type { Goal } from "@/engine/types";

type Props = { goals: Goal[]; done: boolean[]; won: boolean };

/**
 * The player's job, always right above the terminal: every goal as a step in a short list. Done
 * steps shrink to one line with a tick, the current step is bold, and the steps still to come stay
 * muted. This is the only place the level's goals are shown while playing (the brief card lists
 * them all before the level starts), so the task stays in view at every window width.
 */
export function JobBar({ goals, done, won }: Props) {
  const current = goals.findIndex((_, i) => !done[i]);
  const allDone = won || current === -1;
  const doneCount = done.filter(Boolean).length;
  return (
    <section
      data-tour="jobbar"
      aria-label="Your job"
      className={`rounded-2xl border-2 px-3 py-2 transition-colors duration-300 md:px-4 ${
        allDone ? "border-success bg-success-soft" : "border-ink bg-card"
      }`}
    >
      <div className="flex items-center gap-x-3">
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${
            allDone ? "bg-success-strong text-white" : "bg-ink text-paper"
          }`}
        >
          Your job
        </span>
        {goals.length > 1 && !allDone && (
          <span className="shrink-0 text-[12px] font-semibold text-soft">
            {doneCount} of {goals.length} done
          </span>
        )}
      </div>
      {allDone ? (
        <p className="mt-1.5 text-[14.5px] leading-snug font-semibold text-success-ink md:text-[15px]" aria-live="polite">
          All done. Nice work, lead.
        </p>
      ) : (
        <ol className="mt-2 flex flex-col gap-1.5">
          {goals.map((g, i) => {
            const ok = done[i] ?? false;
            const isCurrent = i === current;
            return (
              <li key={g.id} aria-current={isCurrent ? "step" : undefined} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold transition-colors duration-300 ${
                    ok
                      ? "border-success bg-success text-white"
                      : isCurrent
                        ? "border-ink bg-white text-ink"
                        : "border-line-strong bg-white text-soft"
                  }`}
                >
                  {ok ? (
                    <svg width="11" height="11" viewBox="0 0 12 12">
                      <path d="M2 6.4 L4.8 9 L10 3" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`min-w-0 flex-1 leading-snug transition-colors duration-300 ${
                    ok
                      ? "truncate text-[13px] text-soft"
                      : isCurrent
                        ? "text-[14.5px] font-bold text-ink md:text-[15px]"
                        : "text-[13.5px] text-soft"
                  }`}
                >
                  {g.description}
                  <span className="sr-only">{ok ? " (done)" : isCurrent ? " (your current step)" : " (later)"}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
