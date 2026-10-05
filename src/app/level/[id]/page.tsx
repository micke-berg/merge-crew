import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LevelScreen } from "@/components/game/LevelScreen";
import { getLevel, levels } from "@/levels";

type Params = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return levels.map((l) => ({ id: l.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const level = getLevel((await params).id);
  return { title: level ? `${level.title} · Merge Crew` : "Merge Crew", description: level?.brief };
}

export default async function LevelPage({ params }: Params) {
  const { id } = await params;
  if (!getLevel(id)) notFound();
  return <LevelScreen levelId={id} />;
}
