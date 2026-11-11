// Tab completion for the command box. Pure: the caller passes in the words that exist right now.

export type CompletionWords = {
  /** Git subcommands the engine runs. */
  git: readonly string[];
  /** Other first words: ls, cat, help, clear. */
  shell: readonly string[];
  /** Branch names and remote branches (`main`, `origin/main`). */
  refs: readonly string[];
  /** The player's file paths. */
  files: readonly string[];
};

export type Completion = {
  /** The line after completing: unchanged when nothing matched. */
  line: string;
  /** The choices, when more than one word fits. Empty otherwise. */
  options: string[];
};

/** Commands whose arguments are files first; every other command gets branches first. */
const FILE_COMMANDS = new Set(["add", "rm", "restore", "blame", "diff", "cat", "ls"]);

function commonPrefix(words: readonly string[]): string {
  let prefix = words[0] ?? "";
  for (const w of words) {
    while (!w.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

/**
 * Complete the last word of a typed line, the way a shell does on Tab. One match fills the word in
 * and adds a space. Several matches fill in what they share and are returned as `options`.
 * The first word completes to a command, the word after `git` to a subcommand, and later words to
 * branch and file names. Flags and quoted text are left alone.
 */
export function complete(line: string, words: CompletionWords): Completion {
  const none = { line, options: [] };
  if ((line.match(/["']/g) ?? []).length % 2 === 1) return none;
  const cut = line.search(/\S*$/);
  const head = line.slice(0, cut);
  const word = line.slice(cut);
  const before = head.trim().split(/\s+/).filter(Boolean);
  if (word.startsWith("-")) return none;

  let candidates: readonly string[];
  if (before.length === 0) candidates = ["git", ...words.shell];
  else if (before[0] === "git" && before.length === 1) candidates = words.git;
  else {
    const command = before[0] === "git" ? before[1] : before[0];
    const filesOnly = before[0] !== "git";
    candidates = filesOnly
      ? words.files
      : FILE_COMMANDS.has(command) ? [...words.files, ...words.refs] : [...words.refs, ...words.files];
  }
  const matches = [...new Set(candidates)].filter((c) => c.startsWith(word));
  if (matches.length === 0) return none;
  if (matches.length === 1) return { line: `${head}${matches[0]} `, options: [] };
  return { line: head + commonPrefix(matches), options: matches };
}
