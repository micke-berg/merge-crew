// `help`, `git help` and the "did you mean" line for a mistyped command. Pure text, no state.

/** One plain line per git command the engine runs, in the order a beginner meets them. */
export const GIT_HELP: ReadonlyArray<readonly [command: string, what: string]> = [
  ["status", "what has changed, and what is staged"],
  ["add", "stage a file for the next commit"],
  ["commit", "save the staged files as a commit"],
  ["log", "the history of commits"],
  ["diff", "what changed, line by line"],
  ["show", "one commit and its changes"],
  ["blame", "which commit last changed each line of a file"],
  ["restore", "put a file back as it was"],
  ["rm", "delete a file and stage that"],
  ["branch", "list, create or delete branches"],
  ["switch", "move to another branch"],
  ["checkout", "move to a branch or a commit (the older way)"],
  ["merge", "bring another branch into this one"],
  ["rebase", "replay this branch's commits on top of another"],
  ["cherry-pick", "copy one commit onto this branch"],
  ["revert", "make a new commit that undoes an old one"],
  ["reset", "move this branch to another commit"],
  ["reflog", "where HEAD and branches have been"],
  ["stash", "put unsaved changes aside, and bring them back"],
  ["fetch", "download what is new on the remote"],
  ["pull", "fetch, then merge it into this branch"],
  ["push", "upload this branch to the remote"],
  ["worktree", "a second folder on its own branch"],
];

export const SHELL_HELP: ReadonlyArray<readonly [command: string, what: string]> = [
  ["ls", "list the files here"],
  ["cat <file>", "print a file"],
  ["clear", "empty this box"],
  ["help", "this list"],
];

export function helpLines(): string[] {
  const width = Math.max(...GIT_HELP.map(([c]) => c.length + 4), ...SHELL_HELP.map(([c]) => c.length));
  const row = (name: string, what: string) => `  ${name.padEnd(width)}  ${what}`;
  return [
    "Merge Crew runs these git commands:",
    ...GIT_HELP.map(([c, what]) => row(`git ${c}`, what)),
    "",
    "And these, for looking around:",
    ...SHELL_HELP.map(([c, what]) => row(c, what)),
    "",
    "Tab completes a command, a branch or a file name. The up arrow brings back earlier commands.",
  ];
}

/**
 * Edit distance where swapping two neighbouring letters counts as one step, so "stauts" is one
 * step from "status". This is not git's own scoring, only close to it for short command names.
 */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * The known names closest to a mistyped one: within two edits, and fewer edits than half the word,
 * so a short or unrelated word suggests nothing. Also a name the typed text is the start of
 * ("stat" for "status"). Closest first; ties in the order of `known`.
 */
export function similar(typed: string, known: readonly string[]): string[] {
  const word = typed.toLowerCase();
  if (word.length < 2) return [];
  const scored = known
    .map((name) => ({ name, score: name.startsWith(word) ? 0.5 : editDistance(word, name) }))
    .filter(({ score }) => score <= 2 && score < word.length / 2);
  const best = Math.min(...scored.map((s) => s.score));
  return scored.filter((s) => s.score === best).map((s) => s.name);
}

/** The lines git prints after "is not a git command" when it has a guess. */
export function similarLines(names: readonly string[]): string[] {
  if (names.length === 0) return [];
  return ["", names.length === 1 ? "The most similar command is" : "The most similar commands are", ...names.map((n) => `\t${n}`)];
}
