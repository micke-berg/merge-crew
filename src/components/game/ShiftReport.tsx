"use client";

import type { Level } from "@/engine/types";
import { actorColor } from "@/lib/palette";
import { cardById, isStopped } from "@/levels/shift";

/**
 * What happened in the crew's shift (Act 3), next to the files: each robot's beat, and whether a
 * house rule stopped it or it went through and is now the player's to fix.
 */
export function ShiftReport({ level, cards }: { level: Level; cards: readonly string[] }) {
  const shift = level.shift;
  if (!shift) return null;
  return (
    <section aria-labelledby="shift-title" className="rounded-3xl border border-line bg-panel p-4">
      <h2 id="shift-title" className="text-sm font-bold">This shift</h2>
      <ul className="mt-2.5 flex flex-col gap-2">
        {shift.beats.map((beat) => {
          const stopped = isStopped(beat, cards);
          const who = actorColor(beat.actor);
          const card = cardById(level, beat.stoppedBy);
          return (
            <li
              key={`${beat.actor}-${beat.stoppedBy}`}
              className={`rounded-2xl border px-3 py-2 text-[12.5px] leading-snug ${stopped ? "border-line bg-card text-soft" : "border-warn-edge bg-warn-wash text-warn-ink"}`}
            >
              <p className="flex items-center gap-1.5 font-bold">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: who.line }} aria-hidden />
                <span className={stopped ? "text-ink" : "text-warn-deep"}>{who.name}</span>
                <span className={`ml-auto rounded-full px-2 py-px text-[10.5px] font-bold tracking-wide uppercase ${stopped ? "bg-success-wash text-success-deep" : "bg-warn text-white"}`}>
                  {stopped ? "Stopped" : "Yours to fix"}
                </span>
              </p>
              <p className="mt-1">
                {stopped ? (
                  <>Stopped by your rule: <span className="font-semibold text-ink">{card?.title}</span>.</>
                ) : (
                  <>
                    {who.name} {beat.report}. <span className="text-warn-note">The rule you left out: {card?.title}.</span>
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
