"use client";

import { queries } from "@/engine";
import type { RepoState } from "@/engine/types";

export type OpenFile = { path: string; area: "working" | "staged" };

type Props = {
  repo: RepoState;
  where: string;
  onOpen: (file: OpenFile) => void;
};

type Badge = { letter: string; label: string; className: string };

const BADGES: Record<string, Badge> = {
  conflict: { letter: "!", label: "conflict", className: "bg-[#C2410C] text-white" },
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
      ? "conflict"
      : untracked.has(path)
        ? "untracked"
        : (unstaged.get(path) ?? "clean");
    return { path, badge: BADGES[kind], exists: path in wt.workingTree, kind };
  });

  return (
    <section aria-labelledby="files-title" className="flex min-h-0 flex-col rounded-3xl border border-[#D8CCB5] bg-[#FBF8F1] p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="files-title" className="text-sm font-bold">Files</h2>
        <span className="truncate font-mono text-[11px] text-[#7A7264]">/repo · {where}</span>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        <h3 className="text-[11px] font-bold tracking-wide text-[#7A7264] uppercase">Working files</h3>
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {working.length === 0 && <li className="px-2 py-1 text-[13px] text-[#7A7264]">No files yet.</li>}
          {working.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                disabled={!f.exists}
                onClick={() => onOpen({ path: f.path, area: "working" })}
                className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left font-mono text-[12.5px] transition-colors hover:bg-[#F1EADC] focus-visible:bg-[#F1EADC] focus-visible:ring-2 focus-visible:ring-[#2563C9]/40 focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent ${
                  f.kind === "conflict" ? "bg-[#FDEBE3] ring-1 ring-[#C2410C]/40" : ""
                }`}
                title={f.exists ? `Show ${f.path} (${f.badge.label})` : `${f.path} (${f.badge.label})`}
              >
                <StatusBadge badge={f.badge} />
                <span className={`truncate ${f.exists ? "" : "text-[#9A9184] line-through"}`}>{f.path}</span>
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
