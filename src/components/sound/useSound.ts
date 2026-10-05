"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { Mood, RobotId } from "@/engine/types";
import { sound, type StopHandle } from "./engine";

const subscribe = (cb: () => void) => sound.subscribe(cb);
const mutedSnapshot = () => sound.isMuted();
const serverMuted = () => false;

let armed = false;

/** Unlocks audio on the first pointer or key press anywhere on the page. Runs once per page view. */
export function armUnlock(): void {
  if (armed || typeof window === "undefined") return;
  armed = true;
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const unlock = () => {
    sound.unlock();
    if (sound.unlocked) for (const e of events) window.removeEventListener(e, unlock, true);
  };
  for (const e of events) window.addEventListener(e, unlock, true);
}

/**
 * The sound engine for components. Using the hook anywhere also arms the unlock on the player's
 * first click or key press, so nothing plays before they interact.
 */
export function useSound() {
  const muted = useSyncExternalStore(subscribe, mutedSnapshot, serverMuted);
  useEffect(armUnlock, []);
  return useMemo(
    () => ({
      muted,
      setMuted: (m: boolean) => sound.setMuted(m),
      toggleMuted: () => sound.toggleMuted(),
      setVolume: (v: number) => sound.setVolume(v),
      unlock: () => sound.unlock(),
      play: sound.play.bind(sound),
      playSchedule: sound.playSchedule.bind(sound),
      speak: sound.speak.bind(sound),
      stopSpeaking: () => sound.stopSpeaking(),
    }),
    [muted],
  );
}

/**
 * Speaks one dialogue line while it types out. Mount it inside the component that shows one line
 * (it restarts when the text changes). `typing` is true while characters are still appearing: when
 * the player skips to the full text, the voice stops a moment later. With `instant` (reduced motion,
 * the text shows at once) the robot says a short burst instead of the whole line.
 */
export function useLineVoice(
  robot: RobotId,
  mood: Mood | undefined,
  text: string,
  { typing, instant = false, charsPerSecond }: { typing: boolean; instant?: boolean; charsPerSecond?: number },
): void {
  const handle = useRef<StopHandle | null>(null);
  useEffect(armUnlock, []);

  useEffect(() => {
    const h = sound.speak(robot, mood, text, instant ? { maxSeconds: 0.45 } : { charsPerSecond });
    handle.current = h;
    return () => {
      h.stop();
      if (handle.current === h) handle.current = null;
    };
  }, [robot, mood, text, instant, charsPerSecond]);

  useEffect(() => {
    if (typing || instant) return;
    // Let the last blip ring out, then stop anything still queued.
    const h = handle.current;
    const t = setTimeout(() => h?.stop(), 90);
    return () => clearTimeout(t);
  }, [typing, instant]);
}
