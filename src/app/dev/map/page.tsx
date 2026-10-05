import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapViewer } from "./MapViewer";

export const metadata: Metadata = {
  title: "Map viewer · Merge Crew",
  description: "Development page for reviewing the history map and its animations.",
  robots: { index: false },
};

/** Only served by `next dev`. Production builds answer with a 404. */
export default function DevMapPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MapViewer />;
}
