"use client";

// The history map: the repository drawn as a metro map, animated from engine events.
// Positions come from layout.ts; when the state changes, every element glides from where it was
// to where it is now, and the events decide when (see timeline.ts).

import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ActorId, EngineEvent, Mood, RepoState } from "@/engine/types";
import { OID_LABEL_MIN_GAP, edgePath, geometry, monoWidth } from "./geometry";
import { layoutRepo, type HeadMarker, type Lane, type MapLayout, type Stop } from "./layout";
import { GHOST, INK, INK_SOFT, MAIN_COLOR, PAPER, PAPER_DOT, WARN, actorColor, actorName } from "./palette";
import { RobotMarker, type Facing } from "./RobotMarker";
import { CRACK_MS, buildSchedule, stopMoveAt } from "./timeline";

export type HistoryMapProps = {
  state: RepoState;
  /** Events that led to `state`, played in order. A new array replays. */
  events?: EngineEvent[];
  /** Mood per actor. Defaults to scared while conflicted, otherwise idle. */
  moods?: Partial<Record<ActorId, Mood>>;
  className?: string;
};

const NO_EVENTS: EngineEvent[] = [];
const MONO = "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace";
const SANS = "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif";
const LINE_W = 7;
const STOP_R = 6.5;

function laneColor(lane: Lane | undefined) {
  if (!lane || lane.kind === "main") return MAIN_COLOR;
  if (lane.kind === "stash") return { ...MAIN_COLOR, line: INK_SOFT, deep: INK_SOFT };
  return actorColor(lane.owner);
}

/** Robots standing on one stop spread out sideways. */
const SLOT_GAP = 30;
const slotDx = (h: HeadMarker) => (h.slot - (h.slots - 1) / 2) * SLOT_GAP;

