"use client";

import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { queries } from "@/engine";
import type { Level, ScriptStep } from "@/engine/types";
import { HistoryMap } from "@/components/map/HistoryMap";
import { actorColor } from "@/lib/palette";
import { getLevel, levels } from "@/levels";
import { levelSheets } from "@/components/robots/preload";
import { preloadSheets } from "@/components/robots/Sprite";
import { DialogueBox } from "./DialogueBox";
import { FilesPanel, type OpenFile } from "./FilesPanel";
import { GoalsPanel } from "./GoalsPanel";
import { JobBar } from "./JobBar";
import { PremiseCard } from "./Premise";
import { markPremiseSeen, usePremiseSeen } from "./premiseStorage";
import { Logo } from "./Logo";
import { ConflictEditor } from "./ConflictEditor";
import { conflictSource } from "./conflicts";
import { BriefCard, FileViewer, WinCard, levelLabel } from "./Overlays";
import { Terminal, type TerminalHandle } from "./Terminal";
import { TARGET_NAMES, TourSpotlight } from "./TourSpotlight";
import type { PointStep } from "./game";
import { useLevel } from "./useLevel";
import { MuteButton, useGameSounds } from "@/components/sound";

/** The screen tour the "?" button replays: the first level's point steps, without its story or git. */
const SCREEN_TOUR: PointStep[] = (getLevel("act1-01")?.intro ?? []).filter(
  (step: ScriptStep): step is PointStep => step.kind === "point",
);

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
  const sheets = useMemo(() => levelSheets(level), [level]);
  useEffect(() => preloadSheets(sheets), [sheets]);
  const reduce = useReducedMotion() ?? false;
  useGameSounds({ events: game.events, repo: game.repo, goals: game.goals, phase: game.phase, log: game.log, reduce });
  const terminal = useRef<TerminalHandle>(null);
  const [open, setOpen] = useState<OpenFile | null>(null);
  // A first-time player who lands straight on a level gets the opening story before the brief.
  const premiseSeen = usePremiseSeen();

  const touring = g.touring;
  const inScene = game.phase === "intro" || game.phase === "outro";
  const playing = game.phase === "play";
  // A line that talks over the screen: a scene, or the "?" tour during the player turn.
  const talking = inScene || touring;
  const bubble = talking ? g.bubble : null;
  const pointer = bubble?.point ?? null;
  const pointColor = bubble ? actorColor(bubble.actor).line : undefined;
  const branch = queries.currentBranch(game.repo, "player");
  const head = game.repo.worktrees.player?.head;
  // On an unborn branch there is no commit yet, but the prompt still names the branch.
  const where = branch ?? (head?.kind === "detached" ? `detached ${head.oid.slice(0, 7)}` : (head?.name ?? "main"));
  const index = levels.findIndex((l) => l.id === level.id);
  const next = levels[index + 1] ?? null;

  // Esc skips the rest of a scene, or ends the tour.
  const skip = useEffectEvent(() => g.skip());
  useEffect(() => {
    if (!talking || open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [talking, open]);

  // Back to the command line when the tour ends.
  const wasTouring = useRef(false);
  useEffect(() => {
    if (wasTouring.current && !touring) requestAnimationFrame(() => terminal.current?.focus());
    wasTouring.current = touring;
  }, [touring]);

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
      <div className="flex min-h-dvh flex-col bg-desk font-sans text-ink lg:h-dvh">
        {/* top bar */}
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3.5 pb-3 md:px-6">
          <Link
            href="/"
            className="group flex items-center gap-2 rounded-full pr-2 font-extrabold tracking-tight focus-visible:ring-4 focus-visible:ring-focus/30 focus-visible:outline-none"
            aria-label="Merge Crew, all levels"
          >
            <Logo />
            <span className="hidden sm:inline">Merge Crew</span>
          </Link>
          <span className="h-5 w-px bg-divider" aria-hidden />
          <div className="flex min-w-0 items-baseline gap-2.5">
            <span className="shrink-0 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-paper">
              {levelLabel(level)}
            </span>
            <h1 className="truncate text-[17px] font-bold tracking-tight">{level.title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <TourButton disabled={!playing || touring || SCREEN_TOUR.length === 0} onClick={() => g.tour(SCREEN_TOUR)} />
            <MuteButton />
            <PhaseChip phase={game.phase} />
            <button
              type="button"
              onClick={() => {
                setOpen(null);
                g.restart();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-button px-3.5 py-1.5 text-sm font-semibold text-soft transition-colors hover:bg-sunk hover:text-ink focus-visible:ring-4 focus-visible:ring-focus/30 focus-visible:outline-none"
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
            data-tour="map"
            aria-label="History map"
            className="relative h-[40dvh] min-h-[300px] overflow-hidden rounded-3xl border border-line shadow-[0_1px_0_white_inset,0_10px_30px_-12px_rgba(74,58,32,0.35)] md:col-span-2 lg:col-span-1 lg:h-auto"
          >
            <HistoryMap
              key={g.run}
              state={game.repo}
              events={game.events}
              moods={game.moods}
              className="absolute inset-0"
              focus={pointer?.target === "map" ? pointer.focus : null}
              focusColor={pointColor}
            />
            <Legend actors={cast.filter((a) => game.repo.worktrees[a])} />
            <AnimatePresence>
              {talking && (
                <motion.button
                  type="button"
                  onClick={g.skip}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute top-3 right-3 z-[41] inline-flex items-center gap-2 rounded-full bg-ink/90 px-3.5 py-1.5 text-[13px] font-semibold text-paper shadow-md backdrop-blur-sm transition-colors hover:bg-ink focus-visible:ring-4 focus-visible:ring-focus/40 focus-visible:outline-none"
                >
                  {touring ? "End tour" : "Skip scene"}
                  <kbd className="rounded border border-term-edge-soft px-1 font-sans text-[10px] text-term-key">Esc</kbd>
                </motion.button>
              )}
            </AnimatePresence>
          </section>

          {/* side column: goals and files */}
          <div className="flex min-h-0 flex-col gap-3 md:order-last md:col-span-2 md:grid md:grid-cols-2 lg:order-none lg:col-span-1 lg:row-span-2 lg:flex">
            <GoalsPanel goals={level.goals} done={game.goals} />
            <FilesPanel
              repo={game.repo}
              where={where}
              onOpen={setOpen}
              highlight={bubble?.files.length ? { actor: bubble.actor, files: bubble.files } : null}
            />
          </div>

          {/* command box */}
          <div className="flex h-[372px] flex-col gap-2 md:col-span-2 lg:col-span-1 lg:h-auto lg:min-h-0">
            <JobBar goals={level.goals} done={game.goals} won={game.phase === "outro" || game.phase === "won"} />
            <Terminal
              ref={terminal}
              log={game.log}
              active={playing && !open && !touring}
              where={where}
              path={player?.path ?? "/repo"}
              suggestions={level.suggestions}
              onRun={g.command}
              showControls={pointer?.target === "terminal" || pointer?.target === "suggestions"}
              scene={
                talking ? (
                // Above the tour's dim, so the robot's line stays bright whatever it points at.
                <div className="relative z-[41]">
                <DialogueBox
                  bubble={bubble}
                  lineKey={touring ? 20_000 + g.tourAt : game.cursor + (game.phase === "outro" ? 10_000 : 0)}
                  awaitingClick={g.awaitingClick}
                  onNext={g.next}
                  reduce={reduce}
                  onOpenFile={(path) => setOpen({ path, area: "working" })}
                />
                </div>
                ) : undefined
              }
            />
          </div>
        </main>

        <AnimatePresence>
          {game.phase === "brief" && !premiseSeen && (
            <PremiseCard key="premise" onDone={() => markPremiseSeen()} doneLabel="On to the first job" />
          )}
          {game.phase === "brief" && premiseSeen && <BriefCard key="brief" level={level} onStart={g.begin} />}
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

        <TourSpotlight target={open ? null : (pointer?.target ?? null)} color={pointColor ?? actorColor("tidy").line} reduce={reduce} />

        {/* The scene's current line, announced once. The dialogue box itself is a plain "next" button. */}
        <p className="sr-only" aria-live="polite">
          {bubble
            ? `${actorColor(bubble.actor).name}${pointer ? `, pointing at ${TARGET_NAMES[pointer.target]}` : ""}: ${bubble.text}`
            : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

function PhaseChip({ phase }: { phase: string }) {
  const text = phase === "play" ? "Your turn" : phase === "intro" || phase === "outro" ? "Scene" : phase === "won" ? "Solved" : "Ready";
  const tone =
    phase === "play"
      ? "bg-success-wash text-success-deep"
      : phase === "won"
        ? "bg-success-strong text-white"
        : "bg-sunk text-soft";
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
      className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5 rounded-full bg-card/85 px-2 py-1 backdrop-blur-sm"
    >
      {actors.map((a) => {
        const c = actorColor(a);
        return (
          <li key={a} className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.line }} aria-hidden />
            {c.name}
          </li>
        );
      })}
    </ul>
  );
}

/** Replays the screen tour: what the map, the files, the job bar and the command box are. */
function TourButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Show me around the screen"
      title={disabled ? "The tour is available on your turn" : "Show me around the screen"}
      className="grid h-8 w-8 place-items-center rounded-full border border-line-button text-[15px] font-extrabold text-soft transition-colors hover:bg-sunk hover:text-ink focus-visible:ring-4 focus-visible:ring-focus/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-soft"
    >
      ?
    </button>
  );
}
