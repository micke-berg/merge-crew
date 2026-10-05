"use client";

import Link from "next/link";
import { motion, MotionConfig } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { levels } from "@/levels";
import { actorColor } from "@/components/map/palette";
import { Logo } from "./Logo";
import { ACT_NAMES } from "./Overlays";
import { useProgress } from "./progress";
import { RobotPortrait } from "./RobotPortrait";
import { preloadSheets } from "@/components/robots/Sprite";
import type { SpriteRobot } from "@/components/robots/sheets.generated";

const ASSETS_URL = "https://github.com/micke-berg/merge-crew/blob/main/ASSETS.md";

const CREW: readonly { id: SpriteRobot; line: string }[] = [
  { id: "tidy", line: "Calm, helpful. Knows git." },
  { id: "blaze", line: "Fast. Very fast. Too fast." },
  { id: "drift", line: "Never pulls. Drifts away." },
  { id: "hoarder", line: "Never commits. Keeps it all." },
];

const ACT_BLURBS: Record<number, string> = {
  1: "Tidy teaches you the basics. You type every command.",
  2: "A robot breaks something. You fix it.",
  3: "Everyone works at once. You set the rules.",
};

export function StartScreen() {
  const done = useProgress();
  const playRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => playRef.current?.focus({ preventScroll: true }), []);
  const firstOpen = levels.find((l) => !done.includes(l.id)) ?? levels[0];
  const started = done.length > 0;
  const acts = [1, 2, 3] as const;
  preloadSheets(CREW.flatMap((r) => (["idle", "signature"] as const).map((state) => ({ size: "portrait" as const, robot: r.id, state }))));

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="min-h-dvh bg-[#F7F1E5] font-sans text-[#26283B]"
        style={{ backgroundImage: "radial-gradient(#E4DACA 1.1px, transparent 1.2px)", backgroundSize: "22px 22px" }}
      >
        <div className="mx-auto max-w-5xl px-4 pt-10 pb-16 md:px-8 md:pt-16">
          {/* hero */}
          <header className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Logo size={44} />
                <span className="rounded-full bg-[#26283B] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#F7F1E5]">
                  a git game
                </span>
              </div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="mt-5 text-6xl leading-[0.95] font-black tracking-[-0.03em] md:text-8xl"
              >
                Merge Crew
              </motion.h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#4A4436] md:text-xl">
                Your robot crew keeps breaking the repository. You fix it, with real git commands.
              </p>
            </div>
            <Link
              href={`/level/${firstOpen.id}`}
              ref={playRef}
              className="group inline-flex shrink-0 items-center gap-3 rounded-full bg-[#26283B] py-3.5 pr-7 pl-6 text-lg font-extrabold text-[#F7F1E5] shadow-[0_4px_0_#11121c] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 focus-visible:ring-4 focus-visible:ring-[#2563C9]/40 focus-visible:outline-none"
            >
              <svg width="16" height="16" viewBox="0 0 10 10" aria-hidden className="transition-transform group-hover:translate-x-0.5">
                <path d="M1.5 0.8 L9 5 L1.5 9.2 Z" fill="currentColor" />
              </svg>
              <span>
                {started ? "Continue" : "Play"}
                <span className="block text-[12px] font-semibold text-[#C9CBDA]">{firstOpen.title}</span>
              </span>
            </Link>
          </header>

          {/* crew */}
          <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="The crew">
            {CREW.map((r, i) => (
              <CrewCard key={r.id} id={r.id} line={r.line} index={i} />
            ))}
          </ul>

          {/* acts and levels */}
          <section aria-label="Levels" className="mt-12 grid gap-5 md:grid-cols-3">
            {acts.map((act) => {
              const list = levels.filter((l) => l.act === act);
              return (
                <div key={act} className="rounded-3xl border border-[#D8CCB5] bg-[#FBF8F1] p-5 shadow-[0_1px_0_#fff_inset,0_10px_30px_-18px_rgba(74,58,32,0.35)]">
                  <p className="text-[12px] font-bold tracking-[0.12em] text-[#7A7264] uppercase">Act {act}</p>
                  <h2 className="text-2xl font-extrabold tracking-tight">{ACT_NAMES[act]}</h2>
                  <p className="mt-1 text-[14px] text-[#5D5649]">{ACT_BLURBS[act]}</p>
                  {list.length === 0 ? (
                    <p className="mt-5 rounded-2xl border border-dashed border-[#C9BCA4] px-4 py-3 text-[13px] font-semibold text-[#7A7264]">
                      Coming soon
                    </p>
                  ) : (
                    <ol className="relative mt-4">
                      {list.map((l, i) => {
                        const complete = done.includes(l.id);
                        const current = l.id === firstOpen.id;
                        return (
                          <li key={l.id} className="relative">
                            {/* the act's metro line, from this stop to the next */}
                            {i < list.length - 1 && (
                              <span className="absolute top-[26px] left-[15px] h-full w-[5px] bg-[#2A2D45]" aria-hidden />
                            )}
                            <Link
                              href={`/level/${l.id}`}
                              className="group flex items-start gap-3 rounded-2xl py-2 pr-2 transition-colors hover:bg-[#F1EADC] focus-visible:bg-[#F1EADC] focus-visible:ring-4 focus-visible:ring-[#2563C9]/30 focus-visible:outline-none"
                            >
                              <span
                                className={`relative z-10 mt-0.5 grid h-[35px] w-[35px] shrink-0 place-items-center rounded-full border-[4px] text-[13px] font-extrabold transition-transform group-hover:scale-110 ${
                                  complete ? "border-[#11876F] bg-[#11876F] text-white" : current ? "border-[#2563C9] bg-white text-[#2563C9]" : "border-[#2A2D45] bg-white text-[#2A2D45]"
                                }`}
                              >
                                {complete ? (
                                  <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden>
                                    <path d="M2 6.4 L4.8 9 L10 3" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                ) : (
                                  l.order
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block font-bold leading-tight">
                                  {l.title}
                                  {complete && <span className="sr-only"> (completed)</span>}
                                </span>
                                <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[#5D5649]">{l.brief}</span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              );
            })}
          </section>

          <footer className="mt-10 flex flex-col items-center gap-1.5 text-center text-[13px] text-[#7A7264]">
            <p>Free, in the browser, no account. Progress stays on this device.</p>
            <p>
              <a
                href={ASSETS_URL}
                className="underline decoration-[#C9BCA4] underline-offset-2 hover:text-[#26283B] focus-visible:rounded focus-visible:ring-4 focus-visible:ring-[#2563C9]/30 focus-visible:outline-none"
              >
                Art: Pocket Machines (CC0)
              </a>
            </p>
          </footer>
        </div>
      </div>
    </MotionConfig>
  );
}

/** A crew card. Each robot shows its signature move once as the cards arrive, and again on hover. */
function CrewCard({ id, line, index }: { id: SpriteRobot; line: string; index: number }) {
  const c = actorColor(id);
  const [show, setShow] = useState(0);
  const play = () => setShow((n) => n + 1);
  useEffect(() => {
    const t = window.setTimeout(() => setShow((n) => n || 1), 700 + index * 450);
    return () => window.clearTimeout(t);
  }, [index]);
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * index, type: "spring", stiffness: 260, damping: 24 }}
      onPointerEnter={play}
      className="flex items-center gap-3 rounded-2xl border border-[#E2D8C6] bg-[#FFFDF8]/90 p-3 pt-4 shadow-[0_6px_18px_-12px_rgba(74,58,32,0.4)]"
    >
      <RobotPortrait actor={id} animation={show ? "signature" : "idle"} playKey={show} size={64} />
      <div className="min-w-0">
        <p className="font-bold" style={{ color: c.deep }}>{c.name}</p>
        <p className="text-[13px] leading-snug text-[#5D5649]">{line}</p>
      </div>
    </motion.li>
  );
}
