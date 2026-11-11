import type { Metadata } from "next";
import { SandboxScreen } from "@/components/game/SandboxScreen";

export const metadata: Metadata = {
  title: "Sandbox · Merge Crew",
  description: "A git repository of your own in the browser, with no goals. Make files, commit, branch, merge and watch the history draw itself.",
};

export default function SandboxPage() {
  return <SandboxScreen />;
}
