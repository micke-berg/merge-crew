"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { actorColor } from "@/lib/palette";
import { useLineVoice } from "@/components/sound";
import type { Bubble } from "./game";
import { RobotPortrait } from "./RobotPortrait";

type Props = {
  bubble: Bubble | null;
  /** Changes with every new line, so the typewriter restarts. */
  lineKey: number;
  awaitingClick: boolean;
  onNext: () => void;
  reduce: boolean;
};

/** Keys that move a scene on. Ignored while the player is typing or has a control focused. */
function isAdvanceKey(e: KeyboardEvent) {
  return e.key === "Enter" || e.key === " " || e.key === "ArrowRight";
}

function targetIsControl(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  if (!t || t.dataset.dialogue !== undefined) return false;
  return !!t.closest("input, textarea, select, button, a, [contenteditable=true]");
}

/** The dialogue strip: who speaks, what they say, and a nudge to continue. */
export function DialogueBox({ bubble, lineKey, awaitingClick, onNext, reduce }: Props) {
  return (
    <div className="flex min-h-[92px] items-end">
      <AnimatePresence mode="wait">
        {bubble && (
          <Line
            key={lineKey}
            bubble={bubble}
            awaitingClick={awaitingClick}
            onNext={onNext}
            reduce={reduce}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Typing speed of robot lines. Slow enough to read along and for the voice blips to land. */
const CHARS_PER_SECOND = 45;

function Line({ bubble, awaitingClick, onNext, reduce }: Omit<Props, "lineKey" | "bubble"> & { bubble: Bubble }) {
  const c = actorColor(bubble.actor);
  const full = bubble.text;
  const [shown, setShown] = useState(reduce ? full.length : 0);
  const ref = useRef<HTMLDivElement>(null);
  const done = shown >= full.length;
  useLineVoice(bubble.actor, bubble.mood, full, { typing: !done, instant: reduce, charsPerSecond: CHARS_PER_SECOND });

  useEffect(() => {
    if (done) return;
    const t = window.setInterval(() => setShown((n) => Math.min(full.length, n + 1)), 1000 / CHARS_PER_SECOND);
    return () => window.clearInterval(t);
  }, [done, full.length]);

  const press = () => {
    if (!done) setShown(full.length);
    else if (awaitingClick) onNext();
  };
  const onAdvanceKey = useEffectEvent(press);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isAdvanceKey(e) || targetIsControl(e) || e.repeat) return;
      e.preventDefault();
      onAdvanceKey();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    // Keep keyboard focus on the line, so Enter and Space keep working without a click.
    const active = document.activeElement;
    if (!active || active === document.body || active.closest("[data-dialogue]")) ref.current?.focus({ preventScroll: true });
  }, []);

  return (
    <motion.div
      ref={ref}
      data-dialogue=""
      role="button"
      tabIndex={0}
      // The line itself is announced by the level screen's live region, so it is not read twice.
      aria-label="Continue the scene (Enter)"
      onClick={press}
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="relative flex w-full cursor-pointer items-start gap-3 rounded-[22px] border-2 bg-card p-3 pr-5 text-left shadow-[0_14px_36px_-14px_rgba(60,44,20,0.55)] outline-none focus-visible:ring-4 focus-visible:ring-focus/40 md:gap-4 md:p-4 md:pr-6"
      style={{ borderColor: c.line }}
    >
      <RobotPortrait actor={bubble.actor} mood={bubble.mood} size={58} still={reduce} />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[12px] font-bold tracking-wide uppercase" style={{ color: c.deep }}>
          {c.name}
        </p>
        <p className="mt-0.5 text-[16px] leading-snug font-medium text-ink md:text-[17px]" aria-hidden>
          {full.slice(0, shown)}
          <span className="invisible">{full.slice(shown)}</span>
        </p>
      </div>
      <span
        className={`absolute right-3 bottom-2 flex items-center gap-1 text-[11px] font-semibold text-muted transition-opacity duration-200 ${done && awaitingClick ? "opacity-100" : "opacity-0"}`}
        aria-hidden
      >
        <kbd className="rounded-md border border-line bg-white px-1.5 py-px font-sans text-[10px] shadow-[0_1px_0_var(--color-line)]">Enter</kbd>
        <svg width="9" height="9" viewBox="0 0 10 10" className="animate-bounce motion-reduce:animate-none">
          <path d="M1 2 L9 2 L5 8 Z" fill="currentColor" />
        </svg>
      </span>
    </motion.div>
  );
}
