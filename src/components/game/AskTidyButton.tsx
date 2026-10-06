"use client";

import { actorColor } from "@/lib/palette";
import { MAX_HINTS_PER_RUN } from "@/hints/types";

type Props = {
  /** Hints left in this run. */
  left: number;
  /** True during the player turn. Hints are about the player's next move, so scenes have none. */
  playing: boolean;
  /** Tidy is working on a hint right now. */
  thinking: boolean;
  onAsk: () => void;
};

const tidy = actorColor("tidy");

/** "Ask Tidy": next to the job bar, shows the hints left, and says why when there are none. */
export function AskTidyButton({ left, playing, thinking, onAsk }: Props) {
  const none = left <= 0;
  const disabled = none || !playing;
  const reason = none
    ? `You've used all ${MAX_HINTS_PER_RUN} hints for this run. Restart the level for a fresh set.`
    : !playing
      ? "Tidy gives hints on your turn."
      : thinking
        ? "Tidy is thinking…"
        : `Ask Tidy for a hint. ${left} of ${MAX_HINTS_PER_RUN} left.`;
  return (
    <button
      type="button"
      onClick={() => {
        if (!thinking) onAsk();
      }}
      disabled={disabled}
      aria-busy={thinking || undefined}
      aria-label={none ? "No hints left" : `Ask Tidy for a hint, ${left} left`}
      aria-describedby={none ? "ask-tidy-reason" : undefined}
      title={reason}
      className="group flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 px-3 py-2 text-[14px] font-bold transition-[transform,box-shadow,opacity] duration-150 hover:-translate-y-px hover:shadow-[0_6px_16px_-8px_rgba(11,107,88,0.6)] focus-visible:ring-4 focus-visible:ring-focus/40 focus-visible:outline-none active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-none"
      style={{ borderColor: tidy.line, backgroundColor: tidy.tint, color: tidy.deep }}
    >
      <Bulb thinking={thinking} />
      <span className="whitespace-nowrap">{none ? "No hints left" : thinking ? "Thinking…" : "Ask Tidy"}</span>
      {!none && (
        <span
          className="rounded-full bg-white px-1.5 py-px text-[11px] leading-4 font-extrabold tabular-nums"
          style={{ color: tidy.deep }}
          aria-hidden
        >
          {left}
          <span className="hidden sm:inline"> left</span>
        </span>
      )}
      {none && (
        <span id="ask-tidy-reason" className="sr-only">
          {reason}
        </span>
      )}
    </button>
  );
}

function Bulb({ thinking }: { thinking: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden
      className={thinking ? "animate-pulse motion-reduce:animate-none" : "transition-transform duration-200 group-hover:-rotate-12"}
    >
      <path
        d="M8 1.5a4.5 4.5 0 0 0-2.6 8.2c.4.3.6.7.6 1.1V12h4v-1.2c0-.4.2-.8.6-1.1A4.5 4.5 0 0 0 8 1.5Z"
        fill={thinking ? tidy.line : "white"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M6.3 14.3h3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
