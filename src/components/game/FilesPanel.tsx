"use client";

import { motion } from "motion/react";
import { queries } from "@/engine";
import type { RepoState, Worktree } from "@/engine/types";
import {
  abortCommand,
  conflictHeadline,
  conflictSource,
  finishCommand,
  hasConflictMarkers,
  readyHeadline,
} from "./conflicts";

export type OpenFile = { path: string; area: "working" | "staged" };

type Props = {
  repo: RepoState;
  where: string;
  onOpen: (file: OpenFile) => void;
};

type Badge = { letter: string; label: string; className: string };

const BADGES: Record<string, Badge> = {
  conflict: { letter: "!", label: "conflict", className: "bg-[#C2410C] text-white" },
  fixed: { letter: "✓", label: "fixed, not added yet", className: "bg-[#11876F] text-white" },
  untracked: { letter: "U", label: "new, not tracked", className: "bg-[#DDF1E9] text-[#0B6B58]" },
  modified: { letter: "M", label: "modified", className: "bg-[#FBE7C6] text-[#8A5A00]" },
  deleted: { letter: "D", label: "deleted", className: "bg-[#FCE1D6] text-[#B43A14]" },
  added: { letter: "A", label: "added", className: "bg-[#DDF1E9] text-[#0B6B58]" },
  clean: { letter: "·", label: "unchanged", className: "text-[#A59C8C]" },
};

export function FilesPanel({ repo, where, onOpen }: Props) {
  const wt = repo.worktrees.player;
  if (!wt) return null;
  const st = queries.status(repo, "player");
  const unstaged = new Map(st.unstaged.map((u) => [u.path, u.change]));
  const untracked = new Set(st.untracked);
  const conflicted = new Set(st.conflicted);
  const paths = [...new Set([...Object.keys(wt.workingTree), ...unstaged.keys(), ...conflicted])].sort();

  const working = paths.map((path) => {
    const kind = conflicted.has(path)
      ? isFixed(wt, path)
        ? "fixed"
        : "conflict"
      : untracked.has(path)
        ? "untracked"
        : (unstaged.get(path) ?? "clean");
    return { path, badge: BADGES[kind], exists: path in wt.workingTree, kind };
  });
  // Conflicted files first: they are what the player has to deal with.
  working.sort((a, b) => Number(conflicted.has(b.path)) - Number(conflicted.has(a.path)));

  return (
    <section aria-labelledby="files-title" className="flex min-h-0 flex-col rounded-3xl border border-[#D8CCB5] bg-[#FBF8F1] p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="files-title" className="text-sm font-bold">Files</h2>
        <span className="truncate font-mono text-[11px] text-[#7A7264]">/repo · {where}</span>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        <ConflictBanner wt={wt} conflicted={st.conflicted} onOpen={(path) => onOpen({ path, area: "working" })} />
        <h3 className="text-[11px] font-bold tracking-wide text-[#7A7264] uppercase">Working files</h3>
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {working.length === 0 && <li className="px-2 py-1 text-[13px] text-[#7A7264]">No files yet.</li>}
          {working.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                disabled={!f.exists && !conflicted.has(f.path)}
                onClick={() => onOpen({ path: f.path, area: "working" })}
                className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left font-mono text-[12.5px] transition-colors hover:bg-[#F1EADC] focus-visible:bg-[#F1EADC] focus-visible:ring-2 focus-visible:ring-[#2563C9]/40 focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent ${
                  f.kind === "conflict" ? "bg-[#FDEBE3] ring-1 ring-[#C2410C]/40" : f.kind === "fixed" ? "bg-[#EAF6F1] ring-1 ring-[#11876F]/35" : ""
                }`}
                title={
                  conflicted.has(f.path)
                    ? `Fix ${f.path} (${f.badge.label})`
                    : f.exists
                      ? `Show ${f.path} (${f.badge.label})`
                      : `${f.path} (${f.badge.label})`
                }
              >
                <StatusBadge badge={f.badge} />
                <span className={`truncate ${f.exists || conflicted.has(f.path) ? "" : "text-[#9A9184] line-through"}`}>{f.path}</span>
                {f.kind !== "clean" && <span className="ml-auto shrink-0 font-sans text-[10.5px] text-[#7A7264]">{f.badge.label}</span>}
              </button>
            </li>
          ))}
        </ul>

        <h3 className="mt-4 text-[11px] font-bold tracking-wide text-[#7A7264] uppercase">Staged for the next commit</h3>
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {st.staged.length === 0 && <li className="px-2 py-1 text-[13px] text-[#7A7264]">Nothing staged.</li>}
          {st.staged.map((f) => {
            const badge = BADGES[f.change];
            const exists = f.change !== "deleted";
            return (
              <li key={f.path}>
                <button
                  type="button"
                  disabled={!exists}
                  onClick={() => onOpen({ path: f.path, area: "staged" })}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left font-mono text-[12.5px] transition-colors hover:bg-[#F1EADC] focus-visible:bg-[#F1EADC] focus-visible:ring-2 focus-visible:ring-[#2563C9]/40 focus-visible:outline-none disabled:cursor-default"
                  title={`Staged: ${f.path} (${badge.label})`}
                >
                  <StatusBadge badge={badge} />
                  <span className="truncate">{f.path}</span>
                  <span className="ml-auto shrink-0 font-sans text-[10.5px] text-[#7A7264]">{badge.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function StatusBadge({ badge }: { badge: Badge }) {
  return (
    <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md font-sans text-[10.5px] font-bold ${badge.className}`}>
      {badge.letter}
      <span className="sr-only"> {badge.label}</span>
    </span>
  );
}

