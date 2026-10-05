// Safety checks on a hint, in code rather than in the prompt: the model is asked not to give the
// answer away, and these checks make sure it did not. Pure functions, shared by the route, the
// tests and the evals.

import type { FallbackReason } from "./types";

/** The longest hint shown, in characters. Tidy's hints are one or two short sentences. */
export const MAX_HINT_CHARS = 260;
export const MAX_HINT_SENTENCES = 2;

/**
 * Lower case, quotes and backticks dropped, whitespace collapsed. Applied to both sides of every
 * comparison, so `git commit -m "Fix"` and `git commit -m 'fix'` count as the same command.
 */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”'"`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A solution step as the command a player would type, e.g. ["git", "revert", "HEAD~1"]. */
export type SolutionCommand = readonly string[];

/** Subcommands whose second word picks the real action (`git stash branch` is not `git stash list`). */
const TWO_WORD = new Set(["stash", "remote", "worktree"]);

function commandKey(argv: readonly string[]): string[] {
  const [, sub, second] = argv.map(normalise);
  return sub && TWO_WORD.has(sub) && second ? [sub, second] : sub ? [sub] : [];
}

/**
 * The arguments of a step that pin down the answer: everything after the subcommand that is not a
 * flag. A command that names one of them (`git revert HEAD~1`, `git branch x main@{1}`) gives the
 * fix away even when the rest of the line differs from the documented solution.
 */
function telltaleArgs(argv: readonly string[]): string[] {
  const key = commandKey(argv);
  return argv
    .slice(1 + key.length)
    .filter((a) => !a.startsWith("-"))
    .map(normalise)
    .filter((a) => a.length > 0);
}

/** Every `git ...` phrase in a normalised hint, up to the end of its clause. */
function gitPhrases(hint: string): string[] {
  const out: string[] = [];
  for (const m of hint.matchAll(/\bgit ([^,;:!?\n]*?)(?=[,;:!?\n]|\.(?:\s|$)|$)/g)) out.push(`git ${m[1]}`.trim());
  return out;
}

/**
 * Git subcommands a hint might name. Matching a list rather than any word after "git" keeps plain
 * sentences such as "git keeps a diary" or "git stops on the conflict" allowed.
 */
const SUBCOMMANDS = [
  "add", "am", "apply", "archive", "bisect", "blame", "branch", "checkout", "cherry-pick", "clean", "clone", "commit",
  "config", "describe", "diff", "fetch", "gc", "grep", "help", "init", "log", "ls-files", "merge", "mv", "notes", "pull",
  "push", "rebase", "reflog", "remote", "reset", "restore", "revert", "rm", "shortlog", "show", "stash", "status",
  "submodule", "switch", "tag", "worktree",
];
const GIT_COMMAND = new RegExp(`\\bgit (?:${SUBCOMMANDS.map((c) => c.replace("-", "\\-")).join("|")})(?![\\w-])`);

/** Hints from this number on may name a git command; earlier ones must stay with ideas and places. */
export const FIRST_COMMAND_HINT = 3;

export type LeakVerdict = { ok: true } | { ok: false; reason: Extract<FallbackReason, "leak-command" | "leak-solution" | "leak-force"> };

/**
 * Reject a hint that hands the player the next action. `solution` is the level's documented
 * solution; `hintNumber` is which hint of the run this is (1 for the first).
 *
 * Every hint leaks when it contains a force flag (`--force`, `--force-with-lease`, `git push ... -f`).
 * Hints 1 and 2 also leak when they name any `git <subcommand>` (quotes and backticks dropped, any
 * case): they point at an idea or a place, and the player finds the command. Concept words such as
 * "the reflog" or "a branch" are fine.
 * Hint 3 and later may name a command, but leak when they contain a solution command line that has
 * arguments, or a `git <subcommand>` phrase matching a solution step that also names one of that
 * step's arguments (`git branch rescue main@{1}` against `git branch tidy-rescue main@{1}`).
 * The suggestion buttons do not make a command safe: a hint that says which button to press next
 * still does the player's thinking.
 */
