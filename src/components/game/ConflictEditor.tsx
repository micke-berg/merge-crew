"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { ConflictEntry } from "@/engine/types";
import {
  conflictRegions,
  hasConflictMarkers,
  parseConflicts,
  resolveConflicts,
  resolveRegion,
  sideLabels,
  type Choice,
  type ConflictRegion,
  type ConflictSource,
  type Segment,
} from "./conflicts";
import { Modal, primary, secondary } from "./Overlays";
import { RobotPortrait } from "./RobotPortrait";

type Props = {
  path: string;
  /** The working file, markers and all. undefined when the file is missing from the working files. */
  content: string | undefined;
  entry: ConflictEntry | undefined;
  source: ConflictSource;
  onSave: (content: string) => void;
  onClose: () => void;
};

type Tone = "plain" | "ours" | "theirs" | "conflict";

const MINE = { text: "#1D4FA3", wash: "#EAF1FC", edge: "#B9CEF2", dot: "#2563C9" };
const THEIRS = { text: "#7A4A00", wash: "#FDF4E3", edge: "#EBCD97", dot: "#C98500" };

const OPTIONS: { choice: Choice; label: string }[] = [
  { choice: "ours", label: "Keep mine" },
  { choice: "theirs", label: "Keep theirs" },
  { choice: "both", label: "Keep both" },
];