export function HistoryMap({ state, events = NO_EVENTS, moods, className }: HistoryMapProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/:/g, "");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Unknown until the container is measured; nothing is drawn before that, so nothing jumps.
  const [measured, setView] = useState<{ w: number; h: number } | null>(null);
  const view = measured ?? { w: 960, h: 440 };
  const [hover, setHover] = useState<string | null>(null);

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
  const play = hist.play;

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
  const prevEdges = new Set((prev?.edges ?? []).map((e) => e.id));
  const prevHeads = new Map((prev?.heads ?? []).map((h) => [h.actor, h]));
  const stopsByOid = new Map(layout.stops.map((s) => [s.oid, s]));
  const sec = (ms: number) => (reduce ? 0 : ms / 1000);

  // When each stop starts to move. Lost and recovered stops follow their events; a stop that
  // changes lane because a branch moved follows that branch.
  const moveAt = (s: Stop): number => {
    if (!prev) return 0;
    const before = prevStops.get(s.oid);
    const base = stopMoveAt(schedule, s.oid);
    if (base || schedule.lose.has(s.oid) || schedule.recover.has(s.oid)) return base;
    if (before && before.row !== s.row) {
      const lane = lanes.get(s.laneId);
      const b = lane?.name ? schedule.branch.get(lane.name) : undefined;
      if (b) return b.at;
    }
    return 0;
  };
  const appearAt = (oid: string) => schedule.appear.get(oid) ?? 0;
  const isNew = (oid: string) => !!prev && !prevStops.has(oid);

  // Auto-follow the newest commit.
  const newestX = layout.newest && stopsByOid.has(layout.newest) ? g.x(stopsByOid.get(layout.newest)!.col) * g.scale : 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !g.scrolls) return;
    const target = Math.max(0, newestX - el.clientWidth * 0.62);
    el.scrollTo({ left: target, behavior: reduce || !prev ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestX, g.scrolls, view.w]);

  const glide = (delayMs: number, kind: "soft" | "snap" | "drop" | "lift" = "soft"): Transition => {
    if (reduce) return { duration: 0 };
    const delay = delayMs / 1000;
    switch (kind) {
      case "snap": return { type: "spring", stiffness: 520, damping: 13, delay };
      case "drop": return { type: "spring", stiffness: 160, damping: 11, mass: 1.1, delay };
      case "lift": return { type: "spring", stiffness: 140, damping: 16, delay };
      default: return { type: "spring", stiffness: 190, damping: 26, delay };
    }
  };

  // --- tags that hang below a stop: branch tags, remote tags, stash ---
  type Tag = { key: string; oid: string; text: string; kind: "branch" | "remote" | "tracking" | "stash"; actor: ActorId | null; ref?: string };
  const tagsByOid = new Map<string, Tag[]>();
  const addTag = (t: Tag) => tagsByOid.set(t.oid, [...(tagsByOid.get(t.oid) ?? []), t]);
  // A line-end label only works where the line really ends; a line that merges back gets a tag instead.
  const atEnd = (b: (typeof layout.branchLabels)[number]) => b.atLineEnd && lanes.get(b.laneId)!.end === b.col;
  for (const b of layout.branchLabels) {
    if (!atEnd(b)) addTag({ key: `b:${b.name}`, oid: b.oid, text: b.name, kind: "branch", actor: b.checkedOutBy[0] ?? state.commits[b.oid]?.author ?? null });
  }
  for (const r of layout.remoteTags) {
    addTag({ key: `r:${r.ref}:${r.source === "tracking" ? "t" : "s"}`, oid: r.oid, text: r.ref, kind: r.source === "tracking" ? "tracking" : "remote", actor: null, ref: r.ref });
  }
  for (const s of layout.stashes) addTag({ key: `s:${s.ref}`, oid: s.base, text: s.ref, kind: "stash", actor: "hoarder" });

  const headsByOid = new Map<string, HeadMarker[]>();
  for (const h of layout.heads) headsByOid.set(h.oid, [...(headsByOid.get(h.oid) ?? []), h]);

  const showOid = (s: Stop) => g.colGap >= OID_LABEL_MIN_GAP || hover === s.oid || layout.branchLabels.some((b) => b.oid === s.oid);
  const ghostY = layout.ghostRow !== null ? g.y(layout.ghostRow) : null;
  const firstLoss = Math.min(...[...schedule.lose.values(), Infinity]);

  const summary = describe(layout, state);

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
        aria-label={summary}
        className="block select-none"
        style={{ fontFamily: SANS }}
      >
        <defs>
          <filter id={`${uid}-soft`} filterUnits="userSpaceOnUse" x={0} y={0} width={g.width} height={g.height}>
            <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="#4A3A20" floodOpacity="0.2" />
          </filter>
          <filter id={`${uid}-lift`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodColor="#4A3A20" floodOpacity="0.22" />
          </filter>
        </defs>

        <motion.g
          key={`shake-${play}`}
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
                  fill="#EEE6D6" stroke={GHOST} strokeOpacity={0.45} strokeDasharray="2 6" strokeWidth={1.5} strokeLinecap="round"
                />
                <text x={30} y={ghostY - 32} fontSize={11} fontWeight={600} fill={INK_SOFT} letterSpacing="0.06em">
                  LOST · NO BRANCH REACHES THESE · THE REFLOG STILL KNOWS THEM
                </text>
              </motion.g>
            )}
          </AnimatePresence>

          {/* line casings, then lines: the paper-coloured casing separates crossing lines */}
          {(["casing", "line"] as const).map((layer) => (
          <g key={layer} filter={layer === "line" ? `url(#${uid}-soft)` : undefined}>
            {layout.edges.map((e) => {
              const lane = lanes.get(e.laneId);
              const d = edgePath(e.kind, g.x(e.fromCol), g.y(e.fromRow), g.x(e.toCol), g.y(e.toRow), g.colGap);
              const fromStop = stopsByOid.get(e.from)!;
              const toStop = stopsByOid.get(e.to)!;
              const delay = Math.max(moveAt(fromStop), moveAt(toStop));
              const fresh = !!prev && !prevEdges.has(e.id) && !e.lost;
              const dashed = e.lost || lane?.kind === "remote" || lane?.kind === "detached" || lane?.kind === "stash";
              const color = e.lost ? GHOST : laneColor(lane).line;
              const width = e.lost ? 3 : lane?.kind === "stash" || lane?.kind === "detached" ? 4 : LINE_W;
              if (layer === "casing") {
                return e.lost ? null : (
                    <motion.path
                      key={e.id}
                      initial={fresh ? { d, opacity: 0 } : false}
                      animate={{ d, opacity: 1 }}
                      transition={{ d: glide(delay, e.kind === "straight" ? "snap" : "soft"), opacity: { delay: sec(appearAt(e.to)), duration: 0.01 } }}
                      fill="none" stroke={PAPER} strokeWidth={width + 6} strokeLinecap="round" strokeLinejoin="round"
                    />
                );
              }
              return (
                  <motion.path
                    key={e.id}
                    initial={fresh && !dashed ? { d, pathLength: 0 } : false}
                    animate={fresh && !dashed ? { d, pathLength: 1, stroke: color } : { d, stroke: color }}
                    transition={{
                      d: glide(delay, e.lost ? "drop" : "soft"),
                      pathLength: { delay: sec(appearAt(e.to)), duration: sec(360), ease: "easeOut" },
                      stroke: { delay: sec(delay), duration: sec(300) },
                    }}
                    fill="none" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
                    strokeDasharray={dashed ? (e.lost ? "1 7" : "10 7") : undefined}
                    opacity={e.lost ? 0.85 : 1}
                  />
              );
            })}
          </g>
          ))}

          {/* stops */}
          {layout.stops.map((s) => {
            const lane = lanes.get(s.laneId);
            const color = s.lost ? GHOST : laneColor(lane).line;
            const tip = layout.branchLabels.some((b) => b.oid === s.oid) || layout.heads.some((h) => h.oid === s.oid);
            const r = s.merge ? STOP_R + 2 : tip ? STOP_R + 1.2 : STOP_R;
            const fresh = isNew(s.oid);
            const delay = moveAt(s);
            const loseAt = schedule.lose.get(s.oid);
            const recoverAt = schedule.recover.get(s.oid);
            return (
              <motion.g
                key={s.oid}
                initial={false}
                animate={{ x: g.x(s.col), y: g.y(s.row) }}
                transition={glide(delay, loseAt !== undefined ? "drop" : recoverAt !== undefined ? "lift" : "soft")}
                onMouseEnter={() => setHover(s.oid)}
                onMouseLeave={() => setHover((h) => (h === s.oid ? null : h))}
                style={{ cursor: "default" }}
              >
                <title>{`${s.short} ${s.message} (${actorName(s.author)})${s.lost ? ", lost" : ""}`}</title>
                <motion.g
                  initial={fresh ? { scale: 0 } : false}
                  animate={loseAt !== undefined && !reduce ? { scale: 1, rotate: [0, -8, 7, -4, 0] } : { scale: 1, rotate: 0 }}
                  transition={
                    loseAt !== undefined && !reduce
                      ? { rotate: { delay: sec(loseAt), duration: 0.42 }, scale: { duration: 0 } }
                      : { delay: sec(appearAt(s.oid) + 180), type: "spring", stiffness: 420, damping: 14 }
                  }
                >
                  <circle r={r + 7} fill="transparent" />
                  <motion.circle
                    r={r}
                    initial={false}
                    animate={{ stroke: color, fill: s.lost ? "#F4EEE2" : "#FFFFFF" }}
                    transition={{ delay: sec(loseAt ?? recoverAt ?? 0), duration: sec(250) }}
                    strokeWidth={s.merge ? 4 : 3.5}
                    strokeDasharray={s.lost ? "3 2.4" : undefined}
                  />
                  {s.merge && !s.lost && <circle r={2.6} fill={INK} />}
                  <AnimatePresence>
                    {s.lost && (
                      <motion.path
                        key="crack"
                        d={`M${-r - 1} ${-r + 1} L${-1.5} ${-1} L${-3.5} ${2.5} L${r + 1} ${r}`}
                        fill="none" stroke={INK_SOFT} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
                        initial={prev && loseAt !== undefined ? { pathLength: 0 } : false}
                        animate={{ pathLength: 1, opacity: 1 }}
                        exit={{ opacity: 0, transition: { delay: sec(recoverAt ?? 0), duration: sec(300) } }}
                        transition={{ delay: sec(loseAt ?? 0), duration: sec(260) }}
                      />
                    )}
                  </AnimatePresence>
                </motion.g>
                {showOid(s) && (
                  <text
                    y={r + 15} textAnchor="middle" fontSize={10} fontFamily={MONO}
                    fill={s.lost ? GHOST : INK_SOFT}
                  >
                    {s.short}
                  </text>
                )}
              </motion.g>
            );
          })}

          {/* line-end labels */}
          {layout.branchLabels.filter(atEnd).map((b) => {
            const lane = lanes.get(b.laneId);
            const c = laneColor(lane);
            const w = monoWidth(b.name, 12) + 20;
            const at = schedule.branch.get(b.name);
            const delay = at ? at.at + (isNew(b.oid) ? 180 : 0) : 0;
            return (
              <motion.g
                key={`label:${b.name}`}
                initial={prev && !prev.branchLabels.some((p) => p.name === b.name) ? { x: g.x(b.col), y: g.y(b.row), opacity: 0 } : false}
                animate={{ x: g.x(b.col), y: g.y(b.row), opacity: 1 }}
                transition={glide(delay, at?.motion === "snap" ? "snap" : "soft")}
              >
                <g transform={`translate(${STOP_R + 10 + (headsByOid.has(b.oid) ? ((headsByOid.get(b.oid)!.length - 1) / 2) * SLOT_GAP + 12 : 0)} 0)`}>
                  <rect x={0} y={-11} width={w} height={22} rx={11} fill={c.deep} />
                  <text x={10} y={4} fontSize={12} fontWeight={700} fontFamily={MONO} fill="#fff">{b.name}</text>
                </g>
              </motion.g>
            );
          })}

          {/* tags under stops */}
          {[...tagsByOid.entries()].flatMap(([oid, tags]) => {
            const s = stopsByOid.get(oid);
            if (!s) return [];
            return tags.map((t, i) => {
              const fs = 10.5;
              const w = monoWidth(t.text, fs) + 24;
              const y = g.y(s.row) + STOP_R + 30 + i * 19;
              const remote = t.ref ? schedule.remote.get(t.ref) : undefined;
              const branch = t.kind === "branch" ? schedule.branch.get(t.text) : undefined;
              const delay = remote?.at ?? branch?.at ?? moveAt(s);
              const c = actorColor(t.actor);
              const style = {
                branch: { fill: "#FFFFFF", stroke: c.line, text: INK, dash: undefined },
                remote: { fill: "#E9E1D1", stroke: "#CFC3AE", text: INK, dash: undefined },
                tracking: { fill: "transparent", stroke: GHOST, text: INK_SOFT, dash: "3 3" },
                stash: { fill: "#FFF6DC", stroke: actorColor("hoarder").line, text: INK, dash: "4 3" },
              }[t.kind];
              return (
                <motion.g
                  key={t.key}
                  initial={prev && !prevStops.has(oid) ? { x: g.x(s.col), y, opacity: 0 } : false}
                  animate={{ x: g.x(s.col), y, opacity: 1 }}
                  transition={glide(delay, branch?.motion === "snap" || remote?.forced ? "snap" : "soft")}
                >
                  <title>
                    {t.kind === "tracking" ? `${t.text}: where this repository last saw the remote branch` :
                      t.kind === "remote" ? `${t.text}: the branch on the server` :
                        t.kind === "stash" ? `${t.text}: stashed work based here` : `branch ${t.text}`}
                  </title>
                  <rect x={-w / 2} y={-9} width={w} height={18} rx={9} fill={style.fill} stroke={style.stroke} strokeWidth={1.4} strokeDasharray={style.dash} />
                  {t.kind === "branch" && <circle cx={-w / 2 + 9} cy={0} r={3} fill={c.line} />}
                  {(t.kind === "remote" || t.kind === "tracking") && (
                    <path d={`M${-w / 2 + 6} 2.5 a2.6 2.6 0 0 1 1.2-4.9 a3.4 3.4 0 0 1 6.4 0.6 a2.2 2.2 0 0 1 0.2 4.3 z`} fill={t.kind === "remote" ? INK_SOFT : "none"} stroke={INK_SOFT} strokeWidth={0.9} />
                  )}
                  <text x={-w / 2 + 17} y={3.6} fontSize={fs} fontFamily={MONO} fontWeight={600} fill={style.text}>{t.text}</text>
                  {remote?.forced && !reduce && (
                    <motion.g
                      key={`forced-${play}`}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.15, 1, 1] }}
                      transition={{ delay: sec(remote.at), duration: 2.4, times: [0, 0.12, 0.8, 1] }}
                    >
                      <rect x={w / 2 + 6} y={-10} width={96} height={20} rx={10} fill={WARN} />
                      <text x={w / 2 + 54} y={4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff" letterSpacing="0.04em">FORCE-PUSHED</text>
                    </motion.g>
                  )}
                </motion.g>
              );
            });
          })}

          {/* robots */}
          {layout.heads.map((h) => {
            const before = prevHeads.get(h.actor);
            const moved = !!before && before.oid !== h.oid;
            const appeared = !!prev && !before;
            const x = g.x(h.col) + slotDx(h);
            const y = g.y(h.row) - STOP_R - 2;
            const prevX = before ? g.x(before.col) + slotDx(before) : x;
            const facing: Facing = moved && x < prevX - 1 ? "left" : "right";
            const target = stopsByOid.get(h.oid)!;
            const delay = (schedule.actorMove.get(h.actor) ?? moveAt(target)) + (isNew(h.oid) ? 180 : 0);
            const mood: Mood = moods?.[h.actor] ?? (h.conflicted ? "scared" : "idle");
            const conflictAt = schedule.conflict.get(h.actor) ?? 0;
            return (
              <motion.g
                key={`robot:${h.actor}`}
                initial={appeared ? { x, y: y - 30, opacity: 0 } : false}
                animate={{ x, y, opacity: 1 }}
                transition={moved || appeared ? { ...glide(delay), type: "tween", duration: reduce ? 0 : 0.55, ease: "easeInOut" } : glide(moveAt(target))}
              >
                <title>{`${actorName(h.actor)} ${h.detached ? `(detached at ${h.oid.slice(0, 7)})` : `on ${h.branch}`}${h.conflicted ? ", has a conflict" : ""}`}</title>
                <motion.g
                  key={`hop-${h.oid}-${play}`}
                  initial={{ y: 0 }}
                  animate={moved && !reduce ? { y: [0, -26, 0, -4, 0] } : { y: 0 }}
                  transition={moved && !reduce ? { delay: sec(delay), duration: 0.7, times: [0, 0.4, 0.75, 0.88, 1], ease: "easeOut" } : { duration: 0 }}
                  filter={`url(#${uid}-lift)`}
                >
                  <RobotMarker actor={h.actor} mood={mood} facing={facing} still={reduce} />
                </motion.g>
                <AnimatePresence>
                  {h.conflicted && (
                    <motion.g
                      key="warn"
                      initial={prev ? { scale: 0, opacity: 0 } : false}
                      animate={reduce ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1, rotate: [0, -12, 10, -6, 0] }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ delay: sec(conflictAt), type: "spring", stiffness: 380, damping: 12, rotate: { delay: sec(conflictAt + 200), duration: 0.6, repeat: reduce ? 0 : 2, repeatDelay: 1.4 } }}
                      style={{ originX: "50%", originY: "100%" }}
                    >
                      <g transform="translate(-19 -60) scale(1.3)">
                        <path d="M0 -11 L11 8 L-11 8 Z" fill={WARN} stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
                        <rect x={-1.3} y={-5} width={2.6} height={7} rx={1.3} fill="#fff" />
                        <circle cx={0} cy={4.6} r={1.5} fill="#fff" />
                      </g>
                    </motion.g>
                  )}
                </AnimatePresence>
              </motion.g>
            );
          })}

          {/* robot names, to the right of each group of robots */}
          {[...headsByOid.entries()].map(([oid, hs]) => {
            const s = stopsByOid.get(oid)!;
            const delay = Math.max(...hs.map((h) => schedule.actorMove.get(h.actor) ?? moveAt(s))) + (isNew(oid) ? 180 : 0);
            const groupHalf = ((hs.length - 1) / 2) * SLOT_GAP + 16;
            return (
              <motion.g
                key={`names:${hs.map((h) => h.actor).join(",")}`}
                initial={prev ? { x: g.x(s.col) + groupHalf + 4, y: g.y(s.row), opacity: 0 } : false}
                animate={{ x: g.x(s.col) + groupHalf + 4, y: g.y(s.row), opacity: 1 }}
                transition={glide(delay)}
              >
                {hs.map((h, i) => {
                  const c = actorColor(h.actor);
                  const label = h.detached ? `${actorName(h.actor)} · detached` : actorName(h.actor);
                  const w = label.length * 6.6 + 22;
                  const y = -44 - (hs.length - 1 - i) * 20;
                  return (
                    <g key={h.actor} transform={`translate(0 ${y})`}>
                      <rect x={0} y={-9} width={w} height={18} rx={9} fill="#FFFFFF" stroke={c.line} strokeWidth={1.4} />
                      <circle cx={9} cy={0} r={3.2} fill={c.line} />
                      <text x={16} y={4} fontSize={11.5} fontWeight={650} fill={INK}>{label}</text>
                    </g>
                  );
                })}
              </motion.g>
            );
          })}

          {/* hover card */}
          {hover && stopsByOid.has(hover) && (() => {
            const s = stopsByOid.get(hover)!;
            const text = s.message.length > 44 ? `${s.message.slice(0, 43)}…` : s.message;
            const w = Math.max(text.length * 6.7, 120) + 24;
            const x = Math.min(Math.max(g.x(s.col) - w / 2, 8), g.width - w - 8);
            const y = g.y(s.row) + STOP_R + 22;
            return (
              <g pointerEvents="none" filter={`url(#${uid}-lift)`}>
                <rect x={x} y={y} width={w} height={44} rx={10} fill="#FFFFFF" stroke="#E2D8C6" />
                <text x={x + 12} y={y + 18} fontSize={12} fontWeight={650} fill={INK}>{text}</text>
                <text x={x + 12} y={y + 34} fontSize={10.5} fontFamily={MONO} fill={INK_SOFT}>
                  {`${s.short} · ${actorName(s.author)}${s.lost ? " · lost" : ""}`}
                </text>
              </g>
            );
          })()}
        </motion.g>

        {/* red flash on a forced push */}
        {schedule.shakes.length > 0 && !reduce && (
          <motion.rect
            key={`flash-${play}`}
            x={0} y={0} width={g.width} height={g.height} fill={WARN} pointerEvents="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.14, 0] }}
            transition={{ delay: sec(schedule.shakes[0]), duration: 0.6 }}
          />
        )}
      </svg>}
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

