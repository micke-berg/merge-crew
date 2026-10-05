"use client";

// The history map: the repository drawn as a metro map, animated from engine events.
// Positions come from layout.ts; when the state changes, every element glides from where it was
// to where it is now, and the events decide when (see timeline.ts and motion.ts).
// The layers are drawn by MapEdges, MapStops, MapTags and MapHeads, in that order.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import type { ActorId, EngineEvent, Mood, Oid, RepoState } from "@/engine/types";
import { GHOST, INK, INK_SOFT, PAPER, PAPER_DOT, TOKENS, WARN, WHITE, actorName } from "@/lib/palette";
import { geometry } from "./geometry";
import { layoutRepo, type HeadMarker, type MapLayout } from "./layout";
import { MapEdges } from "./MapEdges";
import { resolveFocus, type MapFocus } from "./focus";
import { MapFocusOver, MapFocusUnder } from "./MapFocus";
import { MapRobotNames, MapRobots } from "./MapHeads";
import { describeStop, MapStops } from "./MapStops";
import { LineEndLabels, StopTags } from "./MapTags";
import { glide, moveAt } from "./motion";
import { cardBox, huddle } from "./placement";
import { MONO, SANS, STOP_R, type MapScene } from "./scene";
import { buildTags } from "./tags";
import { CRACK_MS, buildSchedule } from "./timeline";

export type HistoryMapProps = {
  state: RepoState;
  /** Events that led to `state`, played in order. A new array replays. */
  events?: EngineEvent[];
  /** Mood per actor. Defaults to scared while conflicted, otherwise idle. */
  moods?: Partial<Record<ActorId, Mood>>;
  className?: string;
  /** A guided-tour highlight: commits, branch lines or the lost band, outlined in `focusColor`. */
  focus?: MapFocus | null;
  /** The colour of the robot pointing at the map. */
  focusColor?: string;
};

const NO_EVENTS: EngineEvent[] = [];

