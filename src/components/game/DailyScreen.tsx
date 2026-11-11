"use client";

import { incidentLevel } from "@/daily/daily";
import { useToday } from "@/daily/dailyStorage";
import { LevelGame } from "./LevelScreen";

/** Today's incident: the level the date picks, played like any other, with the day's number on it. */
export function DailyScreen() {
  const today = useToday();
  const level = today === null ? null : incidentLevel(today);
  // Nothing is drawn until the browser knows the day, so the server and the browser never disagree.
  if (today === null || !level) return <div className="min-h-dvh bg-desk" aria-busy="true" />;
  return <LevelGame key={`daily-${today}`} level={level} daily={today} />;
}
