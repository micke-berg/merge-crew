"use client";

// The guided-tour highlight: while a robot points at part of the screen, everything else dims a
// little and the part it means gets an outline in the robot's colour. Regions are found by their
// `data-tour` attribute, so the panels only have to name themselves.

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ScreenTarget } from "@/engine/types";
import { TOKENS } from "@/lib/palette";

type Box = { top: number; left: number; width: number; height: number; radius: number };

/** Space between the region and its outline. */
const GAP = 6;
/** Keep this much room to the window edge when scrolling a region into view. */
const MARGIN = 16;

/** Human names for the regions, for the screen-reader announcement. */
export const TARGET_NAMES: Record<ScreenTarget, string> = {
  map: "the history map",
  jobbar: "the Your job bar",
  terminal: "the command box",
  suggestions: "the suggested commands",
  goals: "the goals",
  files: "the files panel",
};

function regionOf(target: ScreenTarget): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

function measure(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  return {
    top: r.top - GAP,
    left: r.left - GAP,
    width: r.width + GAP * 2,
    height: r.height + GAP * 2,
    radius: radius + GAP,
  };
}

/**
 * Scroll so the region and the robot's line are both in view when they fit together, otherwise
 * bring the region itself to the middle. On wide screens nothing scrolls: everything is in view.
 */
function scrollIntoReach(el: HTMLElement, reduce: boolean) {
  const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
  const r = el.getBoundingClientRect();
  const line = document.querySelector<HTMLElement>("[data-dialogue]")?.getBoundingClientRect();
  const top = Math.min(r.top, line?.top ?? r.top);
  const bottom = Math.max(r.bottom, line?.bottom ?? r.bottom);
  const room = window.innerHeight - MARGIN * 2;
  if (bottom - top <= room) {
    if (top < MARGIN) window.scrollBy({ top: top - MARGIN, behavior });
    else if (bottom > window.innerHeight - MARGIN) window.scrollBy({ top: bottom - window.innerHeight + MARGIN, behavior });
  } else if (r.top < MARGIN || r.bottom > window.innerHeight - MARGIN) {
    el.scrollIntoView({ block: "center", behavior });
  }
}

export function TourSpotlight({ target, color, reduce }: { target: ScreenTarget | null; color: string; reduce: boolean }) {
  const [box, setBox] = useState<Box | null>(null);
  const last = useRef<Box | null>(null);

  // Follow the region every frame while it shows: the page scrolls, panels resize, lines animate.
  useEffect(() => {
    // With no target nothing is drawn (see below); forget the old box so the next one starts fresh.
    last.current = null;
    if (!target) return;
    let frame = 0;
    const tick = () => {
      const el = regionOf(target);
      const next = el ? measure(el) : null;
      const prev = last.current;
      const same =
        prev && next &&
        Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.left - next.left) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.height - next.height) < 0.5;
      if (!same && (prev || next)) {
        last.current = next;
        setBox(next);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [target]);

  // Where the page was before the robot started pointing; put back when it stops, so a tour that
  // scrolled down to the files does not leave the map half off screen.
  const home = useRef<number | null>(null);
  useEffect(() => {
    if (target && home.current === null) home.current = window.scrollY;
    if (!target && home.current !== null) {
      window.scrollTo({ top: home.current, behavior: reduce ? "auto" : "smooth" });
      home.current = null;
    }
  }, [target, reduce]);

  // Bring the region into view once per line, after the line has had a frame to lay out.
  useEffect(() => {
    if (!target) return;
    const t = window.setTimeout(() => {
      const el = regionOf(target);
      if (el) scrollIntoReach(el, reduce);
    }, 60);
    return () => window.clearTimeout(t);
  }, [target, reduce]);

  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 30 };
  return (
    <AnimatePresence>
      {target && box && (
        <motion.div
          key="spotlight"
          aria-hidden
          className="pointer-events-none fixed z-40"
          initial={{ opacity: 0, top: box.top, left: box.left, width: box.width, height: box.height }}
          animate={{ opacity: 1, top: box.top, left: box.left, width: box.width, height: box.height }}
          exit={{ opacity: 0 }}
          transition={{ ...spring, opacity: { duration: reduce ? 0 : 0.25 } }}
          style={{
            borderRadius: box.radius,
            // The dim is a huge shadow around the hole, so the region itself stays bright and clickable.
            boxShadow: `0 0 0 200vmax color-mix(in srgb, ${TOKENS.overlay} 30%, transparent)`,
          }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ borderRadius: box.radius, border: `3px solid ${color}` }}
            initial={false}
            animate={reduce ? { boxShadow: `0 0 0 4px ${color}33` } : { boxShadow: [`0 0 0 2px ${color}22`, `0 0 0 8px ${color}33`, `0 0 0 2px ${color}22`] }}
            transition={reduce ? { duration: 0 } : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
