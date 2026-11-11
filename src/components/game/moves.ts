// Which commands count toward a level's par. Pure.

/** Git commands that only look at the repository. They are free: looking is how a player learns. */
const LOOKING = new Set(["status", "log", "diff", "show", "reflog", "blame", "help", "--help"]);
/** Words that are not git at all and never change anything. */
const SHELL_LOOKING = new Set(["ls", "cat", "help", "clear"]);

/**
 * Does a command count as a move? Everything that can change the repository does. Looking is free:
 * `git status`, `git log`, `git diff`, `git show`, `git reflog`, `git blame`, `git stash list` and
 * `git stash show`, a bare `git branch` that lists branches, and `ls`, `cat` and `help`.
 */
export function countsAsMove(argv: readonly string[]): boolean {
  const [program, sub, ...rest] = argv;
  if (program === undefined) return false;
  if (program !== "git") return !SHELL_LOOKING.has(program);
  if (sub === undefined || LOOKING.has(sub)) return false;
  if (sub === "stash") return rest[0] !== "list" && rest[0] !== "show";
  if (sub === "branch") return rest.some((a) => !a.startsWith("-") || /^-(d|D|m|M|c|C|f|u)$|^--(delete|move|copy|force|set-upstream-to|unset-upstream)/.test(a));
  if (sub === "worktree") return rest[0] !== "list";
  return true;
}

export type ParResult = "under" | "on" | "over";

export function againstPar(moves: number, par: number): ParResult {
  return moves < par ? "under" : moves === par ? "on" : "over";
}
