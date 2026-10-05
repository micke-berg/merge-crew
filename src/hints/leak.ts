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

export type LeakVerdict = { ok: true } | { ok: false; reason: Extract<FallbackReason, "leak-solution" | "leak-force"> };

/**
 * Reject a hint that contains the answer. `solution` is the level's documented solution; commands in
 * `publicCommands` (the level's suggestion buttons, which fill in the exact command for the player)
 * are already on screen, so naming them gives nothing away.
 *
 * A hint leaks when it
 * - contains a force flag (`--force`, `--force-with-lease`, `git push ... -f`), or
 * - contains a solution command line that is not already a suggestion button, or
 * - has a `git <subcommand>` phrase matching a solution step's subcommand that also names one of
 *   that step's arguments (`git branch rescue main@{1}` against `git branch tidy-rescue main@{1}`).
 */
export function checkLeak(hint: string, solution: readonly SolutionCommand[], publicCommands: readonly string[]): LeakVerdict {
  const h = normalise(hint);
  // Warning against a force-push in words ("don't force anything") is fine; the flag itself is not.
  if (/--force\b/.test(h) || /\bgit push\b[^.;\n]*\s-f\b/.test(h)) {
    return { ok: false, reason: "leak-force" };
  }
  const shown = new Set(publicCommands.map(normalise));
  const secret = solution.filter((argv) => !shown.has(normalise(argv.join(" "))));

  for (const argv of secret) {
    if (h.includes(normalise(argv.join(" ")))) return { ok: false, reason: "leak-solution" };
  }

  const phrases = gitPhrases(h);
  for (const argv of secret) {
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

export type HintVerdict = { ok: true; text: string } | { ok: false; reason: Extract<FallbackReason, "empty" | "too-long" | "leak-solution" | "leak-force"> };

/** Everything a model hint must pass before the player sees it. */
export function vetHint(raw: string, solution: readonly SolutionCommand[], publicCommands: readonly string[]): HintVerdict {
  const text = cleanHint(raw);
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > MAX_HINT_CHARS || countSentences(text) > MAX_HINT_SENTENCES) return { ok: false, reason: "too-long" };
  const leak = checkLeak(text, solution, publicCommands);
  if (!leak.ok) return leak;
  return { ok: true, text };
}
