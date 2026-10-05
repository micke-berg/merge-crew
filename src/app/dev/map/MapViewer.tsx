"use client";

// Development viewer for the history map: renders each fixture and replays its scripted scenes.

import { useEffect, useRef, useState } from "react";
import type { EngineEvent, RepoState } from "@/engine/types";
import { HistoryMap } from "@/components/map/HistoryMap";
import { FIXTURES, type Fixture, type Scene } from "@/components/map/fixtures";
import { ACTOR_ORDER, actorColor } from "@/lib/palette";

type Shown = { state: RepoState; events: EngineEvent[]; scene: Scene | null; mapKey: number };

export function MapViewer() {
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

  return (
    <div className="flex min-h-dvh flex-col bg-desk text-ink lg:h-dvh">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 pt-4 pb-3 md:px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-bold tracking-tight">Merge Crew</h1>
          <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-[11px] font-semibold text-paper">map viewer · dev</span>
        </div>
        <nav aria-label="Fixtures" className="flex flex-wrap gap-1 rounded-full bg-chip p-1">
          {FIXTURES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => choose(f)}
              aria-pressed={f.id === fixture.id}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                f.id === fixture.id ? "bg-card text-ink shadow-sm" : "text-soft hover:text-ink"
              }`}
            >
              {f.title}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 md:px-6">
        <p className="mr-2 max-w-xl text-sm text-soft">{fixture.blurb}</p>
        {fixture.scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => playScene(scene)}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-sm font-semibold text-paper shadow-[0_2px_0_var(--color-ink-shadow)] transition-transform hover:-translate-y-px active:translate-y-px"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M1 0.5 L9.5 5 L1 9.5 Z" fill="currentColor" /></svg>
            {scene.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => choose(fixture)}
          className="rounded-full border border-line-button px-3 py-1.5 text-sm font-medium text-soft hover:bg-sunk"
        >
          Reset
        </button>
      </div>

      <main className="min-h-0 flex-1 px-4 pb-4 md:px-6">
        <section
          aria-label="History map"
          className="relative h-[70dvh] min-h-[360px] overflow-hidden rounded-3xl border border-line shadow-[0_1px_0_white_inset,0_10px_30px_-12px_rgba(74,58,32,0.35)] lg:h-full"
        >
          <HistoryMap
            key={shown.mapKey}
            state={shown.state}
            events={shown.events}
            moods={shown.scene?.moods}
            className="absolute inset-0"
          />
          <ul
            aria-label="Crew colours"
            className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5 rounded-full bg-card/85 px-2 py-1 backdrop-blur-sm"
          >
            {ACTOR_ORDER.map((a) => {
              const c = actorColor(a);
              return (
                <li key={a} className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-ink">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.line }} aria-hidden />
                  {c.name}
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
