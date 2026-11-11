import { describe, expect, it } from "vitest";
import { GIT_COMMANDS, SHELL_COMMANDS } from "@/engine";
import { complete, type CompletionWords } from "./completion";

const words: CompletionWords = {
  git: GIT_COMMANDS,
  shell: [...SHELL_COMMANDS, "clear"],
  refs: ["main", "tidy", "tidy-rescue", "origin/main"],
  files: ["prices.txt", "sign.txt", "menu/tea.txt"],
};

describe("complete", () => {
  it("completes the first word to a command", () => {
    expect(complete("gi", words)).toEqual({ line: "git ", options: [] });
    expect(complete("he", words).line).toBe("help ");
  });

  it("completes the word after git to a subcommand", () => {
    expect([...complete("git sta", words).options].sort()).toEqual(["stash", "status"]);
    expect(complete("git stat", words)).toEqual({ line: "git status ", options: [] });
    expect(complete("git cher", words).line).toBe("git cherry-pick ");
  });

  it("fills in what several matches share and lists them", () => {
    const re = complete("git re", words);
    expect(re.line).toBe("git re");
    expect([...re.options].sort()).toEqual(["rebase", "reflog", "reset", "restore", "revert"]);
    expect(complete("git merge ti", words)).toEqual({ line: "git merge tidy", options: ["tidy", "tidy-rescue"] });
  });

  it("completes branch names, remote branches and file names", () => {
    expect(complete("git merge tidy-", words).line).toBe("git merge tidy-rescue ");
    expect(complete("git log or", words).line).toBe("git log origin/main ");
    expect(complete("git add pr", words).line).toBe("git add prices.txt ");
    expect(complete("cat me", words).line).toBe("cat menu/tea.txt ");
  });

  it("offers files first for file commands and branches first for the rest", () => {
    expect(complete("git add ", words).options.slice(0, 3)).toEqual(words.files);
    expect(complete("git switch ", words).options.slice(0, 4)).toEqual(words.refs);
    expect(complete("cat ", words).options).toEqual(words.files);
  });

  it("keeps the words already typed", () => {
    expect(complete("git branch rescue ma", words).line).toBe("git branch rescue main ");
  });

  it("leaves flags, quoted text and unknown words alone", () => {
    expect(complete("git log --on", words)).toEqual({ line: "git log --on", options: [] });
    expect(complete('git commit -m "Add pr', words).line).toBe('git commit -m "Add pr');
    expect(complete("git merge zzz", words)).toEqual({ line: "git merge zzz", options: [] });
  });
});
