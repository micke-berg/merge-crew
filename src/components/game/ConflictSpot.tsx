"use client";

import { sideLabels, type Choice, type ConflictRegion, type ConflictSource } from "./conflicts";
import { splitLines } from "./ConflictPreview";

type SideColors = { text: string; wash: string; edge: string; dot: string };

/** Mine is the player's blue, theirs is amber. The same colours mark the lines in the preview. */
const MINE: SideColors = { text: "text-mine-text", wash: "bg-mine-wash", edge: "border-mine-edge", dot: "bg-mine-dot" };
const THEIRS: SideColors = { text: "text-theirs-text", wash: "bg-theirs-wash", edge: "border-theirs-edge", dot: "bg-theirs-dot" };

const OPTIONS: { choice: Choice; label: string }[] = [
  { choice: "ours", label: "Keep mine" },
  { choice: "theirs", label: "Keep theirs" },
  { choice: "both", label: "Keep both" },
];

/** The conflict editor: pick a side per conflict spot, or edit the whole file, then save. */
/** One conflict spot: both sides next to each other, and buttons to keep mine, theirs or both. */
export function ConflictSpot({
  region,
  total,
  source,
  choice,
  onChoose,
}: {
  region: ConflictRegion;
  total: number;
  source: ConflictSource;
  choice: Choice | undefined;
  onChoose: (c: Choice) => void;
}) {
  const labels = sideLabels(source, region.oursLabel, region.theirsLabel);
  const status =
    choice === "ours" ? "Keeping yours" : choice === "theirs" ? "Keeping theirs" : choice === "both" ? "Keeping both" : "Not picked yet";
  const titleId = `spot-${region.index}`;
  return (
    <section
      aria-labelledby={titleId}
      className={`rounded-3xl border p-3.5 transition-colors ${choice ? "border-success-edge bg-success-tint" : "border-warn-edge bg-warn-tint"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={titleId} className="text-[13px] font-bold">
          {total === 1 ? "The conflict" : `Spot ${region.index + 1} of ${total}`}
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
            choice ? "bg-success-wash text-success-deep" : "bg-warn-chip text-warn-text"
          }`}
        >
          {choice && (
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
              <path d="M2 6.4 L4.8 9 L10 3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {status}
        </span>
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        <Side label={labels.ours} text={region.ours} colors={MINE} dim={choice === "theirs"} />
        <Side label={labels.theirs} text={region.theirs} colors={THEIRS} dim={choice === "ours"} />
      </div>

      <div role="group" aria-label={`What to keep in ${total === 1 ? "the conflict" : `spot ${region.index + 1}`}`} className="mt-2.5 flex flex-wrap gap-1.5">
        {OPTIONS.map((o) => {
          const on = choice === o.choice;
          return (
            <button
              key={o.choice}
              type="button"
              aria-pressed={on}
              onClick={() => onChoose(o.choice)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all focus-visible:ring-4 focus-visible:ring-focus/30 focus-visible:outline-none ${
                on
                  ? "border-ink bg-ink text-paper shadow-[0_2px_0_var(--color-ink-shadow)]"
                  : "border-line bg-card text-body hover:-translate-y-px hover:border-line-button hover:text-ink"
              }`}
            >
              <SwatchFor choice={o.choice} />
              {o.label}
              {o.choice === "both" && <span className={`text-[11px] font-normal ${on ? "text-term-key" : "text-muted"}`}>mine first</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SwatchFor({ choice }: { choice: Choice }) {
  if (choice === "both") {
    return (
      <span className="flex" aria-hidden>
        <span className={`h-2.5 w-2.5 rounded-full border border-white ${MINE.dot}`} />
        <span className={`-ml-1 h-2.5 w-2.5 rounded-full border border-white ${THEIRS.dot}`} />
      </span>
    );
  }
  return <span className={`h-2.5 w-2.5 rounded-full border border-white ${choice === "ours" ? MINE.dot : THEIRS.dot}`} aria-hidden />;
}

function Side({ label, text, colors, dim }: { label: string; text: string; colors: SideColors; dim: boolean }) {
  const lines = splitLines(text);
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-2xl border transition-opacity ${colors.edge} ${colors.wash} ${dim ? "opacity-45" : ""}`}
    >
      <p className={`flex items-center gap-1.5 px-3 pt-2 text-[11.5px] font-bold ${colors.text}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} aria-hidden />
        <span className="truncate">{label}</span>
      </p>
      <pre className="overflow-x-auto px-3 pt-1 pb-2.5 font-mono text-[12.5px] leading-relaxed text-ink">
        {lines.length === 0 ? <span className="text-muted italic">(nothing here)</span> : lines.join("\n")}
      </pre>
    </div>
  );
}

