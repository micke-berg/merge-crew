"use client";

import { useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { actorColor } from "@/components/map/palette";
import type { TermLine } from "./game";

export type TerminalHandle = { focus: () => void };

type Props = {
  log: TermLine[];
  /** The player may type. */
  active: boolean;
  /** Shown in the prompt, e.g. "main" or "detached 1a2b3c4". */
  where: string;
  suggestions: string[];
  onRun: (line: string) => void;
  ref?: React.Ref<TerminalHandle>;
  /** Shown instead of the input and suggestions while a scene plays (the crew's dialogue). */
  scene?: ReactNode;
};

function promptName(actor: string) {
  return actor === "player" ? "you" : actorColor(actor).name.toLowerCase();
}

/** The command box: scrollback, a real input with history, and suggestion buttons. */
export function Terminal({ log, active, where, suggestions, onRun, ref, scene }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  // Position while browsing history with the arrow keys; history.length means "the draft".
  const [cursor, setCursor] = useState(0);
  const [draft, setDraft] = useState("");

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  useEffect(() => {
    if (active) inputRef.current?.focus({ preventScroll: true });
  }, [active]);

  const submit = () => {
    const line = value.trim();
    if (!active) return;
    if (line) {
      const next = history.at(-1) === line ? history : [...history, line];
      setHistory(next);
      setCursor(next.length);
    }
    setDraft("");
    setValue("");
    onRun(line);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "ArrowUp") {
      if (!history.length) return;
      e.preventDefault();
      const at = cursor >= history.length ? history.length : cursor;
      if (at === history.length) setDraft(value);
      const next = Math.max(0, at - 1);
      setCursor(next);
      setValue(history[next]);
    } else if (e.key === "ArrowDown") {
      if (cursor >= history.length) return;
      e.preventDefault();
      const next = cursor + 1;
      setCursor(next);
      setValue(next >= history.length ? draft : history[next]);
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      onRun("clear");
    }
  };

  const fill = (s: string) => {
    setValue(s);
    setCursor(history.length);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(s.length, s.length);
    });
  };

  return (
    <section
      aria-label="Command box"
      className={`flex min-h-0 flex-col rounded-3xl bg-[#26283B] p-2.5 text-[#F7F1E5] shadow-[0_10px_30px_-12px_rgba(20,20,40,0.6)] transition-shadow duration-300 ${
        active ? "ring-2 ring-[#7FD1B9]/70 ring-offset-2 ring-offset-[#EAE1D0]" : ""
      }`}
    >
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Terminal output"
        onClick={() => {
          if (active && !window.getSelection()?.toString()) inputRef.current?.focus();
        }}
        className="term-scroll min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-1 font-mono text-[13px] leading-[1.55]"
      >
        {log.length === 0 && (
          <p className="text-[#8D90A8]">{active ? "Type a git command and press Enter." : "The crew's commands appear here."}</p>
        )}
        {log.map((l) => {
          if (l.kind === "note") {
            return (
              <p key={l.id} className="my-1.5 flex items-center gap-2 text-[12px] font-semibold text-[#7FD1B9]">
                <span className="h-px w-4 bg-[#7FD1B9]/50" aria-hidden />
                {l.text}
              </p>
            );
          }
          const robot = l.actor !== "player" || !!l.scripted;
          if (l.kind === "command") {
            const c = actorColor(l.actor);
            return (
              <p key={l.id} className={`mt-1.5 break-words whitespace-pre-wrap first:mt-0 ${robot ? "opacity-80" : ""}`}>
                <span style={{ color: robot ? lighten(c.line) : "#7FD1B9" }}>
                  {promptName(l.actor)}@{l.path}
                </span>
                <span className="text-[#8D90A8]"> $ </span>
                <span className="text-[#F7F1E5]">{l.text}</span>
              </p>
            );
          }
          const tone =
            l.kind === "error" ? "text-[#FF9C85]" : l.kind === "hint" ? "text-[#E9C46A]" : robot ? "text-[#A9ABBF]" : "text-[#D9DBE8]";
          return (
            <p key={l.id} className={`break-words whitespace-pre-wrap ${tone} ${robot ? "opacity-80" : ""}`}>
              {l.text}
            </p>
          );
        })}
      </div>

      {scene ? (
        <div className="mt-1.5">{scene}</div>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className={`mt-1.5 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 font-mono text-[14px] transition-colors ${
              active ? "bg-[#1B1D2C]" : "bg-[#1B1D2C]/60"
            }`}
          >
            <label htmlFor="git-command" className="shrink-0 whitespace-nowrap">
              <span className="text-[#7FD1B9]">you@/repo</span>
              <span className="text-[#E9C46A]"> ({where})</span>
              <span className="text-[#8D90A8]"> $</span>
              <span className="sr-only"> git command</span>
            </label>
            <input
              ref={inputRef}
              id="git-command"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setCursor(history.length);
              }}
              onKeyDown={onKeyDown}
              disabled={!active}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={active ? "git status" : "watch the crew…"}
              className="min-w-0 flex-1 bg-transparent text-[#F7F1E5] caret-[#7FD1B9] outline-none placeholder:text-[#5E6178] disabled:cursor-not-allowed"
            />
            <kbd
              className={`hidden rounded-md border border-[#44475F] px-1.5 py-px font-sans text-[10px] font-semibold text-[#8D90A8] transition-opacity sm:block ${
                value ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden
            >
              Enter
            </kbd>
          </form>

          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1" aria-label="Suggested commands">
              <span className="mr-1 text-[11px] font-semibold tracking-wide text-[#8D90A8] uppercase">Try</span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!active}
                  onClick={() => fill(s)}
                  className="rounded-full border border-[#44475F] px-3 py-1 font-mono text-[12px] text-[#C9CBDA] transition-colors hover:border-[#7FD1B9] hover:text-[#F7F1E5] focus-visible:border-[#7FD1B9] focus-visible:ring-2 focus-visible:ring-[#7FD1B9]/50 focus-visible:outline-none disabled:opacity-40 disabled:hover:border-[#44475F]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Robot colours are tuned for paper; lift them a little for the dark terminal. */
function lighten(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.35);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r} ${g} ${b})`;
}
