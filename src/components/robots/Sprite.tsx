"use client";

// Plays one Pocket Machines sheet. The sheet is a single row of frames; a CSS steps() animation
// slides it behind a frame-sized window, so playback costs no JavaScript per frame.
// Two renderers share the same playback rules: <Sprite> for HTML and <SvgSprite> for the SVG map.

import { useReducedMotion } from "motion/react";
import { useState, type CSSProperties } from "react";
import { preload } from "react-dom";
import { ANCHOR, ANIMATIONS, ART_HEIGHT, CROP, FRAMES, sheetUrl, type SheetSize, type SpriteRobot, type SpriteState } from "./sheets.generated";
import { STILL_FRAME, cycleSeconds, restAfter, type Rest } from "./moods";

export type Facing = "left" | "right";

type PlaybackProps = {
  robot: SpriteRobot;
  state: SpriteState;
  facing?: Facing;
  /** Which sheet resolution to load. */
  size?: SheetSize;
  /** What a one-shot state turns into when it ends. Defaults to restAfter(state). */
  rest?: Rest;
  /** Change to replay the same state from its first frame. */
  playKey?: string | number;
  /** Called once when a one-shot state finishes (never for loops or with reduced motion). */
  onEnd?: () => void;
  /** Show a single frame. Reduced motion always does. */
  still?: boolean;
};

/** Frame window size and anchor position for resting artwork `artHeight` units tall. */
export function spriteBox(artHeight: number) {
  const s = artHeight / ART_HEIGHT;
  return { scale: s, width: CROP.width * s, height: CROP.height * s, anchorX: ANCHOR.x * s, anchorY: ANCHOR.y * s };
}

function usePlayback({ state, rest, playKey = 0, onEnd, still = false }: PlaybackProps) {
  const reduce = useReducedMotion() ?? false;
  const id = `${state}:${playKey}`;
  // Forget an ended one-shot as soon as a different state (or a replay) is asked for, so coming
  // back to the same state later plays it again.
  const [track, setTrack] = useState({ id, ended: false });
  if (track.id !== id) setTrack({ id, ended: false });
  const ended = track.id === id && track.ended;
  const after = rest ?? restAfter(state);
  const shown: SpriteState = ended && after !== "hold" ? after : state;
  const anim = ANIMATIONS[shown];
  const frozen = still || reduce;

  const style: CSSProperties = frozen
    ? { transform: `translateX(${(-100 / FRAMES) * STILL_FRAME[state]}%)` }
    : ended && after === "hold"
      ? { transform: `translateX(${(-100 / FRAMES) * (FRAMES - 1)}%)` }
      : anim.loop
        ? { animation: `mc-sprite-loop ${cycleSeconds(shown)}s steps(${FRAMES}) infinite` }
        : { animation: `mc-sprite-once ${cycleSeconds(shown)}s steps(${FRAMES}, jump-none) forwards` };

  const onAnimationEnd = () => {
    if (anim.loop || ended || shown !== state) return;
    setTrack({ id, ended: true });
    onEnd?.();
  };
  // A new key restarts the CSS animation from frame one.
  return { shown, style, onAnimationEnd, key: `${shown}:${ended ? "rest" : "play"}:${playKey}` };
}

type SpriteProps = PlaybackProps & {
  /** Height of the resting artwork in CSS pixels. The frame window is a little larger. */
  artHeight: number;
  className?: string;
  style?: CSSProperties;
};

/** An HTML sprite: a frame-sized box. Position it by its anchor using spriteBox(). */
export function Sprite(props: SpriteProps) {
  const { robot, facing = "right", size = "portrait", artHeight, className, style } = props;
  const box = spriteBox(artHeight);
  const p = usePlayback(props);
  return (
    <span
      aria-hidden
      className={`block overflow-hidden ${className ?? ""}`}
      style={{
        width: box.width,
        height: box.height,
        transform: facing === "left" ? "scaleX(-1)" : undefined,
        transformOrigin: `${box.anchorX}px 0`,
        ...style,
      }}
    >
      <span
        key={p.key}
        className="mc-sprite block h-full"
        onAnimationEnd={p.onAnimationEnd}
        style={{
          width: `${FRAMES * 100}%`,
          backgroundImage: `url(${sheetUrl(size, robot, p.shown)})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          ...p.style,
        }}
      />
    </span>
  );
}

/** An SVG sprite whose ground anchor sits at the local origin. For use inside an <svg>. */
export function SvgSprite(props: PlaybackProps & { artHeight: number }) {
  const { robot, facing = "right", size = "map", artHeight } = props;
  const box = spriteBox(artHeight);
  const p = usePlayback(props);
  return (
    <g transform={facing === "left" ? "scale(-1 1)" : undefined}>
      <svg x={-box.anchorX} y={-box.anchorY} width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`} overflow="hidden">
        <image
          key={p.key}
          className="mc-sprite"
          href={sheetUrl(size, robot, p.shown)}
          width={box.width * FRAMES}
          height={box.height}
          preserveAspectRatio="none"
          onAnimationEnd={p.onAnimationEnd}
          style={{ transformBox: "fill-box", ...p.style }}
        />
      </svg>
    </g>
  );
}

/** Ask the browser to fetch sheets early, so a state change never shows an empty frame. */
export function preloadSheets(sheets: readonly { size: SheetSize; robot: SpriteRobot; state: SpriteState }[]) {
  for (const { size, robot, state } of sheets) preload(sheetUrl(size, robot, state), { as: "image", fetchPriority: "low" });
}
