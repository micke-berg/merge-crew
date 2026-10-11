"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Level } from "@/engine/types";
import { levels } from "@/levels";
import { ACT_NAMES, levelLabel } from "./Overlays";
import { useProgress } from "./progress";

type Group = { key: string; title: string; levels: Level[] };

/** The command a practice level is about: its first practised command that is not just looking at the log. */
function toolOf(level: Level): string | undefined {
  const practised = level.mission?.practise ?? [];
  return practised.find((c) => !c.startsWith("git log")) ?? practised[0];
}

/** The levels in the order the start page shows them: each act, with practice levels under their own heading. */
function groups(): Group[] {
  const out: Group[] = [];
  for (const act of [1, 2, 3] as const) {
    const inAct = levels.filter((l) => l.act === act);
    if (inAct.length === 0) continue;
    const basics = inAct.filter((l) => !l.usedIn);
    const practice = inAct.filter((l) => l.usedIn);
    const split = practice.length > 0;
    if (basics.length) out.push({ key: `a${act}`, title: `Act ${act} · ${split ? "The basics" : ACT_NAMES[act]}`, levels: basics });
    if (practice.length) out.push({ key: `p${act}`, title: `Act ${act} · Handy tools`, levels: practice });
  }
  return out;
}

/** The level label in the header, as a button that opens a list of every level to jump to. */
export function LevelPicker({ level }: { level: Level }) {
  const [open, setOpen] = useState(false);
  const done = useProgress();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    // Esc closes the list and nothing else, so it does not also skip the scene behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  // On phones the list spans the header (the header is its positioned parent); from sm up it hangs under the button.
  return (
    <div ref={root} className="shrink-0 sm:relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        title="Jump to another level"
        className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-paper transition-colors hover:bg-ink/85 focus-visible:ring-4 focus-visible:ring-focus/40 focus-visible:outline-none"
      >
        {levelLabel(level)}
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden className={open ? "rotate-180" : ""}>
          <path d="M1.5 3.5 L5 7 L8.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <nav
          aria-label="All levels"
          className="absolute inset-x-4 top-full z-50 mt-2 max-h-[70dvh] overflow-y-auto sm:inset-x-auto sm:left-0 sm:w-[22rem] rounded-2xl border border-line bg-card p-3 text-ink shadow-[0_20px_50px_-15px_rgba(60,44,20,0.5)]"
        >
          {groups().map((g) => (
            <div key={g.key} className="mb-2 last:mb-0">
              <p className="px-2 pt-1 pb-1 text-[11px] font-bold tracking-[0.12em] text-muted uppercase">{g.title}</p>
              <ul>
                {g.levels.map((l) => {
                  const complete = done.includes(l.id);
                  const current = l.id === level.id;
                  return (
                    <li key={l.id}>
                      <Link
                        href={`/level/${l.id}`}
                        aria-current={current ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[14px] transition-colors hover:bg-wash focus-visible:bg-wash focus-visible:outline-none ${current ? "bg-sunk font-bold" : "font-semibold"}`}
                      >
                        <span
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-extrabold ${
                            complete ? "border-success bg-success text-white" : current ? "border-ink bg-white text-ink" : "border-line-strong bg-white text-soft"
                          }`}
                        >
                          {complete ? (
                            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
                              <path d="M2 6.4 L4.8 9 L10 3" fill="none" stroke="white" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            l.order
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{l.title}</span>
                          {l.usedIn && toolOf(l) && (
                            <span className="block truncate font-mono text-[11px] leading-tight font-medium text-muted">{toolOf(l)}</span>
                          )}
                        </span>
                        {complete && <span className="sr-only">(completed)</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="mt-2 border-t border-line-soft pt-2">
            <Link
              href="/commands"
              className="flex items-center justify-between rounded-xl px-2 py-1.5 text-[14px] font-semibold text-soft transition-colors hover:bg-wash hover:text-ink focus-visible:bg-wash focus-visible:outline-none"
            >
              All commands
              <span aria-hidden>→</span>
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
