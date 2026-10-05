// Grid -> pixels for the history map. Pure, so the sizing rules can be tested.

import type { MapLayout } from "./layout";

export const PAD = { left: 72, right: 190, top: 76, bottom: 72 };
export const COL_GAP = { min: 52, max: 116 };
export const ROW_GAP = { min: 96, max: 112 };
/** Below this column gap, short oids are only shown on tips and on hover. */
export const OID_LABEL_MIN_GAP = 64;

export type Geometry = {
  /** Size in map units (the SVG viewBox). */
  width: number;
  height: number;
  /** Map units -> CSS pixels. Above 1 when a small history is zoomed in to fill the view. */
  scale: number;
  colGap: number;
  rowGap: number;
  x: (col: number) => number;
  y: (row: number) => number;
  /** True when the map is wider than the viewport and scrolls sideways. */
  scrolls: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Small histories are zoomed in (up to MAX_ZOOM) so three commits do not float in empty space.
 * Histories slightly too wide are zoomed out (down to MIN_ZOOM) before the map starts to scroll.
 */
export const MAX_ZOOM = 1.5;
export const MIN_ZOOM = 0.8;

export function geometry(layout: MapLayout, viewW: number, viewH: number): Geometry {
  const base = fit(layout, viewW, viewH);
  const room = Math.min(viewW / base.contentW, viewH / base.contentH);
  const zoom = room >= 1 ? clamp(room * 0.92, 1, MAX_ZOOM) : clamp(room, MIN_ZOOM, 1);
  if (zoom === 1) return { ...base.geometry, scale: 1 };
  return { ...fit(layout, viewW / zoom, viewH / zoom).geometry, scale: zoom };
}

function fit(layout: MapLayout, viewW: number, viewH: number) {
  const cols = Math.max(layout.columns, 1);
  const rowsUsed = layout.maxRow - layout.minRow + 1 + (layout.ghostRow !== null ? 1 : 0);
  const colGap = clamp((viewW - PAD.left - PAD.right) / Math.max(cols - 1, 1), COL_GAP.min, COL_GAP.max);
  const rowGap = clamp((viewH - PAD.top - PAD.bottom) / Math.max(rowsUsed - 1, 1), ROW_GAP.min, ROW_GAP.max);
  const contentW = PAD.left + (cols - 1) * colGap + PAD.right;
  const contentH = PAD.top + (rowsUsed - 1) * rowGap + PAD.bottom;
  const width = Math.max(viewW, contentW);
  const height = Math.max(viewH, contentH);
  const offX = (width - contentW) / 2;
  const offY = (height - contentH) / 2;
  const geometry: Omit<Geometry, "scale"> = {
    width, height, colGap, rowGap,
    scrolls: contentW > viewW + 1,
    x: (col) => offX + PAD.left + col * colGap,
    y: (row) => offY + PAD.top + (row - layout.minRow) * rowGap,
  };
  return { geometry, contentW, contentH };
}

/**
 * Every edge uses the same command shape (M L C L) so motion can morph one kind into another,
 * for example a fork that becomes a straight line when a branch is fast-forwarded.
 * Forks bend near the parent; merges travel along the branch row and bend near the merge commit.
 */
export function edgePath(
  kind: "straight" | "fork" | "merge",
  x1: number, y1: number, x2: number, y2: number, colGap: number,
): string {
  const r = (n: number) => Math.round(n * 10) / 10;
  if (kind === "straight" || y1 === y2) {
    return `M${r(x1)} ${r(y1)} L${r(x1)} ${r(y1)} C${r(x1)} ${r(y1)} ${r(x2)} ${r(y2)} ${r(x2)} ${r(y2)} L${r(x2)} ${r(y2)}`;
  }
  const d = Math.min(colGap * 0.95, x2 - x1);
  if (kind === "fork") {
    return `M${r(x1)} ${r(y1)} L${r(x1)} ${r(y1)} C${r(x1 + d * 0.55)} ${r(y1)} ${r(x1 + d * 0.45)} ${r(y2)} ${r(x1 + d)} ${r(y2)} L${r(x2)} ${r(y2)}`;
  }
  return `M${r(x1)} ${r(y1)} L${r(x2 - d)} ${r(y1)} C${r(x2 - d * 0.45)} ${r(y1)} ${r(x2 - d * 0.55)} ${r(y2)} ${r(x2)} ${r(y2)} L${r(x2)} ${r(y2)}`;
}

/** Rough width of a monospace label, good enough to size a pill. */
export function monoWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}
