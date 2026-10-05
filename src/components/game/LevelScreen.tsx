"use client";

import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { queries } from "@/engine";
import type { Level } from "@/engine/types";
import { HistoryMap } from "@/components/map/HistoryMap";
import { actorColor } from "@/components/map/palette";
import { getLevel, levels } from "@/levels";
import { levelSheets } from "@/components/robots/preload";
import { preloadSheets } from "@/components/robots/Sprite";
import { DialogueBox } from "./DialogueBox";
import { FilesPanel, type OpenFile } from "./FilesPanel";
import { GoalsPanel } from "./GoalsPanel";
import { Logo } from "./Logo";
import { ConflictEditor } from "./ConflictEditor";
import { conflictSource } from "./conflicts";
import { BriefCard, FileViewer, WinCard, levelLabel } from "./Overlays";
import { Terminal, type TerminalHandle } from "./Terminal";
import { useLevel } from "./useLevel";

export function LevelScreen({ levelId }: { levelId: string }) {
  const level = getLevel(levelId);
  if (!level) return null;
  // A new level id gets a fresh game.
  return <LevelGame key={level.id} level={level} />;
}

/** One level's screen, for a level object that may not be in the level list (tests, dev pages). */
export function LevelGame({ level }: { level: Level }) {
  const g = useLevel(level);
  const { game } = g;
  // Fetch the robot sheets this level plays, so no state change waits on the network.
  preloadSheets(levelSheets(level));
  const reduce = useReducedMotion() ?? false;
  const terminal = useRef<TerminalHandle>(null);
  const [open, setOpen] = useState<OpenFile | null>(null);

  const inScene = game.phase === "intro" || game.phase === "outro";
  const playing = game.phase === "play";
  const branch = queries.currentBranch(game.repo, "player");
  const head = game.repo.worktrees.player?.head;
  const where = branch ?? (head?.kind === "detached" ? `detached ${head.oid.slice(0, 7)}` : "main");
  const index = levels.findIndex((l) => l.id === level.id);
  const next = levels[index + 1] ?? null;

  // Esc skips the rest of a scene.
  const skipRef = useRef(g.skip);
  useEffect(() => {
    skipRef.current = g.skip;
  });
  useEffect(() => {
    if (!inScene || open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skipRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inScene, open]);

  const closeFile = () => {
    setOpen(null);
    if (playing) requestAnimationFrame(() => terminal.current?.focus());
  };

  const player = game.repo.worktrees.player;
  const openContent = open
    ? (open.area === "staged" ? player?.index[open.path] : player?.workingTree[open.path])
    : undefined;
  // Conflicted files open in the editor during the player turn, and read-only during scenes.
  const openConflict = open && playing && open.area === "working" && player ? player.conflicts[open.path] : undefined;

  const saveFile = (path: string, content: string) => {
    g.edit(path, content);
    closeFile();
  };

  const cast = (["player", ...level.crew] as const).filter((a, i, all) => all.indexOf(a) === i);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col bg-[#EAE1D0] font-sans text-[#26283B] lg:h-dvh">
        {/* top bar */}
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3.5 pb-3 md:px-6">
          <Link
            href="/"
            className="group flex items-center gap-2 rounded-full pr-2 font-extrabold tracking-tight focus-visible:ring-4 focus-visible:ring-[#2563C9]/30 focus-visible:outline-none"
            aria-label="Merge Crew, all levels"
          >
            <Logo />
            <span className="hidden sm:inline">Merge Crew</span>
          </Link>
          <span className="h-5 w-px bg-[#CFC3AE]" aria-hidden />
          <div className="flex min-w-0 items-baseline gap-2.5">
            <span className="shrink-0 rounded-full bg-[#26283B] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#F7F1E5]">
              {levelLabel(level)}
            </span>
            <h1 className="truncate text-[17px] font-bold tracking-tight">{level.title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <PhaseChip phase={game.phase} />
            <button
              type="button"
              onClick={() => {
                setOpen(null);
                g.restart();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#B9AD97] px-3.5 py-1.5 text-sm font-semibold text-[#5D5649] transition-colors hover:bg-[#F3ECDF] hover:text-[#26283B] focus-visible:ring-4 focus-visible:ring-[#2563C9]/30 focus-visible:outline-none"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
                <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v3h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Restart level
            </button>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-4 md:grid-cols-2 md:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)_minmax(220px,34dvh)]">
          {/* map */}
          <section
            aria-label="History map"
            className="relative h-[46dvh] min-h-[320px] overflow-hidden rounded-3xl border border-[#D8CCB5] shadow-[0_1px_0_#fff_inset,0_10px_30px_-12px_rgba(74,58,32,0.35)] md:col-span-2 lg:col-span-1 lg:h-auto"
          >
            <HistoryMap
              key={g.run}
              state={game.repo}
              events={game.events}
              moods={game.moods}
              className="absolute inset-0"
            />
            <Legend actors={cast.filter((a) => game.repo.worktrees[a])} />
            <AnimatePresence>
              {inScene && (
                <motion.button
                  type="button"
                  onClick={g.skip}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute top-3 right-3 inline-flex items-center gap-2 rounded-full bg-[#26283B]/90 px-3.5 py-1.5 text-[13px] font-semibold text-[#F7F1E5] shadow-md backdrop-blur-sm transition-colors hover:bg-[#26283B] focus-visible:ring-4 focus-visible:ring-[#2563C9]/40 focus-visible:outline-none"
                >
                  Skip scene
                  <kbd className="rounded border border-[#5E6178] px-1 font-sans text-[10px] text-[#C9CBDA]">Esc</kbd>
                </motion.button>
              )}
            </AnimatePresence>
          </section>

          {/* side column: goals and files */}
          <div className="flex min-h-0 flex-col gap-3 md:order-last md:col-span-2 md:grid md:grid-cols-2 lg:order-none lg:col-span-1 lg:row-span-2 lg:flex">
            <GoalsPanel goals={level.goals} done={game.goals} />
            <FilesPanel repo={game.repo} where={where} onOpen={setOpen} />
          </div>

          {/* command box */}
          <div className="flex h-[320px] flex-col md:col-span-2 lg:col-span-1 lg:h-auto lg:min-h-0">
            <Terminal
              ref={terminal}
              log={game.log}
              active={playing && !open}
              where={where}
              suggestions={level.suggestions}
              onRun={g.command}
              scene={
                inScene ? (
                <DialogueBox
                  bubble={game.bubble}
                  lineKey={game.cursor + (game.phase === "outro" ? 10_000 : 0)}
                  awaitingClick={g.awaitingClick}
                  onNext={g.next}
                  reduce={reduce}
                />
                ) : undefined
              }
            />
          </div>
        </main>

        <AnimatePresence>
          {game.phase === "brief" && <BriefCard key="brief" level={level} onStart={g.begin} />}
          {game.phase === "won" && (
            <WinCard key="won" level={level} commands={game.commands} next={next} onReplay={g.restart} />
          )}
          {open && openConflict && player && (
            <ConflictEditor
              key={`conflict-${open.path}`}
              path={open.path}
              content={openContent}
              entry={openConflict}
              source={conflictSource(player)}
              onSave={(content) => saveFile(open.path, content)}
              onClose={closeFile}
            />
          )}
          {open && !openConflict && openContent !== undefined && (
            <FileViewer key="file" path={open.path} area={open.area} content={openContent} onClose={closeFile} />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function PhaseChip({ phase }: { phase: string }) {
  const text = phase === "play" ? "Your turn" : phase === "intro" || phase === "outro" ? "Scene" : phase === "won" ? "Solved" : "Ready";
  const tone =
    phase === "play"
      ? "bg-[#DDF1E9] text-[#0B6B58]"
      : phase === "won"
        ? "bg-[#11876F] text-white"
        : "bg-[#F3ECDF] text-[#5D5649]";
  return (
    <span aria-live="polite" className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold sm:inline-flex ${tone}`}>
      {phase === "play" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" aria-hidden />}
      {text}
    </span>
  );
}

function Legend({ actors }: { actors: readonly string[] }) {
  return (
    <ul
      aria-label="Crew colours"
      className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5 rounded-full bg-[#FFFDF8]/85 px-2 py-1 backdrop-blur-sm"
    >
      {actors.map((a) => {
        const c = actorColor(a);
        return (
          <li key={a} className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-[#26283B]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.line }} aria-hidden />
            {c.name}
          </li>
        );
      })}
    </ul>
  );
}
