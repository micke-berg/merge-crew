"use client";

import { resolveRegion, type Choice, type Segment } from "./conflicts";

type Tone = "plain" | "ours" | "theirs" | "conflict";

/** The lines of a file, without the final newline and carriage returns. */
export function splitLines(text: string): string[] {
  if (text === "") return [];
  return (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n").map((l) => l.replace(/\r$/, ""));
}

const MARKER = /^(<{7}|={7}|>{7}|\|{7})( |$)/;

/** The resolved file with each line coloured by where it came from. */
export function ConflictPreview({
  segments,
  choices,
  text,
}: {
  segments: Segment[];
  choices: Record<number, Choice | undefined>;
  /** The free-text result; when set, lines are coloured only by whether they are markers. */
  text: string | null;
}) {
  const rows: { text: string; tone: Tone }[] = [];
  if (text !== null) {
    for (const l of splitLines(text)) rows.push({ text: l, tone: MARKER.test(l) ? "conflict" : "plain" });
  } else {
    for (const s of segments) {
      if (s.kind === "text") {
        for (const l of splitLines(s.text)) rows.push({ text: l, tone: "plain" });
        continue;
      }
      const choice = choices[s.index];
      if (!choice) {
        for (const l of splitLines(s.raw)) rows.push({ text: l, tone: "conflict" });
      } else if (choice === "both") {
        for (const l of splitLines(s.ours)) rows.push({ text: l, tone: "ours" });
        for (const l of splitLines(s.theirs)) rows.push({ text: l, tone: "theirs" });
      } else {
        for (const l of splitLines(resolveRegion(s, choice))) rows.push({ text: l, tone: choice });
      }
    }
  }

  const tone: Record<Tone, string> = {
    plain: "",
    ours: "bg-mine-dot/25 shadow-[inset_3px_0_0_var(--color-mine-mark)]",
    theirs: "bg-theirs-fill/25 shadow-[inset_3px_0_0_var(--color-theirs-mark)]",
    conflict: "bg-warn/30 text-warn-glow",
  };

  return (
    <pre
      aria-label="Preview of the saved file"
      className="mt-2 max-h-[52dvh] min-h-[160px] flex-1 overflow-auto rounded-2xl bg-ink py-3 font-mono text-[12.5px] leading-relaxed text-paper"
    >
      {rows.length === 0 ? (
        <span className="px-4 text-term-muted">(empty file)</span>
      ) : (
        rows.map((r, i) => (
          <div key={i} className={`flex px-4 transition-colors ${tone[r.tone]}`}>
            <span className="mr-4 w-6 shrink-0 text-right text-term-muted select-none">{i + 1}</span>
            <span className="whitespace-pre-wrap">{r.text || " "}</span>
          </div>
        ))
      )}
    </pre>
  );
}

/** Which colour is which side, above the preview. */
export function ConflictLegend({ ours, theirs }: { ours: string; theirs: string }) {
  return (
    <p className="hidden items-center gap-2.5 text-[11px] text-muted sm:flex">
      <span className="flex items-center gap-1" title={ours}>
        <span className="h-2 w-2 rounded-full bg-mine-dot" aria-hidden />
        mine
      </span>
      <span className="flex items-center gap-1" title={theirs}>
        <span className="h-2 w-2 rounded-full bg-theirs-dot" aria-hidden />
        theirs
      </span>
    </p>
  );
}

