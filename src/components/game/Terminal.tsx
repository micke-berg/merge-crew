"use client";

import { useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { TOKENS, actorColor, lighten } from "@/lib/palette";
import type { TermLine } from "./game";

export type TerminalHandle = { focus: () => void };

type Props = {
  log: TermLine[];
  /** The player may type. */
  active: boolean;
  /** Shown in the prompt, e.g. "main" or "detached 1a2b3c4". */
  where: string;
  /** The player's worktree path, e.g. "/repo". */
  path: string;
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
export function Terminal({ log, active, where, path, suggestions, onRun, ref, scene }: Props) {
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
      className={`flex min-h-0 flex-col rounded-3xl bg-ink p-2.5 text-paper shadow-[0_10px_30px_-12px_rgba(20,20,40,0.6)] transition-shadow duration-300 ${
        active ? "ring-2 ring-term-prompt/70 ring-offset-2 ring-offset-desk" : ""
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
          <p className="text-term-muted">{active ? "Type a git command and press Enter." : "The crew's commands appear here."}</p>
        )}
        {log.map((l) => {
          if (l.kind === "note") {
            return (
              <p key={l.id} className="my-1.5 flex items-center gap-2 text-[12px] font-semibold text-term-prompt">
                <span className="h-px w-4 bg-term-prompt/50" aria-hidden />
                {l.text}
              </p>
            );
          }
          const robot = l.actor !== "player" || !!l.scripted;
          if (l.kind === "command") {
            const c = actorColor(l.actor);
            return (
              <p key={l.id} className={`mt-1.5 break-words whitespace-pre-wrap first:mt-0 ${robot ? "opacity-80" : ""}`}>
                <span style={{ color: robot ? lighten(c.line) : TOKENS["term-prompt"] }}>
                  {promptName(l.actor)}@{l.path}
                </span>
                <span className="text-term-muted"> $ </span>
                <span className="text-paper">{l.text}</span>
              </p>
            );
          }
          const tone =
            l.kind === "error" ? "text-term-error" : l.kind === "hint" ? "text-term-hint" : robot ? "text-term-dim" : "text-term-out";
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
              active ? "bg-term-deep" : "bg-term-deep/60"
            }`}
          >
            <label htmlFor="git-command" className="shrink-0 whitespace-nowrap">
              <span className="text-term-prompt">you@{path}</span>
              <span className="text-term-hint"> ({where})</span>
              <span className="text-term-muted"> $</span>
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
              className="min-w-0 flex-1 bg-transparent text-paper caret-term-prompt outline-none placeholder:text-term-muted disabled:cursor-not-allowed"
            />
            <kbd
              className={`hidden rounded-md border border-term-edge px-1.5 py-px font-sans text-[10px] font-semibold text-term-muted transition-opacity sm:block ${
                value ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden
            >
              Enter
            </kbd>
          </form>

          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1" aria-label="Suggested commands">
              <span className="mr-1 text-[11px] font-semibold tracking-wide text-term-muted uppercase">Try</span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!active}
                  onClick={() => fill(s)}
                  className="rounded-full border border-term-edge px-3 py-1 font-mono text-[12px] text-term-key transition-colors hover:border-term-prompt hover:text-paper focus-visible:border-term-prompt focus-visible:ring-2 focus-visible:ring-term-prompt/50 focus-visible:outline-none disabled:opacity-40 disabled:hover:border-term-edge"
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
