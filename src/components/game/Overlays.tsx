"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useEffectEvent, useRef, type ReactNode } from "react";
import type { Level } from "@/engine/types";
import { actorColor } from "@/lib/palette";
import { RobotPortrait } from "./RobotPortrait";

export const ACT_NAMES: Record<number, string> = { 1: "Learn", 2: "Fix", 3: "Lead" };

export function levelLabel(level: Level) {
  return `Act ${level.act} · Level ${level.order}`;
}

const FOCUSABLE = "button, a[href], input, textarea, select, [tabindex]:not([tabindex='-1'])";

/** A centred card over a dimmed screen. Esc calls onClose when given. */
export function Modal({
  children,
  label,
  onClose,
  wide = false,
  className,
}: {
  children: ReactNode;
  label: string;
  onClose?: () => void;
  wide?: boolean;
  /** Replaces the card's width and padding classes, for bigger panels such as the conflict editor. */
  className?: string;
}) {
  const close = useEffectEvent(() => onClose?.());
  const hasClose = useEffectEvent(() => onClose !== undefined);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // autoFocus does not reach links, so focus the marked control (or the first one) by hand.
    const card = cardRef.current;
    const target = card?.querySelector<HTMLElement>("[data-autofocus]") ?? card?.querySelector<HTMLElement>("button, a[href]");
    target?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && hasClose()) {
        e.preventDefault();
        close();
      } else if (e.key === "Tab") {
        // Keep focus inside the dialog.
        const card = cardRef.current;
        if (!card) return;
        const items = [...card.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute("disabled"));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !card.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !card.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-overlay/35 p-4 backdrop-blur-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className={`relative w-full ${className ?? `${wide ? "max-w-xl" : "max-w-lg"} p-6 md:p-8`} rounded-[28px] border border-line bg-card text-ink shadow-[0_30px_80px_-20px_rgba(60,44,20,0.55)]`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export const primary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-[15px] font-bold text-paper shadow-[0_3px_0_var(--color-ink-shadow)] transition-transform hover:-translate-y-px active:translate-y-px focus-visible:ring-4 focus-visible:ring-focus/40 focus-visible:outline-none";
export const secondary =
  "inline-flex items-center justify-center rounded-full border border-line-strong px-4 py-2.5 text-sm font-semibold text-soft transition-colors hover:bg-sunk hover:text-ink focus-visible:ring-4 focus-visible:ring-focus/30 focus-visible:outline-none";

export function BriefCard({ level, onStart }: { level: Level; onStart: () => void }) {
  return (
    <Modal label={`${level.title}: level brief`} wide>
      <p className="text-[12px] font-bold tracking-[0.12em] text-muted uppercase">
        {levelLabel(level)} · {ACT_NAMES[level.act]}
      </p>
      <h1 className="mt-1.5 text-3xl leading-tight font-extrabold tracking-tight md:text-[34px]">{level.title}</h1>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["player", ...level.crew] as const).map((a) => (
          <div key={a} className="flex items-center gap-2 rounded-full bg-sunk py-1 pr-3.5 pl-1">
            <RobotPortrait actor={a} size={34} still />
            <span className="text-[13px] font-semibold" style={{ color: actorColor(a).deep }}>
              {actorColor(a).name}
            </span>
          </div>
        ))}
      </div>

      {level.mission ? <MissionCard mission={level.mission} /> : <p className="mt-3 text-[16px] leading-relaxed text-body">{level.brief}</p>}
      <h2 className="mt-6 text-[12px] font-bold tracking-[0.12em] text-muted uppercase">Done when</h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {level.goals.map((g) => (
          <li key={g.id} className="flex gap-2.5 text-[14.5px] leading-snug">
            <span className="mt-[3px] h-3.5 w-3.5 shrink-0 rounded-full border-2 border-line-strong" aria-hidden />
            {g.description}
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button type="button" data-autofocus onClick={onStart} className={primary}>
          Start
          <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden><path d="M1.5 0.8 L9 5 L1.5 9.2 Z" fill="currentColor" /></svg>
        </button>
        <Link href="/" className={secondary}>All levels</Link>
        <span className="ml-auto hidden text-[12px] text-muted sm:block">
          <kbd className="rounded-md border border-line bg-white px-1.5 py-px text-[11px]">Enter</kbd> to start
        </span>
      </div>
    </Modal>
  );
}

/** The level's mission in plain words: what is going on, what the player does, what they practise. */
function MissionCard({ mission }: { mission: NonNullable<Level["mission"]> }) {
  return (
    <dl className="mt-4 flex flex-col gap-3">
      <div>
        <dt className="text-[12px] font-bold tracking-[0.12em] text-muted uppercase">{"What's going on"}</dt>
        <dd className="mt-0.5 text-[15.5px] leading-snug text-body">{mission.situation}</dd>
      </div>
      <div className="rounded-2xl border-2 border-ink bg-card px-4 py-3">
        <dt className="text-[12px] font-bold tracking-[0.12em] text-ink uppercase">Your job</dt>
        <dd className="mt-0.5 text-[16.5px] leading-snug font-bold text-ink">{mission.job}</dd>
      </div>
      <div>
        <dt className="text-[12px] font-bold tracking-[0.12em] text-muted uppercase">{"You'll practise"}</dt>
        <dd className="mt-1.5 flex flex-wrap gap-1.5">
          {mission.practise.map((c) => (
            <code key={c} className="rounded-lg bg-ink px-2 py-0.5 font-mono text-[12.5px] text-paper">{c}</code>
          ))}
        </dd>
      </div>
    </dl>
  );
}

export function WinCard({
  level,
  commands,
  next,
  onReplay,
}: {
  level: Level;
  commands: number;
  next: Level | null;
  onReplay: () => void;
}) {
  return (
    <Modal label={`${level.title}: level complete`}>
      <div className="flex justify-center gap-1">
        {(["player", ...level.crew] as const).map((a, i) => (
          <motion.span
            key={a}
            initial={{ y: 0 }}
            animate={{ y: [0, -14, 0] }}
            transition={{ delay: 0.25 + i * 0.12, duration: 0.6, repeat: 2, repeatDelay: 0.9, ease: "easeOut" }}
          >
            <RobotPortrait actor={a} mood="celebrate" rest="happy" size={72} />
          </motion.span>
        ))}
      </div>
      <p className="mt-5 text-center text-[12px] font-bold tracking-[0.12em] text-success-strong uppercase">Level complete</p>
      <h1 className="mt-1 text-center text-3xl font-extrabold tracking-tight">{level.title}</h1>
      <p className="mt-2 text-center text-[15px] text-soft">
        Done in {commands} {commands === 1 ? "command" : "commands"}.
      </p>
      <div className="mt-7 flex flex-col items-center gap-3">
        {next ? (
          <Link href={`/level/${next.id}`} data-autofocus className={`${primary} w-full sm:w-auto`}>
            Next level: {next.title}
            <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden><path d="M1.5 0.8 L9 5 L1.5 9.2 Z" fill="currentColor" /></svg>
          </Link>
        ) : (
          <Link href="/" data-autofocus className={`${primary} w-full sm:w-auto`}>
            Back to all levels
          </Link>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onReplay} className={secondary}>Play again</button>
          {next && <Link href="/" className={secondary}>All levels</Link>}
        </div>
      </div>
    </Modal>
  );
}

export function FileViewer({
  path,
  area,
  content,
  onClose,
}: {
  path: string;
  area: "working" | "staged";
  content: string;
  onClose: () => void;
}) {
  const lines = content.endsWith("\n") ? content.slice(0, -1).split("\n") : content.split("\n");
  const marker = /^(<{7}|={7}|>{7})( |$)/;
  return (
    <Modal label={`${path}, read-only`} onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">
            {area === "staged" ? "Staged version" : "Working file"} · read-only
          </p>
          <h2 className="mt-1 truncate font-mono text-lg font-bold">{path}</h2>
        </div>
        <button type="button" data-autofocus onClick={onClose} className={secondary} aria-label="Close file">
          Close <kbd className="ml-2 rounded border border-line px-1 text-[10px]">Esc</kbd>
        </button>
      </div>
      <pre className="mt-4 max-h-[50dvh] overflow-auto rounded-2xl bg-ink py-3 font-mono text-[13px] leading-relaxed text-paper">
        {lines.length === 1 && lines[0] === "" ? (
          <span className="px-4 text-term-muted">(empty file)</span>
        ) : (
          lines.map((l, i) => (
            <div key={i} className={`flex px-4 ${marker.test(l) ? "bg-warn/30 text-warn-glow" : ""}`}>
              <span className="mr-4 w-6 shrink-0 text-right text-term-muted select-none">{i + 1}</span>
              <span className="whitespace-pre-wrap">{l || " "}</span>
            </div>
          ))
        )}
      </pre>
    </Modal>
  );
}
