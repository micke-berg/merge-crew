"use client";

import { sandbox } from "@/levels/sandbox";
import { LevelGame } from "./LevelScreen";

/** Free play: the ordinary level screen on an empty repository, with no goals, no hints and files the player can write. */
export function SandboxScreen() {
  return <LevelGame level={sandbox} sandbox />;
}
