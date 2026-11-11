import { describe, expect, it } from "vitest";
import engine, { GIT_COMMANDS } from "./index";
import { GIT_HELP, editDistance, similar } from "./commands/help";

const run = (line: string) => engine.run(engine.createRepo(), { actor: "player", argv: engine.parseCommandLine(line) });
const text = (line: string) => run(line).output.map((o) => o.text);

describe("help", () => {
  it("describes every git command the engine runs, and no other", () => {
    expect(GIT_HELP.map(([c]) => c).sort()).toEqual([...GIT_COMMANDS].sort());
  });

  it.each(["help", "git help", "git --help"])("%s lists the commands and changes nothing", (line) => {
    const repo = engine.createRepo();
    const r = engine.run(repo, { actor: "player", argv: engine.parseCommandLine(line) });
    expect(r.ok).toBe(true);
    expect(r.state).toBe(repo);
    expect(r.events).toEqual([]);
    const all = r.output.map((o) => o.text).join("\n");
    for (const c of GIT_COMMANDS) expect(all).toContain(`git ${c}`);
    expect(all).toContain("cat <file>");
  });
});

describe("a mistyped command", () => {
  it("counts a swap of two neighbouring letters as one edit", () => {
    expect(editDistance("stauts", "status")).toBe(1);
    expect(editDistance("comit", "commit")).toBe(1);
    expect(editDistance("push", "pull")).toBe(2);
  });

  // The wording is git's own: checked against git 2.43 with `git stauts` and `git comit`.
  it("suggests the nearest command the way git does", () => {
    expect(text("git stauts")).toEqual(["git: 'stauts' is not a git command. See 'git --help'.", "", "The most similar command is", "\tstatus"]);
    expect(text("git comit")).toContain("\tcommit");
    expect(text("git chekout")).toContain("\tcheckout");
    expect(text("git cherrypick")).toContain("\tcherry-pick");
  });

  it("suggests the command a typed word is the start of", () => {
    expect(similar("stat", GIT_COMMANDS)).toEqual(["status"]);
    expect(similar("sta", GIT_COMMANDS)).toEqual(["status", "stash"]);
  });

  it("suggests nothing for a word that is not close to any command", () => {
    expect(text("git frobnicate")).toEqual(["git: 'frobnicate' is not a git command. See 'git --help'."]);
    expect(similar("x", GIT_COMMANDS)).toEqual([]);
    expect(similar("constructor", GIT_COMMANDS)).toEqual([]);
  });

  it("refuses the command and leaves the repository alone", () => {
    const repo = engine.createRepo();
    const r = engine.run(repo, { actor: "player", argv: ["git", "stauts"] });
    expect(r.ok).toBe(false);
    expect(r.state).toBe(repo);
  });

  it("reminds a player who left out git", () => {
    expect(text("status")).toEqual(["status: shell commands are not supported in Merge Crew yet", "Did you mean: git status"]);
    expect(text("commit -m x")[1]).toBe("Did you mean: git commit ...");
    expect(text("vim list.txt")[1]).toBe("Type help to see what works here.");
  });
});
