"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { ConflictEntry } from "@/engine/types";
import { ConflictModeTabs } from "./ConflictModeTabs";
import { ConflictLegend, ConflictPreview } from "./ConflictPreview";
import { ConflictSpot } from "./ConflictSpot";
import {
  conflictRegions,
  hasConflictMarkers,
  parseConflicts,
  resolveConflicts,
  sideLabels,
  type Choice,
  type ConflictSource,
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
          <p className="text-[11px] font-bold tracking-[0.12em] text-warn uppercase">Fix a conflict</p>
          <h2 className="mt-0.5 truncate font-mono text-xl font-bold">{path}</h2>
          <p className="mt-1 text-[14.5px] leading-snug text-body">
            {deleted
              ? `${deleted} Save it to keep the file, or delete it with git rm ${path}.`
              : regions.length > 0
                ? `Both sides changed the same lines in ${regions.length === 1 ? "one spot" : `${regions.length} spots`}. Git will not guess, so you choose what stays.`
                : "No conflict spots left in this file. Check it, save if you changed anything, then add it."}
          </p>
        </div>
        <button type="button" onClick={onClose} className={`${secondary} shrink-0`} aria-label="Close without saving">
          Close <kbd className="ml-2 rounded border border-line px-1 text-[10px]">Esc</kbd>
        </button>
      </div>

      {/* mode switch */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <ConflictModeTabs
          mode={mode}
          canPick={regions.length > 0 && !handEdited}
          pickBlockedReason={handEdited ? "You changed the text by hand. Going back would throw that away." : undefined}
          onPick={toPick}
          onText={toText}
        />
        {mode === "pick" && regions.length > 0 && (
          <p className="text-[13px] text-muted" aria-live="polite">
            {open === 0 ? "Every spot is picked." : `${open} of ${regions.length} ${regions.length === 1 ? "spot" : "spots"} still to pick.`}
          </p>
        )}
      </div>

      <div className="mt-4 grid max-h-[62dvh] min-h-0 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:overflow-visible">
        {/* left: choices or the text box */}
        <div className="flex min-h-0 flex-col gap-3 lg:max-h-[58dvh] lg:overflow-y-auto lg:pr-1">
          {mode === "pick" ? (
            regions.map((r) => (
              <ConflictSpot
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
              <span className="text-[12px] font-semibold text-soft">
                The whole file. Delete the marker lines (&lt;&lt;&lt;&lt;&lt;&lt;&lt;, =======, &gt;&gt;&gt;&gt;&gt;&gt;&gt;) and keep what you want.
              </span>
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setConfirming(false);
                }}
                spellCheck={false}
                className="mt-2 min-h-[300px] flex-1 resize-y rounded-2xl border border-line bg-white p-3.5 font-mono text-[13px] leading-relaxed text-ink focus-visible:border-focus focus-visible:ring-4 focus-visible:ring-focus/20 focus-visible:outline-none"
              />
            </label>
          )}
        </div>

        {/* right: the result */}
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-bold tracking-[0.1em] text-muted uppercase">The file after saving</h3>
            {mode === "pick" && <ConflictLegend ours={labels.ours} theirs={labels.theirs} />}
          </div>
          <ConflictPreview segments={segments} choices={choices} text={mode === "text" ? text : null} />
        </div>
      </div>

      {/* footer */}
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-chip pt-4">
        <AnimatePresence mode="wait" initial={false}>
          {confirming ? (
            <motion.p
              key="warn"
              role="alert"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-xl flex-1 rounded-2xl bg-warn-soft px-3.5 py-2 text-[13.5px] leading-snug text-warn-deep"
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
              className="flex-1 text-[13px] text-muted"
            >
              Saving writes the file. Git still needs <code className="rounded bg-wash px-1 font-mono text-[12px] text-ink">git add {path}</code> afterwards.
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
