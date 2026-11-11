import type { Metadata } from "next";
import { DailyScreen } from "@/components/game/DailyScreen";

export const metadata: Metadata = {
  title: "Today's incident · Merge Crew",
  description: "One small broken repository a day, the same for everyone. Fix it with real git commands in as few as you can.",
};

export default function DailyPage() {
  return <DailyScreen />;
}
