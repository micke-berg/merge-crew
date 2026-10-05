import type { Metadata } from "next";
import { StartScreen } from "@/components/game/StartScreen";

export const metadata: Metadata = {
  title: "Merge Crew",
  description: "A free browser game that teaches git. Lead a crew of robot coding agents and fix their mistakes with real git commands.",
};

export default function Home() {
  return <StartScreen />;
}