export function HistoryMap({ state, events = NO_EVENTS, moods, className, focus, focusColor = TOKENS.focus }: HistoryMapProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/:/g, "");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Unknown until the container is measured; nothing is drawn before that, so nothing jumps.
  const [measured, setView] = useState<{ w: number; h: number } | null>(null);
  const view = measured ?? { w: 960, h: 440 };
  const [hover, setHover] = useState<Oid | null>(null);

  const layout = useMemo(() => layoutRepo(state), [state]);
  const schedule = useMemo(() => buildSchedule(events, state), [events, state]);

  // Remember the previous layout so changes animate from where things were.
  const [hist, setHist] = useState<{ layout: MapLayout; prev: MapLayout | null; events: EngineEvent[]; play: number }>(
    { layout, prev: null, events, play: 0 },
  );
  if (hist.layout !== layout || hist.events !== events) {
    setHist({ layout, prev: hist.layout !== layout ? hist.layout : hist.prev, events, play: hist.play + 1 });
  }
  const prev = hist.layout !== layout ? hist.layout : hist.prev;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setView((v) => (v && Math.abs(v.w - width) < 1 && Math.abs(v.h - height) < 1 ? v : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const g = geometry(layout, view.w, view.h);
  const lanes = new Map(layout.lanes.map((l) => [l.id, l]));
  const prevStops = new Map((prev?.stops ?? []).map((s) => [s.oid, s]));
  const stopsByOid = new Map(layout.stops.map((s) => [s.oid, s]));
  const headsByOid = new Map<Oid, HeadMarker[]>();
  for (const h of layout.heads) headsByOid.set(h.oid, [...(headsByOid.get(h.oid) ?? []), h]);

  const scene: MapScene = {
    state, layout, prev, g, schedule, reduce, play: hist.play, filterId: `${uid}-soft`,
    lanes, stopsByOid, prevStops, headsByOid,
    slots: huddle(layout.heads),
    prevSlots: huddle(prev?.heads ?? []),
    sec: (ms) => (reduce ? 0 : ms / 1000),
    glide: (delayMs, kind) => glide(delayMs, kind, reduce),
    moveAt: (s) => moveAt(schedule, prev ? prevStops : null, lanes, s),
    appearAt: (oid) => schedule.appear.get(oid) ?? 0,
    isNew: (oid) => !!prev && !prevStops.has(oid),
  };

  // Auto-follow the newest commit. Smooth when it moved, instant on the first layout.
  const newestX = layout.newest && stopsByOid.has(layout.newest) ? g.x(stopsByOid.get(layout.newest)!.col) * g.scale : 0;
  const follow = useEffectEvent((x: number) => {
    const el = scrollRef.current;
    if (!el || !g.scrolls) return;
    el.scrollTo({ left: Math.max(0, x - el.clientWidth * 0.62), behavior: reduce || !prev ? "auto" : "smooth" });
  });
  useEffect(() => follow(newestX), [newestX, g.scrolls, view.w]);

  const tags = buildTags(layout, state);
  const focused = resolveFocus(layout, focus);
  const ghostY = layout.ghostRow !== null ? g.y(layout.ghostRow) : null;
  const firstLoss = Math.min(...[...schedule.lose.values(), Infinity]);
  const { sec } = scene;

  return (
    <div
      ref={scrollRef}
      className={`overflow-auto ${className ?? "relative h-full w-full"}`}
      style={{
        backgroundColor: PAPER,
        backgroundImage: `radial-gradient(${PAPER_DOT} 1.1px, transparent 1.2px)`,
        backgroundSize: "22px 22px",
        scrollbarWidth: "thin",
      }}
    >
      {measured && <svg
        width={g.width * g.scale}
        height={g.height * g.scale}
        viewBox={`0 0 ${g.width} ${g.height}`}
        role="img"
        aria-label={describe(layout, state)}
        className="block select-none"
        style={{ fontFamily: SANS }}
      >
        <defs>
          <filter id={`${uid}-soft`} filterUnits="userSpaceOnUse" x={0} y={0} width={g.width} height={g.height}>
            <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor={TOKENS.shadow} floodOpacity="0.2" />
          </filter>
          <filter id={`${uid}-lift`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodColor={TOKENS.shadow} floodOpacity="0.22" />
          </filter>
        </defs>

        <motion.g
          key={`shake-${hist.play}`}
          initial={false}
          animate={schedule.shakes.length && !reduce ? { x: [0, -14, 13, -11, 9, -6, 4, -2, 0] } : { x: 0 }}
          transition={schedule.shakes.length && !reduce ? { delay: sec(schedule.shakes[0]), duration: 0.75, ease: "easeOut" } : { duration: 0 }}
        >
          {/* ghost lane */}
          <AnimatePresence>
            {ghostY !== null && (
              <motion.g
                key="ghost-band"
                initial={prev ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: sec(400) } }}
                transition={{ delay: sec(Number.isFinite(firstLoss) ? firstLoss + CRACK_MS : 0), duration: sec(400) }}
              >
                <rect
                  x={12} y={ghostY - 26} width={g.width - 24} height={52} rx={26}
                  fill={TOKENS["ghost-band"]} stroke={GHOST} strokeOpacity={0.45} strokeDasharray="2 6" strokeWidth={1.5} strokeLinecap="round"
                />
                <text x={30} y={ghostY - 32} fontSize={11} fontWeight={600} fill={INK_SOFT} letterSpacing="0.06em">
                  LOST · NO BRANCH REACHES THESE · THE REFLOG STILL KNOWS THEM
                </text>
              </motion.g>
            )}
          </AnimatePresence>

          <MapFocusUnder scene={scene} focus={focused} accent={focusColor} />
          <MapEdges scene={scene} />
          <MapStops scene={scene} hover={hover} onHover={(oid, over) => setHover((h) => (over ? oid : h === oid ? null : h))} />
          <MapFocusOver scene={scene} focus={focused} accent={focusColor} part="fill" />
          <LineEndLabels scene={scene} />
          <StopTags scene={scene} tags={tags} />
          <MapRobots scene={scene} moods={moods} />
          <MapRobotNames scene={scene} />
          <MapFocusOver scene={scene} focus={focused} accent={focusColor} part="ring" />

          {/* hover card */}
          {hover && stopsByOid.has(hover) && (() => {
            const s = stopsByOid.get(hover)!;
            const box = cardBox(g.x(s.col), g.y(s.row), s.message, g.width, STOP_R);
            return (
              <g pointerEvents="none" filter={`url(#${uid}-lift)`}>
                <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={10} fill={WHITE} stroke={TOKENS["line-soft"]} />
                <text x={box.x + 12} y={box.y + 18} fontSize={12} fontWeight={650} fill={INK}>{box.text}</text>
                <text x={box.x + 12} y={box.y + 34} fontSize={10.5} fontFamily={MONO} fill={INK_SOFT}>
                  {`${s.short} · ${actorName(s.author)}${s.lost ? " · lost" : ""}`}
                </text>
              </g>
            );
          })()}
        </motion.g>

        {/* red flash on a forced push */}
        {schedule.shakes.length > 0 && !reduce && (
          <motion.rect
            key={`flash-${hist.play}`}
            x={0} y={0} width={g.width} height={g.height} fill={WARN} pointerEvents="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.14, 0] }}
            transition={{ delay: sec(schedule.shakes[0]), duration: 0.6 }}
          />
        )}
      </svg>}
      {/* The commits as text: the drawing is one image to assistive technology, and its hover cards need a mouse. */}
      <ol className="sr-only" aria-label="Commits, oldest first">
        {layout.stops.map((s) => (
          <li key={s.oid}>{describeStop(s)}</li>
        ))}
      </ol>
    </div>
  );
}

/** A short text description of the map for screen readers. */
function describe(layout: MapLayout, state: RepoState): string {
  const live = layout.stops.filter((s) => !s.lost).length;
  const lost = layout.stops.length - live;
  const branches = Object.keys(state.branches).sort().join(", ") || "none";
  const crew = layout.heads
    .map((h) => `${actorName(h.actor)} ${h.detached ? "detached" : `on ${h.branch}`}${h.conflicted ? " with a conflict" : ""}`)
    .join("; ");
  return `History map. ${live} commits${lost ? `, ${lost} lost` : ""}. Branches: ${branches}. ${crew}.`;
}

