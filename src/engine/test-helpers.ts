// Shared helpers for the engine's own unit tests.

import { engine } from "./index";
import type { ActorId, CommandResult, RepoState } from "./types";

export class Repo {
  state: RepoState;
  last: CommandResult | null = null;

  constructor(state: RepoState = engine.createRepo()) {
    this.state = state;
  }

  /** Run a command line. Throws when it fails, unless `expectFail` is set. */
  git(line: string, actor: ActorId = "player", expectFail = false): CommandResult {
    const result = engine.run(this.state, { actor, argv: ["git", ...engine.parseCommandLine(line)] });
    this.last = result;
    if (result.ok === expectFail) {
      const text = result.output.map((l) => l.text).join("\n");
      throw new Error(`git ${line} ${result.ok ? "succeeded" : "failed"} unexpectedly:\n${text}`);
    }
    this.state = result.state;
    return result;
  }

  fails(line: string, actor: ActorId = "player"): CommandResult {
    return this.git(line, actor, true);
  }

  write(path: string, content: string, actor: ActorId = "player"): void {
    this.state = engine.edit(this.state, { kind: "write", actor, path, content }).state;
  }

  remove(path: string, actor: ActorId = "player"): void {
    this.state = engine.edit(this.state, { kind: "delete", actor, path }).state;
  }

  commitFile(path: string, content: string, message: string, actor: ActorId = "player"): string {
    this.write(path, content, actor);
    this.git(`add ${path}`, actor);
    this.git(`commit -m "${message}"`, actor);
    return this.head(actor);
  }

  head(actor: ActorId = "player"): string {
    const wt = this.state.worktrees[actor];
    const oid = wt.head.kind === "detached" ? wt.head.oid : this.state.branches[wt.head.name];
    if (!oid) throw new Error("unborn HEAD");
    return oid;
  }

  msg(oid: string | undefined): string | undefined {
    return oid ? this.state.commits[oid]?.message : undefined;
  }

  wt(actor: ActorId = "player") {
    return this.state.worktrees[actor];
  }

  text(): string {
    return (this.last?.output ?? []).map((l) => l.text).join("\n");
  }
}