/** The conflict editor: pick a side per conflict spot, or edit the whole file, then save. */
export function ConflictEditor({ path, content, entry, source, onSave, onClose }: Props) {
  const original = content ?? "";
  const segments = useMemo(() => parseConflicts(original), [original]);
  const regions = conflictRegions(segments);
  const [choices, setChoices] = useState<Record<number, Choice | undefined>>({});
  const [mode, setMode] = useState<"pick" | "text">(regions.length > 0 ? "pick" : "text");
  const [text, setText] = useState(original);
  const [confirming, setConfirming] = useState(false);

  const picked = resolveConflicts(segments, choices);
  const result = mode === "pick" ? picked : text;
  const markersLeft = hasConflictMarkers(result);
  // Text typed by hand cannot be mapped back onto the spots, so the pick view stays closed after that.
  const handEdited = mode === "text" && text !== picked;
  const open = regions.filter((r) => !choices[r.index]).length;
  const labels = regions[0] ? sideLabels(source, regions[0].oursLabel, regions[0].theirsLabel) : sideLabels(source, "", "");

  const toText = () => {
    setText(picked);
    setMode("text");
    setConfirming(false);
  };
  const toPick = () => {
    setMode("pick");
    setConfirming(false);
  };
  const choose = (index: number, choice: Choice) => {
    setChoices((c) => ({ ...c, [index]: c[index] === choice ? undefined : choice }));
    setConfirming(false);
  };
  const save = () => {
    if (markersLeft && !confirming) {
      setConfirming(true);
      return;
    }
    onSave(result);
  };

  const deleted = entry && (entry.ours === null || entry.theirs === null)
    ? entry.ours === null
      ? "Your side deleted this file and the other side changed it."
      : "The other side deleted this file and your side changed it."
    : null;

  return (
    <Modal label={`Fix the conflict in ${path}`} onClose={onClose} className="max-w-5xl p-5 md:p-7">
      {/* header */}
      <div className="flex items-start gap-3.5">
        <RobotPortrait actor="tidy" size={52} still className="hidden shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-[0.12em] text-[#C2410C] uppercase">Fix a conflict</p>
          <h2 className="mt-0.5 truncate font-mono text-xl font-bold">{path}</h2>
          <p className="mt-1 text-[14.5px] leading-snug text-[#4A4436]">
            {deleted
              ? `${deleted} Save it to keep the file, or delete it with git rm ${path}.`
              : regions.length > 0
                ? `Both sides changed the same lines in ${regions.length === 1 ? "one spot" : `${regions.length} spots`}. Git will not guess, so you choose what stays.`
                : "No conflict spots left in this file. Check it, save if you changed anything, then add it."}
          </p>
        </div>
        <button type="button" onClick={onClose} className={`${secondary} shrink-0`} aria-label="Close without saving">
          Close <kbd className="ml-2 rounded border border-[#D8CCB5] px-1 text-[10px]">Esc</kbd>
        </button>
      </div>

      {/* mode switch */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="How to fix it" className="inline-flex rounded-full bg-[#F1EADC] p-1">
          <ModeTab
            selected={mode === "pick"}
            disabled={regions.length === 0 || handEdited}
            title={handEdited ? "You changed the text by hand. Going back would throw that away." : undefined}
            onClick={toPick}
            autoFocus={mode === "pick"}
          >
            Pick per spot
          </ModeTab>
          <ModeTab selected={mode === "text"} onClick={toText} autoFocus={mode === "text"}>
            Edit the whole file
          </ModeTab>
        </div>
        {mode === "pick" && regions.length > 0 && (
          <p className="text-[13px] text-[#7A7264]" aria-live="polite">
            {open === 0 ? "Every spot is picked." : `${open} of ${regions.length} ${regions.length === 1 ? "spot" : "spots"} still to pick.`}
          </p>
        )}
      </div>

      <div className="mt-4 grid max-h-[62dvh] min-h-0 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:overflow-visible">
        {/* left: choices or the text box */}
        <div className="flex min-h-0 flex-col gap-3 lg:max-h-[58dvh] lg:overflow-y-auto lg:pr-1">
          {mode === "pick" ? (
            regions.map((r) => (
              <Spot
                key={r.index}
                region={r}
                total={regions.length}
                source={source}
                choice={choices[r.index]}
                onChoose={(c) => choose(r.index, c)}
              />
            ))
          ) : (
            <label className="flex min-h-[320px] flex-1 flex-col">
              <span className="text-[12px] font-semibold text-[#5D5649]">
                The whole file. Delete the marker lines (&lt;&lt;&lt;&lt;&lt;&lt;&lt;, =======, &gt;&gt;&gt;&gt;&gt;&gt;&gt;) and keep what you want.
              </span>
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setConfirming(false);
                }}
                spellCheck={false}
                className="mt-2 min-h-[300px] flex-1 resize-y rounded-2xl border border-[#D8CCB5] bg-white p-3.5 font-mono text-[13px] leading-relaxed text-[#26283B] focus-visible:border-[#2563C9] focus-visible:ring-4 focus-visible:ring-[#2563C9]/20 focus-visible:outline-none"
              />
            </label>
          )}
        </div>

        {/* right: the result */}
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-bold tracking-[0.1em] text-[#7A7264] uppercase">The file after saving</h3>
            {mode === "pick" && <Legend ours={labels.ours} theirs={labels.theirs} />}
          </div>
          <Preview segments={segments} choices={choices} text={mode === "text" ? text : null} />
        </div>
      </div>

      {/* footer */}
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#EDE5D6] pt-4">
        <AnimatePresence mode="wait" initial={false}>
          {confirming ? (
            <motion.p
              key="warn"
              role="alert"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-xl flex-1 rounded-2xl bg-[#FDEBE3] px-3.5 py-2 text-[13.5px] leading-snug text-[#8A2E0B]"
            >
              The file still has conflict markers. Git lets you save and add it like this, but the markers end up in the
              commit. Save anyway?
            </motion.p>
          ) : (
            <motion.p
              key="info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 text-[13px] text-[#7A7264]"
            >
              Saving writes the file. Git still needs <code className="rounded bg-[#F1EADC] px-1 font-mono text-[12px] text-[#26283B]">git add {path}</code> afterwards.
            </motion.p>
          )}
        </AnimatePresence>
        <div className="ml-auto flex gap-2">
          {confirming && (
            <button type="button" onClick={() => setConfirming(false)} className={secondary}>
              Keep fixing
            </button>
          )}
          <button type="button" onClick={save} className={primary}>
            {confirming ? "Save anyway" : "Save file"}
          </button>
        </div>
      </div>
    </Modal>
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
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      title={title}
      onClick={onClick}
      data-autofocus={autoFocus ? "" : undefined}
      className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors focus-visible:ring-4 focus-visible:ring-[#2563C9]/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
        selected ? "bg-[#FFFDF8] text-[#26283B] shadow-sm" : "text-[#5D5649] hover:text-[#26283B]"
      }`}
    >
      {children}
    </button>
  );
}

function Spot({
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
      className={`rounded-3xl border p-3.5 transition-colors ${choice ? "border-[#BFE3D6] bg-[#F4FBF8]" : "border-[#F2C9AC] bg-[#FFF8F2]"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={titleId} className="text-[13px] font-bold">
          {total === 1 ? "The conflict" : `Spot ${region.index + 1} of ${total}`}
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
            choice ? "bg-[#DDF1E9] text-[#0B6B58]" : "bg-[#FCE1D6] text-[#9A3412]"
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
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all focus-visible:ring-4 focus-visible:ring-[#2563C9]/30 focus-visible:outline-none ${
                on
                  ? "border-[#26283B] bg-[#26283B] text-[#F7F1E5] shadow-[0_2px_0_#11121c]"
                  : "border-[#D8CCB5] bg-[#FFFDF8] text-[#4A4436] hover:-translate-y-px hover:border-[#B9AD97] hover:text-[#26283B]"
              }`}
            >
              <SwatchFor choice={o.choice} />
              {o.label}
              {o.choice === "both" && <span className={`text-[11px] font-normal ${on ? "text-[#C9CBDA]" : "text-[#8C8373]"}`}>mine first</span>}
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
        <span className="h-2.5 w-2.5 rounded-full border border-white" style={{ background: MINE.dot }} />
        <span className="-ml-1 h-2.5 w-2.5 rounded-full border border-white" style={{ background: THEIRS.dot }} />
      </span>
    );
  }
  return <span className="h-2.5 w-2.5 rounded-full border border-white" style={{ background: choice === "ours" ? MINE.dot : THEIRS.dot }} aria-hidden />;
}

function Side({ label, text, colors, dim }: { label: string; text: string; colors: typeof MINE; dim: boolean }) {
  const lines = splitLines(text);
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-2xl border transition-opacity ${dim ? "opacity-45" : ""}`}
      style={{ borderColor: colors.edge, background: colors.wash }}
    >
      <p className="flex items-center gap-1.5 px-3 pt-2 text-[11.5px] font-bold" style={{ color: colors.text }}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors.dot }} aria-hidden />
        <span className="truncate">{label}</span>
      </p>
      <pre className="overflow-x-auto px-3 pt-1 pb-2.5 font-mono text-[12.5px] leading-relaxed text-[#26283B]">
        {lines.length === 0 ? <span className="text-[#8C8373] italic">(nothing here)</span> : lines.join("\n")}
      </pre>
    </div>
  );
}

