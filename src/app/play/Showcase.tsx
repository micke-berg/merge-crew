"use client";

// Development showcase for the history map. Renders each fixture and replays scripted events.
// The command box and files panel are static placeholders that show the screen composition.

import { useEffect, useRef, useState } from "react";
import type { EngineEvent, RepoState } from "@/engine/types";
import { HistoryMap } from "@/components/map/HistoryMap";
import { FIXTURES, type Fixture, type Scene } from "@/components/map/fixtures";
import { ACTOR_ORDER, actorColor } from "@/components/map/palette";

type Shown = { state: RepoState; events: EngineEvent[]; scene: Scene | null; mapKey: number };

const SUGGESTIONS = ["git status", "git log --oneline --graph", "git reflog", "git switch -c rescue"];

export function Showcase() {
  const [fixture, setFixture] = useState<Fixture>(FIXTURES[0]);
  const [shown, setShown] = useState<Shown>({ state: FIXTURES[0].state, events: [], scene: null, mapKey: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const choose = (f: Fixture) => {
    if (timer.current) clearTimeout(timer.current);
    setFixture(f);
    setShown((s) => ({ state: f.state, events: [], scene: null, mapKey: s.mapKey + 1 }));
  };

  const playScene = (scene: Scene) => {
    if (timer.current) clearTimeout(timer.current);
    // Mount the map on the "before" state, then hand it the "after" state and the events.
    setShown((s) => ({ state: scene.before, events: [], scene: null, mapKey: s.mapKey + 1 }));
    timer.current = setTimeout(() => {
      setShown((s) => ({ ...s, state: scene.after, events: scene.events, scene }));
    }, 500);
  };

  const player = shown.state.worktrees.player;
  const files = player ? Object.keys(player.workingTree).sort() : [];
  const head = player ? (player.head.kind === "branch" ? player.head.name : `detached ${player.head.oid.slice(0, 7)}`) : "none";

  return (
    <div className="flex min-h-dvh flex-col bg-[#EAE1D0] text-[#26283B] lg:h-dvh">
      {/* top bar */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 pt-4 pb-3 md:px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-bold tracking-tight">Merge Crew</h1>
          <span className="rounded-full bg-[#26283B] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#F7F1E5]">map showcase · dev</span>
        </div>
        <nav aria-label="Fixtures" className="flex flex-wrap gap-1 rounded-full bg-[#DDD2BE] p-1">
          {FIXTURES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => choose(f)}
              aria-pressed={f.id === fixture.id}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                f.id === fixture.id ? "bg-[#FFFDF8] text-[#26283B] shadow-sm" : "text-[#5D5649] hover:text-[#26283B]"
              }`}
            >
              {f.title}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 md:px-6">
        <p className="mr-2 max-w-xl text-sm text-[#5D5649]">{fixture.blurb}</p>
        {fixture.scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => playScene(scene)}
            className="inline-flex items-center gap-2 rounded-full bg-[#26283B] px-3.5 py-1.5 text-sm font-semibold text-[#F7F1E5] shadow-[0_2px_0_#11121c] transition-transform hover:-translate-y-px active:translate-y-px"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M1 0.5 L9.5 5 L1 9.5 Z" fill="currentColor" /></svg>
            {scene.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => choose(fixture)}
          className="rounded-full border border-[#B9AD97] px-3 py-1.5 text-sm font-medium text-[#5D5649] hover:bg-[#F3ECDF]"
        >
          Reset
        </button>
      </div>

      {/* game screen composition */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)_auto]">
        <section
          aria-label="History map"
          className="relative h-[56dvh] min-h-[360px] overflow-hidden rounded-3xl lg:h-auto border border-[#D8CCB5] shadow-[0_1px_0_#fff_inset,0_10px_30px_-12px_rgba(74,58,32,0.35)]"
        >
          <HistoryMap
            key={shown.mapKey}
            state={shown.state}
            events={shown.events}
            moods={shown.scene?.moods}
            className="absolute inset-0"
          />
          <Legend />
        </section>

        {/* files panel placeholder */}
        <aside
          aria-label="Files (placeholder)"
          className="flex min-h-0 flex-col gap-3 rounded-3xl border border-[#D8CCB5] bg-[#FBF8F1] p-4 lg:order-none lg:row-span-2 order-last"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Files</h2>
            <span className="font-mono text-[11px] text-[#7A7264]">placeholder</span>
          </div>
          <div className="flex gap-1 rounded-full bg-[#EDE5D6] p-1 text-xs font-semibold">
            <span className="flex-1 rounded-full bg-white py-1 text-center shadow-sm">Working</span>
            <span className="flex-1 py-1 text-center text-[#7A7264]">Staged</span>
          </div>
          <p className="font-mono text-[11px] text-[#7A7264]">/repo · on {head}</p>
          <ul className="grid max-h-48 min-h-0 grid-cols-2 gap-1 overflow-auto sm:grid-cols-3 lg:flex lg:max-h-none lg:flex-col">
            {files.length === 0 && <li className="text-sm text-[#7A7264]">No files yet.</li>}
            {files.map((f, i) => (
              <li key={f} className="flex items-center gap-2 rounded-lg px-2 py-1 font-mono text-[12px] hover:bg-[#F1EADC]">
                <span className={`w-4 text-center font-bold ${i === files.length - 1 ? "text-[#B45309]" : "text-[#A59C8C]"}`}>
                  {i === files.length - 1 ? "M" : "·"}
                </span>
                <span className="truncate">{f}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* command box placeholder */}
        <section aria-label="Command box (placeholder)" className="rounded-3xl bg-[#26283B] p-3 text-[#F7F1E5] shadow-[0_10px_30px_-12px_rgba(20,20,40,0.6)]">
          <div className="flex items-center gap-3 rounded-2xl bg-[#1B1D2C] px-4 py-3 font-mono text-sm">
            <span className="text-[#7FD1B9]">you@/repo</span>
            <span className="text-[#8D90A8]">$</span>
            <span className="text-[#8D90A8]">type a git command…</span>
            <span className="ml-auto h-4 w-2 animate-pulse rounded-sm bg-[#F7F1E5]/70 motion-reduce:animate-none" aria-hidden />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 px-1">
            {SUGGESTIONS.map((s) => (
              <span key={s} className="rounded-full border border-[#44475F] px-3 py-1 font-mono text-[12px] text-[#C9CBDA]">{s}</span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Legend() {
  return (
    <ul
      aria-label="Crew colours"
      className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5 rounded-full bg-[#FFFDF8]/85 px-2 py-1 backdrop-blur-sm"
    >
      {ACTOR_ORDER.map((a) => {
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
