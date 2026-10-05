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
  conflict: { letter: "!", label: "conflict", className: "bg-warn text-white" },
  fixed: { letter: "✓", label: "fixed, not added yet", className: "bg-success-strong text-white" },
  untracked: { letter: "U", label: "new, not tracked", className: "bg-success-wash text-success-deep" },
  modified: { letter: "M", label: "modified", className: "bg-modified-wash text-modified-text" },
  deleted: { letter: "D", label: "deleted", className: "bg-warn-chip text-deleted-text" },
  added: { letter: "A", label: "added", className: "bg-success-wash text-success-deep" },
  clean: { letter: "·", label: "unchanged", className: "text-ghost" },
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
    <section aria-labelledby="files-title" className="flex min-h-0 flex-col rounded-3xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="files-title" className="text-sm font-bold">Files</h2>
        <span className="truncate font-mono text-[11px] text-muted">{wt.path} · {where}</span>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        <ConflictBanner wt={wt} conflicted={st.conflicted} onOpen={(path) => onOpen({ path, area: "working" })} />
        <h3 className="text-[11px] font-bold tracking-wide text-muted uppercase">Working files</h3>
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {working.length === 0 && <li className="px-2 py-1 text-[13px] text-muted">No files yet.</li>}
          {working.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                disabled={!f.exists && !conflicted.has(f.path)}
                onClick={() => onOpen({ path: f.path, area: "working" })}
                className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left font-mono text-[12.5px] transition-colors hover:bg-wash focus-visible:bg-wash focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent ${
                  f.kind === "conflict" ? "bg-warn-soft ring-1 ring-warn/40" : f.kind === "fixed" ? "bg-success-soft ring-1 ring-success/35" : ""
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
                <span className={`truncate ${f.exists || conflicted.has(f.path) ? "" : "text-muted line-through"}`}>{f.path}</span>
                {f.kind !== "clean" && <span className="ml-auto shrink-0 font-sans text-[10.5px] text-muted">{f.badge.label}</span>}
              </button>
            </li>
          ))}
        </ul>

        <h3 className="mt-4 text-[11px] font-bold tracking-wide text-muted uppercase">Staged for the next commit</h3>
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {st.staged.length === 0 && <li className="px-2 py-1 text-[13px] text-muted">Nothing staged.</li>}
          {st.staged.map((f) => {
            const badge = BADGES[f.change];
            const exists = f.change !== "deleted";
            return (
              <li key={f.path}>
                <button
                  type="button"
                  disabled={!exists}
                  onClick={() => onOpen({ path: f.path, area: "staged" })}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left font-mono text-[12.5px] transition-colors hover:bg-wash focus-visible:bg-wash focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:outline-none disabled:cursor-default"
                  title={`Staged: ${f.path} (${badge.label})`}
                >
                  <StatusBadge badge={badge} />
                  <span className="truncate">{f.path}</span>
                  <span className="ml-auto shrink-0 font-sans text-[10.5px] text-muted">{badge.label}</span>
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
    <code className="rounded-md bg-ink px-1.5 py-px font-mono text-[11.5px] whitespace-nowrap text-paper">{children}</code>
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
        className="mb-4 rounded-2xl border border-success-edge bg-success-soft p-3 text-[13px] leading-snug text-success-ink"
      >
        <p className="flex items-start gap-2 font-semibold">
          <span className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-success" aria-hidden>
            <svg width="10" height="10" viewBox="0 0 12 12">
              <path d="M2 6.4 L4.8 9 L10 3" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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
      className="mb-4 rounded-2xl border border-warn-edge bg-warn-wash p-3 text-[13px] leading-snug text-warn-ink"
    >
      <p className="flex items-start gap-2 font-bold text-warn-deep">
        <span className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-warn text-[11px] text-white" aria-hidden>
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
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold transition-transform hover:-translate-y-px focus-visible:ring-4 focus-visible:ring-focus/30 focus-visible:outline-none ${
                done
                  ? "border border-success/40 bg-white text-success-deep"
                  : "bg-warn text-white shadow-[0_2px_0_var(--color-warn-deep)]"
              }`}
            >
              <span className="truncate font-mono">{p}</span>
              <span className="shrink-0 font-sans text-[11px] opacity-90">{done ? "· add it" : "· fix it"}</span>
            </button>
          );
        })}
      </div>
      {abort ? (
        <p className="mt-2.5 pl-[26px] text-[12px] text-warn-note">
          Changed your mind? <Cmd>{abort}</Cmd> puts everything back.
        </p>
      ) : (
        <p className="mt-2.5 pl-[26px] text-[12px] text-warn-note">The stash is still saved until you drop it.</p>
      )}
    </motion.div>
  );
}

function Step({ n, done, current = false, children }: { n: number; done: boolean; current?: boolean; children: React.ReactNode }) {
  return (
    <li className={`relative ${done ? "text-muted line-through decoration-warn-strike" : current ? "font-semibold" : ""}`}>
      <span
        className={`absolute top-px -left-[22px] grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold ${
          done ? "bg-success-strong text-white" : current ? "bg-ink text-white" : "bg-warn-step text-warn-deep"
        }`}
        aria-hidden
      >
        {done ? "✓" : n}
      </span>
      {children}
    </li>
  );
}