function Legend({ ours, theirs }: { ours: string; theirs: string }) {
  return (
    <p className="hidden items-center gap-2.5 text-[11px] text-[#7A7264] sm:flex">
      <span className="flex items-center gap-1" title={ours}>
        <span className="h-2 w-2 rounded-full" style={{ background: MINE.dot }} aria-hidden />
        mine
      </span>
      <span className="flex items-center gap-1" title={theirs}>
        <span className="h-2 w-2 rounded-full" style={{ background: THEIRS.dot }} aria-hidden />
        theirs
      </span>
    </p>
  );
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  return (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n").map((l) => l.replace(/\r$/, ""));
}

const MARKER = /^(<{7}|={7}|>{7}|\|{7})( |$)/;

/** The resolved file with each line coloured by where it came from. */
function Preview({
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
    ours: "bg-[#2563C9]/25 shadow-[inset_3px_0_0_#7FA9EE]",
    theirs: "bg-[#E3A33A]/25 shadow-[inset_3px_0_0_#F2C46B]",
    conflict: "bg-[#C2410C]/30 text-[#FFC9B8]",
  };

  return (
    <pre
      aria-label="Preview of the saved file"
      className="mt-2 max-h-[52dvh] min-h-[160px] flex-1 overflow-auto rounded-2xl bg-[#26283B] py-3 font-mono text-[12.5px] leading-relaxed text-[#F7F1E5]"
    >
      {rows.length === 0 ? (
        <span className="px-4 text-[#8D90A8]">(empty file)</span>
      ) : (
        rows.map((r, i) => (
          <div key={i} className={`flex px-4 transition-colors ${tone[r.tone]}`}>
            <span className="mr-4 w-6 shrink-0 text-right text-[#5E6178] select-none">{i + 1}</span>
            <span className="whitespace-pre-wrap">{r.text || " "}</span>
          </div>
        ))
      )}
    </pre>
  );
}
