import type { Metadata } from "next";
import { Showcase } from "./Showcase";

export const metadata: Metadata = {
  title: "Map showcase · Merge Crew",
  description: "Development page for reviewing the history map and its animations.",
  robots: { index: false },
};

export default function PlayPage() {
  return <Showcase />;
}