/** A conflicted file whose working copy has no markers left: saved, waiting for git add. */
function isFixed(wt: Worktree, path: string): boolean {
  const text = wt.workingTree[path];
  return text !== undefined && !hasConflictMarkers(text);
}

function Cmd({ children }: { children: string }) {
  return (
    <code className="rounded-md bg-[#26283B] px-1.5 py-px font-mono text-[11.5px] whitespace-nowrap text-[#F7F1E5]">{children}</code>
  );
}

/** What stopped and what to do next, while files are in conflict or an operation waits to finish. */
function ConflictBanner({
  wt,
  conflicted,
  onOpen,
}: {
  wt: Worktree;
  conflicted: string[];
  onOpen: (path: string) => void;
}) {
  const source = conflictSource(wt);
  const finish = finishCommand(source);
  const abort = abortCommand(source);

  if (conflicted.length === 0) {
    if (!wt.inProgress || !finish) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        role="status"
        className="mb-4 rounded-2xl border border-[#BFE3D6] bg-[#EAF6F1] p-3 text-[13px] leading-snug text-[#0B4F42]"
      >
        <p className="flex items-start gap-2 font-semibold">
          <span className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#11876F]" aria-hidden>
            <svg width="10" height="10" viewBox="0 0 12 12">
              <path d="M2 6.4 L4.8 9 L10 3" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>
            {readyHeadline(source)} <Cmd>{finish}</Cmd>
          </span>
        </p>
      </motion.div>
    );
  }

  const fixed = conflicted.filter((p) => isFixed(wt, p));
  const toFix = conflicted.filter((p) => !isFixed(wt, p));
  const addTarget = fixed.length === 1 ? fixed[0] : conflicted.length === 1 ? conflicted[0] : "<file>";

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      aria-label="Conflict"
      className="mb-4 rounded-2xl border border-[#F2C9AC] bg-[#FFF4EC] p-3 text-[13px] leading-snug text-[#5A2A0E]"
    >
      <p className="flex items-start gap-2 font-bold text-[#8A2E0B]">
        <span className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#C2410C] text-[11px] text-white" aria-hidden>
          !
        </span>
        {conflictHeadline(source, conflicted.length)}
      </p>
      <ol className="mt-2 flex list-none flex-col gap-1.5 pl-[26px]">
        <Step n={1} done={toFix.length === 0}>
          Open {conflicted.length === 1 ? "the file" : "each file"} and pick what to keep.
        </Step>
        <Step n={2} done={false} current={toFix.length === 0 || fixed.length > 0}>
          Stage it: <Cmd>{`git add ${addTarget}`}</Cmd>
        </Step>
        {finish && (
          <Step n={3} done={false}>
            Then <Cmd>{finish}</Cmd>
          </Step>
        )}
      </ol>
      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-[26px]">
        {conflicted.map((p) => {
          const done = fixed.includes(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => onOpen(p)}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold transition-transform hover:-translate-y-px focus-visible:ring-4 focus-visible:ring-[#2563C9]/30 focus-visible:outline-none ${
                done
                  ? "border border-[#11876F]/40 bg-white text-[#0B6B58]"
                  : "bg-[#C2410C] text-white shadow-[0_2px_0_#8A2E0B]"
              }`}
            >
              <span className="truncate font-mono">{p}</span>
              <span className="shrink-0 font-sans text-[11px] opacity-90">{done ? "· add it" : "· fix it"}</span>
            </button>
          );
        })}
      </div>
      {abort ? (
        <p className="mt-2.5 pl-[26px] text-[12px] text-[#8C5A3C]">
          Changed your mind? <Cmd>{abort}</Cmd> puts everything back.
        </p>
      ) : (
        <p className="mt-2.5 pl-[26px] text-[12px] text-[#8C5A3C]">The stash is still saved until you drop it.</p>
      )}
    </motion.div>
  );
}

function Step({ n, done, current = false, children }: { n: number; done: boolean; current?: boolean; children: React.ReactNode }) {
  return (
    <li className={`relative ${done ? "text-[#8C7A6A] line-through decoration-[#C9A58C]" : current ? "font-semibold" : ""}`}>
      <span
        className={`absolute top-px -left-[22px] grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold ${
          done ? "bg-[#11876F] text-white" : current ? "bg-[#26283B] text-white" : "bg-[#F2D9C6] text-[#8A2E0B]"
        }`}
        aria-hidden
      >
        {done ? "✓" : n}
      </span>
      {children}
    </li>
  );
}
