"use client";

import type { Goal } from "@/engine/types";
import { readJob } from "./jobSteps";

type Props = { goals: Goal[]; done: boolean[]; kept: boolean[]; won: boolean };

/**
 * The player's job, always right above the terminal: the steps to do as a short list, and under them
 * the rules to keep. Done steps shrink to one line with a tick, the current step is bold, and the
 * steps still to come stay muted. A rule is a goal that was already true when the turn began (see
 * jobSteps.ts): it sits quietly under the steps and turns into a warning if a command breaks it.
 * This is the only place the level's goals are shown while playing (the brief card lists them all
 * before the level starts), so the task stays in view at every window width.
 */
export function JobBar({ goals, done, kept, won }: Props) {
  const { steps, rules, current } = readJob(goals, done, kept);
  const allDone = won || current === null;
  const doneCount = steps.filter((l) => l.done).length;
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
        {steps.length > 1 && !allDone && (
          <span className="shrink-0 text-[12px] font-semibold text-soft">
            {doneCount} of {steps.length} done
          </span>
        )}
      </div>
      {allDone ? (
        <p className="mt-1.5 text-[14.5px] leading-snug font-semibold text-success-ink md:text-[15px]" aria-live="polite">
          All done. Nice work, lead.
        </p>
      ) : (
        <>
          <ol className="mt-2 flex flex-col gap-1.5">
            {steps.map(({ goal: g, done: ok }, i) => {
              const isCurrent = g === current;
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
                    // relative: the hidden "(done)" text is absolutely positioned and must be clipped with the line.
                    className={`relative min-w-0 flex-1 leading-snug transition-colors duration-300 ${
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
          {rules.length > 0 && (
            <div className="mt-2 border-t border-divider pt-1.5">
              <p className="text-[10.5px] font-bold tracking-wider text-soft uppercase">Keep it that way</p>
              <ul className="mt-1 flex flex-col gap-1">
                {rules.map(({ goal: g, done: ok }) => (
                  <li
                    key={g.id}
                    aria-current={g === current ? "step" : undefined}
                    className={`flex items-start gap-2.5 rounded-lg transition-colors duration-300 ${ok ? "" : "bg-warn-wash px-1.5 py-1 -mx-1.5"}`}
                  >
                    <span aria-hidden className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center ${ok ? "text-soft" : "text-warn"}`}>
                      {ok ? (
                        // A small shield: this is safe as long as you leave it alone.
                        <svg width="14" height="14" viewBox="0 0 16 16">
                          <path d="M8 1.6 L13.2 3.6 V7.6 C13.2 10.9 11 13.3 8 14.4 C5 13.3 2.8 10.9 2.8 7.6 V3.6 Z" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
                          <path d="M5.6 8 L7.4 9.7 L10.5 6.3" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 16 16">
                          <path d="M8 2 L14.5 13.5 H1.5 Z" fill="currentColor" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
                          <path d="M8 6.2 V9.6" stroke="white" strokeWidth={1.7} strokeLinecap="round" />
                          <circle cx={8} cy={11.6} r={0.95} fill="white" />
                        </svg>
                      )}
                    </span>
                    <span className={`min-w-0 flex-1 leading-snug ${ok ? "text-[13px] text-soft" : "text-[13.5px] font-bold text-warn-deep"}`}>
                      {g.description}
                      {ok ? <span className="sr-only"> (still true, keep it that way)</span> : <span className="font-semibold"> · no longer true, put it right</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
