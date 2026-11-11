"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import type { Level, RuleCard } from "@/engine/types";
import { actorColor } from "@/lib/palette";
import { shareText } from "@/daily/daily";
import { validFileName } from "@/levels/sandbox";
import { againstPar, type ParResult } from "./moves";
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
  closeOnBackdrop = true,
  wide = false,
  className,
}: {
  children: ReactNode;
  label: string;
  onClose?: () => void;
  /** Whether a click outside the card calls onClose. Esc always does. */
  closeOnBackdrop?: boolean;
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
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
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

/** The X in a card's corner. */
function CloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-full border border-line-strong text-soft transition-colors hover:bg-sunk hover:text-ink focus-visible:ring-4 focus-visible:ring-focus/30 focus-visible:outline-none"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** The level's brief. The X and Esc go back to the level list, Start begins the level. */
export function BriefCard({
  level,
  daily,
  beat,
  onStart,
  onBack,
}: {
  level: Level;
  /** Today's incident number, when the level is played as the daily incident. */
  daily?: number;
  /** A challenge link's count to beat. */
  beat?: number | null;
  onStart: (cards: string[]) => void;
  onBack: () => void;
}) {
  const shift = level.shift;
  const [picked, setPicked] = useState<string[]>([]);
  const ready = !shift || picked.length === shift.pick;
  const toggle = (id: string) =>
    setPicked((now) => (now.includes(id) ? now.filter((c) => c !== id) : shift && now.length < shift.pick ? [...now, id] : now));
  return (
    <Modal label={`${level.title}: level brief`} wide onClose={onBack} closeOnBackdrop={false}>
      <CloseButton label="Back to all levels" onClick={onBack} />
      <p className="pr-10 text-[12px] font-bold tracking-[0.12em] text-muted uppercase">
        {daily === undefined ? `${levelLabel(level)} · ${ACT_NAMES[level.act]}` : `Today's incident · #${daily}`}
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

      {(daily !== undefined || beat) && (
        <p className="mt-3 rounded-2xl bg-sunk px-4 py-2.5 text-[14px] leading-snug text-body">
          {beat ? (
            <>
              <span className="font-bold text-ink">A challenge.</span> Someone fixed this in {beat} {beat === 1 ? "command" : "commands"}. Looking around is free. Can you match it?
            </>
          ) : (
            <>
              <span className="font-bold text-ink">The same incident for everyone today.</span>{" "}
              {level.par !== undefined && <>Par is {level.par} {level.par === 1 ? "command" : "commands"}, and looking around is free. </>}
              A new one tomorrow.
            </>
          )}
        </p>
      )}
      {level.mission ? <MissionCard mission={level.mission} /> : <p className="mt-3 text-[16px] leading-relaxed text-body">{level.brief}</p>}
      {/* A level with rule cards shows the cards here instead: the job bar lists the goals once the shift is over. */}
      {!shift && (
        <>
          <h2 className="mt-6 text-[12px] font-bold tracking-[0.12em] text-muted uppercase">Done when</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {level.goals.map((g) => (
              <li key={g.id} className="flex gap-2.5 text-[14.5px] leading-snug">
                <span className="mt-[3px] h-3.5 w-3.5 shrink-0 rounded-full border-2 border-line-strong" aria-hidden />
                {g.description}
              </li>
            ))}
          </ul>
        </>
      )}

      {shift && (
        <section aria-labelledby="rules-title" className="mt-6">
          <h2 id="rules-title" className="text-[12px] font-bold tracking-[0.12em] text-muted uppercase">
            Pick {shift.pick} house rules <span className="font-semibold tracking-normal normal-case">· {picked.length} of {shift.pick} picked</span>
          </h2>
          <p className="mt-1 text-[13.5px] leading-snug text-soft">The crew cannot break a rule you pick. Whatever is left, they will do, and you fix it.</p>
          <ul className="mt-2.5 grid gap-2 sm:grid-cols-3">
            {shift.cards.map((card) => (
              <li key={card.id}>
                <RuleCardButton card={card} on={picked.includes(card.id)} full={!picked.includes(card.id) && picked.length >= shift.pick} onToggle={() => toggle(card.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-autofocus
          disabled={!ready}
          onClick={() => onStart(picked)}
          className={`${primary} disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0`}
        >
          {shift ? "Start the shift" : "Start"}
          <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden><path d="M1.5 0.8 L9 5 L1.5 9.2 Z" fill="currentColor" /></svg>
        </button>
        <Link href="/" className={secondary}>Back to all levels</Link>
        <span className="ml-auto hidden text-[12px] text-muted sm:block">
          <kbd className="rounded-md border border-line bg-white px-1.5 py-px text-[11px]">Enter</kbd> to start
        </span>
      </div>
    </Modal>
  );
}

/** One house rule on the brief: the rule, what goes wrong without it, and the real tool that enforces it. */
function RuleCardButton({ card, on, full, onToggle }: { card: RuleCard; on: boolean; full: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-disabled={full}
      onClick={onToggle}
      className={`flex h-full w-full flex-col rounded-2xl border-2 px-3.5 py-3 text-left transition-all focus-visible:ring-4 focus-visible:ring-focus/40 focus-visible:outline-none ${
        on
          ? "-translate-y-0.5 border-ink bg-card shadow-[0_4px_0_var(--color-ink-shadow)]"
          : full
            ? "cursor-not-allowed border-line bg-sunk/50 opacity-55"
            : "border-line-strong bg-card hover:-translate-y-0.5 hover:border-ink"
      }`}
    >
      <span className="flex items-start gap-2">
        <span
          aria-hidden
          className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border-2 ${on ? "border-ink bg-ink" : "border-line-strong bg-white"}`}
        >
          {on && (
            <svg width="10" height="10" viewBox="0 0 12 12">
              <path d="M2 6.4 L4.8 9 L10 3" fill="none" stroke="white" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="text-[14.5px] leading-tight font-extrabold text-ink">{card.title}</span>
      </span>
      <span className="mt-1.5 block text-[12.5px] leading-snug text-body">{card.text}</span>
      <span className="mt-auto block pt-2 text-[11.5px] leading-snug text-soft">
        <span className="font-bold">In real life:</span> {card.tool}
      </span>
    </button>
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

/** What the "next" button calls the level after this one: practice or a level, and which act if it changes. */
export function nextLabel(level: Level, next: Level): string {
  const kind = next.usedIn ? "practice" : "level";
  const act = next.act !== level.act ? ` (Act ${next.act})` : "";
  return `Next ${kind}: ${next.title}${act}`;
}

const PAR_TEXT: Record<ParResult, string> = { under: "Under par", on: "On par", over: "Over par" };

/** The win card. The X and Esc close it, so the player can look at the finished map. */
export function WinCard({
  level,
  moves,
  cards = [],
  hints = 0,
  beat = null,
  daily,
  next,
  tryIt,
  onReplay,
  onClose,
}: {
  level: Level;
  /** Act 3: the ids of the house rules the player picked. */
  cards?: readonly string[];
  /** Hints asked for in this run. */
  hints?: number;
  /** A challenge link's count to beat. */
  beat?: number | null;
  /** Set when the level was played as the daily incident. */
  daily?: { number: number; streak: number; best: number };
  /** The commands that counted, in the order the player ran them. */
  moves: readonly string[];
  next: Level | null;
  /** A later level that uses this practice level's tool for real. */
  tryIt: Level | null;
  onReplay: () => void;
  onClose: () => void;
}) {
  const arrow = (
    <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden><path d="M1.5 0.8 L9 5 L1.5 9.2 Z" fill="currentColor" /></svg>
  );
  const count = moves.length;
  const result = level.par === undefined ? null : againstPar(count, level.par);
  // Built on click, in the browser: the link has to carry this page's own address.
  const origin = () => window.location.origin;
  const resultText = () =>
    shareText({ number: daily?.number, title: level.title, moves: count, par: level.par, hints, url: daily ? `${origin()}/daily` : `${origin()}/level/${level.id}?beat=${count}` });
  return (
    <Modal label={`${level.title}: level complete`} onClose={onClose} closeOnBackdrop={false}>
      <CloseButton label="Close and look at the map" onClick={onClose} />
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

      {level.learned && (
        <div className="mt-4 rounded-2xl border border-success-edge bg-success-tint px-4 py-3">
          <p className="text-[11px] font-bold tracking-[0.12em] text-success-deep uppercase">What you learned</p>
          <p className="mt-0.5 text-[15px] leading-snug text-ink">{level.learned}</p>
        </div>
      )}

      {level.shift && cards.length > 0 && (
        <div className="mt-3 rounded-2xl border border-line bg-card px-4 py-3">
          <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">Your house rules, and the real tool for each</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {level.shift.cards.filter((c) => cards.includes(c.id)).map((c) => (
              <li key={c.id} className="text-[13.5px] leading-snug">
                <span className="font-bold text-ink">{c.title}.</span> <span className="text-body">{c.tool}.</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 rounded-2xl border border-line bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <p className="text-[14.5px] font-bold text-ink">
            {count} {count === 1 ? "command" : "commands"}
            {level.par !== undefined && <span className="font-semibold text-soft"> · par {level.par}</span>}
          </p>
          {result && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
                result === "over" ? "bg-sunk text-soft" : "bg-success-strong text-white"
              }`}
            >
              {PAR_TEXT[result]}
            </span>
          )}
          <span className="ml-auto text-[12px] text-muted">Looking around is free</span>
        </div>
        {count > 0 && (
          <ol className="mt-2 max-h-[7.5rem] overflow-y-auto rounded-xl bg-ink px-3 py-2 font-mono text-[12.5px] leading-relaxed text-paper" aria-label="The commands you ran">
            {moves.map((m, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="w-4 shrink-0 text-right text-term-muted select-none" aria-hidden>{i + 1}</span>
                <span className="break-all whitespace-pre-wrap">{m}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {(daily || beat !== null) && (
        <p className="mt-3 text-center text-[14px] font-semibold text-ink">
          {daily ? (
            <>
              {daily.streak > 1 ? `${daily.streak} days in a row.` : "First day of a new streak."}{" "}
              <span className="font-normal text-soft">A new incident tomorrow.</span>
            </>
          ) : beat !== null && count <= beat ? (
            count < beat ? `You beat the challenge: ${count} against ${beat}.` : `You matched the challenge: ${count} commands.`
          ) : (
            <span className="text-soft">The challenge was {beat}. You took {count}.</span>
          )}
        </p>
      )}
      {count > 0 && <CopyButton text={resultText} label={daily ? "Copy my result" : "Challenge a friend"} hint={daily ? "No spoilers in it" : "Copies a link with your count to beat"} />}

      <div className="mt-6 flex flex-col items-center gap-3">
        {daily ? (
          <Link href="/" data-autofocus className={`${primary} w-full sm:w-auto`}>
            Back to all levels
          </Link>
        ) : tryIt ? (
          <>
            <Link href={`/level/${tryIt.id}`} data-autofocus className={`${primary} w-full sm:w-auto`}>
              Try it for real: {tryIt.title}
              {arrow}
            </Link>
            {next && next.id !== tryIt.id && (
              <Link href={`/level/${next.id}`} className={secondary}>{nextLabel(level, next)}</Link>
            )}
          </>
        ) : next ? (
          <Link href={`/level/${next.id}`} data-autofocus className={`${primary} w-full sm:w-auto`}>
            {nextLabel(level, next)}
            {arrow}
          </Link>
        ) : (
          <Link href="/" data-autofocus className={`${primary} w-full sm:w-auto`}>
            Back to all levels
          </Link>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onReplay} className={secondary}>{result === "over" ? "Try for par" : "Play again"}</button>
          {(next || tryIt) && !daily && <Link href="/" className={secondary}>Back to all levels</Link>}
        </div>
      </div>
    </Modal>
  );
}

/**
 * A plain editor for one of the player's working files (the sandbox). With no `path` it also asks for
 * a file name and makes a new file. Saving writes the working file only: staging and committing stay
 * with the player's git commands.
 */
export function FileEditor({
  path,
  content = "",
  taken = [],
  onSave,
  onClose,
}: {
  /** The file being edited. Left out for a new file. */
  path?: string;
  content?: string;
  /** File names that already exist, for a new file. */
  taken?: readonly string[];
  onSave: (path: string, content: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(path ?? "");
  const [text, setText] = useState(content);
  const fresh = path === undefined;
  const problem = !fresh || name === ""
    ? null
    : !validFileName(name)
      ? "Use letters, digits, dots and dashes. Folders with a slash are fine."
      : taken.includes(name)
        ? "That file already exists. Click it in the list to edit it."
        : null;
  const ready = name !== "" && problem === null;
  const save = () => {
    if (ready) onSave(name, text === "" || text.endsWith("\n") ? text : `${text}\n`);
  };
  return (
    <Modal label={fresh ? "New file" : `Edit ${path}`} onClose={onClose} closeOnBackdrop={false}>
      <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">{fresh ? "New file" : "Working file"}</p>
      {fresh ? (
        <>
          <label htmlFor="new-file-name" className="sr-only">File name</label>
          <input
            id="new-file-name"
            data-autofocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="menu.txt"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="mt-1 w-full rounded-xl border border-line-strong bg-card px-3 py-2 font-mono text-[15px] font-bold text-ink focus-visible:ring-4 focus-visible:ring-focus/30 focus-visible:outline-none"
          />
          <p className="mt-1 min-h-[1.2em] text-[12px] text-warn-deep" aria-live="polite">{problem}</p>
        </>
      ) : (
        <h2 className="mt-1 truncate font-mono text-lg font-bold">{path}</h2>
      )}
      <label htmlFor="file-text" className="sr-only">File contents</label>
      <textarea
        id="file-text"
        {...(fresh ? {} : { "data-autofocus": true })}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        spellCheck={false}
        maxLength={4000}
        className="mt-2 w-full resize-y rounded-2xl bg-ink px-4 py-3 font-mono text-[13px] leading-relaxed text-paper caret-term-prompt focus-visible:ring-4 focus-visible:ring-focus/40 focus-visible:outline-none"
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={!ready} className={`${primary} disabled:cursor-not-allowed disabled:opacity-45`}>
          Save file
        </button>
        <button type="button" onClick={onClose} className={secondary}>Cancel</button>
        <span className="ml-auto text-[12px] text-muted">Saving changes the file. git add and git commit are still yours.</span>
      </div>
    </Modal>
  );
}

/** Copies a line of text for the player to paste somewhere. Shows the text itself when the browser refuses. */
function CopyButton({ text, label, hint }: { text: () => string; label: string; hint: string }) {
  const [state, setState] = useState<"idle" | "copied" | "shown">("idle");
  const [shown, setShown] = useState("");
  const copy = async () => {
    const value = text();
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setShown(value);
      setState("shown");
    }
  };
  return (
    <div className="mt-3 flex flex-col items-center gap-1.5">
      <button type="button" onClick={copy} className={secondary}>
        {state === "copied" ? "Copied. Paste it anywhere" : label}
      </button>
      <p className="text-[12px] text-muted" aria-live="polite">
        {state === "shown" ? "Copy it from here:" : hint}
      </p>
      {state === "shown" && (
        <textarea readOnly value={shown} rows={2} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-xl border border-line bg-card px-3 py-2 font-mono text-[12px] text-ink" aria-label="Your result" />
      )}
    </div>
  );
}

export function FileViewer({
  path,
  area,
  owner,
  content,
  onClose,
}: {
  path: string;
  area: "working" | "staged";
  /** The robot whose folder the file is in. Left out for the player's own files. */
  owner?: string;
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
            {owner ? `${owner}'s folder · ` : ""}
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
