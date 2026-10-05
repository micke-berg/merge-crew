"use client";

// A listening board for tuning: every robot voice in every mood, and every effect.
// Mount it temporarily on a dev page; it is not part of the game.

import { useState } from "react";
import type { Mood, RobotId } from "@/engine/types";
import { EFFECTS } from "./effects";
import { MuteButton } from "./MuteButton";
import { useSound } from "./useSound";
import { TYPEWRITER_CPS } from "./voices";

const ROBOTS: RobotId[] = ["tidy", "blaze", "drift", "hoarder"];
const MOODS: Mood[] = ["talking", "thinking", "happy", "celebrate", "scared", "surprised", "guilty"];
const SAMPLE = "Okay, so I pushed to main. Is that bad? It felt really fast!";

export function SoundDemo() {
  const { speak, play, stopSpeaking, unlock, setVolume } = useSound();
  const [text, setText] = useState(SAMPLE);
  const [volume, setVol] = useState(0.35);
  const [cps, setCps] = useState(Math.round(TYPEWRITER_CPS));

  const btn =
    "rounded-full border border-[#B9AD97] bg-[#FFFDF8] px-3 py-1 text-[13px] font-semibold text-[#5D5649] hover:bg-[#F3ECDF] hover:text-[#26283B] focus-visible:ring-4 focus-visible:ring-[#2563C9]/30 focus-visible:outline-none";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 font-sans text-[#26283B]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">Sound board</h1>
        <MuteButton />
        <label className="flex items-center gap-2 text-sm">
          Volume
          <input
            type="range" min={0} max={1} step={0.05} value={volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVol(v);
              setVolume(v);
            }}
          />
          {volume.toFixed(2)}
        </label>
        <label className="flex items-center gap-2 text-sm">
          Chars/s
          <input type="number" className="w-16 rounded border px-1" value={cps} onChange={(e) => setCps(Number(e.target.value) || 1)} />
        </label>
        <button type="button" className={btn} onClick={stopSpeaking}>Stop voice</button>
      </div>

      <textarea
        className="w-full rounded-xl border border-[#D8CCB5] bg-[#FFFDF8] p-3"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <section className="space-y-2">
        {ROBOTS.map((r) => (
          <div key={r} className="flex flex-wrap items-center gap-2">
            <span className="w-20 font-bold capitalize">{r}</span>
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                className={btn}
                onClick={() => {
                  unlock();
                  speak(r, m, text, { charsPerSecond: cps });
                }}
              >
                {m}
              </button>
            ))}
          </div>
        ))}
      </section>

      <section className="flex flex-wrap gap-2">
        {EFFECTS.map((e) => (
          <button
            key={e}
            type="button"
            className={btn}
            onClick={() => {
              unlock();
              play(e);
            }}
          >
            {e}
          </button>
        ))}
      </section>
    </div>
  );
}