export function checkLeak(hint: string, solution: readonly SolutionCommand[], hintNumber: number): LeakVerdict {
  const h = normalise(hint);
  // Warning against a force-push in words ("don't force anything") is fine; the flag itself is not.
  if (/--force\b/.test(h) || /\bgit push\b[^.;\n]*\s-f\b/.test(h)) {
    return { ok: false, reason: "leak-force" };
  }
  if (hintNumber < FIRST_COMMAND_HINT) {
    return GIT_COMMAND.test(h) ? { ok: false, reason: "leak-command" } : { ok: true };
  }

  for (const argv of solution) {
    // A bare command (`git push`, `git stash list`) is the command name, which hint 3 may say.
    if (argv.length <= 1 + commandKey(argv).length) continue;
    if (h.includes(normalise(argv.join(" ")))) return { ok: false, reason: "leak-solution" };
  }

  const phrases = gitPhrases(h);
  for (const argv of solution) {
    const key = commandKey(argv);
    const args = telltaleArgs(argv);
    if (key.length === 0 || args.length === 0) continue;
    for (const phrase of phrases) {
      const words = phrase.split(" ").slice(1);
      if (!key.every((k, i) => words[i] === k)) continue;
      const rest = ` ${words.slice(key.length).join(" ")} `;
      if (args.some((a) => rest.includes(` ${a} `) || rest.includes(` ${a}.`))) return { ok: false, reason: "leak-solution" };
    }
  }
  return { ok: true };
}

/** Tidy speaks plainly: strip quotes, a speaker label or markdown the model may have added. */
export function cleanHint(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^(tidy|hint)\s*:\s*/i, "");
  s = s.replace(/^["“]([\s\S]*)["”]$/, "$1");
  s = s.replace(/\*\*|__/g, "");
  return s.replace(/\s+/g, " ").trim();
}

/** Sentences in a hint. A full stop inside a command (`main@{1}.`) still ends the sentence, which is fine here. */
export function countSentences(s: string): number {
  return s
    .split(/[.!?]+(?:\s+|$)/)
    .map((p) => p.trim())
    .filter(Boolean).length;
}

export type HintVerdict =
  | { ok: true; text: string }
  | {
      ok: false;
      reason: Extract<FallbackReason, "empty" | "too-long" | "leak-command" | "leak-solution" | "leak-force" | "repeats-previous">;
    };

/** A sentence reduced to its words, for comparing hints: case, punctuation and spacing ignored. */
function words(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** The first sentence of a hint, reduced to its words. */
export function openingWords(hint: string): string {
  return words(cleanHint(hint).split(/[.!?]+(?:\s+|$)/)[0] ?? "");
}

/**
 * A new hint that opens with the same sentence as an earlier one re-says it instead of going a step
 * further (the most common weak hint in the evals), so it is replaced by the next scripted hint.
 */
export function repeatsPrevious(hint: string, previousHints: readonly string[]): boolean {
  const opening = openingWords(hint);
  return opening.length > 0 && previousHints.some((p) => openingWords(p) === opening);
}

/** Everything a model hint must pass before the player sees it. `hintNumber` sets how specific it may be. */
export function vetHint(
  raw: string,
  solution: readonly SolutionCommand[],
  hintNumber: number,
  previousHints: readonly string[] = [],
): HintVerdict {
  const text = cleanHint(raw);
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > MAX_HINT_CHARS || countSentences(text) > MAX_HINT_SENTENCES) return { ok: false, reason: "too-long" };
  const leak = checkLeak(text, solution, hintNumber);
  if (!leak.ok) return leak;
  if (repeatsPrevious(text, previousHints)) return { ok: false, reason: "repeats-previous" };
  return { ok: true, text };
}
