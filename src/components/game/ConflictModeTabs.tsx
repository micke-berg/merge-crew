"use client";

import type { ReactNode } from "react";

/** The switch between picking a side per spot and editing the whole file. */
export function ConflictModeTabs({
  mode,
  canPick,
  pickBlockedReason,
  onPick,
  onText,
}: {
  mode: "pick" | "text";
  canPick: boolean;
  /** Why picking is off, shown as a tooltip. */
  pickBlockedReason?: string;
  onPick: () => void;
  onText: () => void;
}) {
  return (
    <div role="group" aria-label="How to fix it" className="inline-flex rounded-full bg-wash p-1">
      <ModeTab selected={mode === "pick"} disabled={!canPick} title={pickBlockedReason} onClick={onPick} autoFocus={mode === "pick"}>
        Pick per spot
      </ModeTab>
      <ModeTab selected={mode === "text"} onClick={onText} autoFocus={mode === "text"}>
        Edit the whole file
      </ModeTab>
    </div>
  );
}

function ModeTab({
  selected,
  disabled = false,
  title,
  onClick,
  autoFocus,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  autoFocus: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      title={title}
      onClick={onClick}
      data-autofocus={autoFocus ? "" : undefined}
      className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors focus-visible:ring-4 focus-visible:ring-focus/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
        selected ? "bg-card text-ink shadow-sm" : "text-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

