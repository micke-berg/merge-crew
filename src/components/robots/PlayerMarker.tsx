// The player is not a robot. "You" is a game piece: a rounded pawn drawn in the same flat,
// dark-outlined style as the Pocket Machines, in the player's blue. Origin is the base centre.

import { TOKENS, actorColor } from "@/lib/palette";
import type { ActorId } from "@/engine/types";

/** Outline colour of the Pocket Machines art. */
export const ART_INK = TOKENS["art-ink"];

/** Height of the pawn in its own units, before `height` scaling. */
const BASE = 40;

export function PlayerMarker({ height = BASE, actor = "player" }: { height?: number; actor?: ActorId }) {
  const c = actorColor(actor);
  const k = height / BASE;
  const stroke = 2.2;
  return (
    <g transform={k === 1 ? undefined : `scale(${k})`}>
      {/* base and body */}
      <path
        d="M-13 -1.2 Q-13 -5.6 -8.6 -6.4 Q-8.4 -17 -4.6 -20.6 L4.6 -20.6 Q8.4 -17 8.6 -6.4 Q13 -5.6 13 -1.2 Q13 0 11.6 0 L-11.6 0 Q-13 0 -13 -1.2 Z"
        fill={c.line} stroke={ART_INK} strokeWidth={stroke} strokeLinejoin="round"
      />
      <path d="M-8.6 -6.4 Q0 -4.4 8.6 -6.4" fill="none" stroke={ART_INK} strokeWidth={stroke * 0.7} strokeLinecap="round" />
      <path d="M3 -18.6 Q6.6 -14 6.8 -7.4" fill="none" stroke={c.deep} strokeWidth={2.6} strokeLinecap="round" opacity={0.55} />
      {/* collar */}
      <rect x={-7.4} y={-23.6} width={14.8} height={4.6} rx={2.3} fill={c.tint} stroke={ART_INK} strokeWidth={stroke} />
      {/* head */}
      <circle cx={0} cy={-31.2} r={8.4} fill={c.line} stroke={ART_INK} strokeWidth={stroke} />
      <ellipse cx={-2.8} cy={-34} rx={2.6} ry={1.8} fill="white" opacity={0.55} transform="rotate(-30 -2.8 -34)" />
    </g>
  );
}
