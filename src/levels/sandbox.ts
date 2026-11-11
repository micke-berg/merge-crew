// The sandbox: an empty repository with no goals and no script, for trying things out.
// It is a Level so the ordinary level screen can play it, but it is in no list and can never be won.

import type { Level } from "@/engine/types";
import { write } from "./script";

export const sandbox: Level = {
  id: "sandbox",
  act: 1,
  order: 0,
  title: "Sandbox",
  brief: "A repository of your own, with no goals. Try anything.",
  crew: [],
  setup: [write("player", "notes.txt", "Try things here. Nothing can break.\n")],
  intro: [],
  goals: [],
  suggestions: ["git status", "git add notes.txt", "git commit -m \"First save\"", "git switch -c idea", "git log --oneline --all", "git push -u origin main"],
  outro: [],
};

/** A file name the sandbox accepts: plain letters, digits, dots, dashes and folders. Nothing that needs quoting, and no leading dash, which git would read as a flag. */
export function validFileName(name: string): boolean {
  return name.length <= 40 && /^[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/.test(name) && !name.split("/").includes(".git");
}
