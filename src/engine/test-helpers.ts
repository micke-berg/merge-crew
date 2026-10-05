// Shared helpers for the engine's own unit tests.

import { afterEach, beforeEach, vi, type MockInstance } from "vitest";
import { engine } from "./index";
import type { ActorId, CommandResult, RepoState } from "./types";

/** The text the engine shows when a command crashed instead of answering. Never acceptable in a test. */
export const INTERNAL_ERROR = /internal engine error/i;

/** Throw when a result reports a crash, whether or not the command was expected to succeed. */
export function assertNoInternalError(result: CommandResult, what: string): CommandResult {
  const crash = result.output.find((l) => INTERNAL_ERROR.test(l.text));
  if (crash) throw new Error(`${what}: ${crash.text}`);
  return result;
}

/**
 * Fail the current test when the engine logged a crash, which catches crashes in tests that call
 * engine.run directly. Call once at the top of a test file.
 */
export function failOnEngineErrors(): void {
  let spy: MockInstance<typeof console.error>;
  beforeEach(() => {
    spy = vi.spyOn(console, "error");
  });
  afterEach(() => {
    const crashes = spy.mock.calls.filter((args) => args[0] === "Merge Crew engine error");
    spy.mockRestore();
    if (crashes.length) throw new Error(`the engine crashed: ${String(crashes[0][1])}`);
  });
}

export class Repo {
  state: RepoState;
  last: CommandResult | null = null;

  constructor(state: RepoState = engine.createRepo()) {
    this.state = state;
  }

  /** Run a command line. Throws when it fails, unless `expectFail` is set. */
  git(line: string, actor: ActorId = "player", expectFail = false): CommandResult {
    const result = assertNoInternalError(
      engine.run(this.state, { actor, argv: ["git", ...engine.parseCommandLine(line)] }),
      `git ${line}`,
    );
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
    this.state = assertNoInternalError(engine.edit(this.state, { kind: "write", actor, path, content }), `write ${path}`).state;
  }

  remove(path: string, actor: ActorId = "player"): void {
    this.state = assertNoInternalError(engine.edit(this.state, { kind: "delete", actor, path }), `delete ${path}`).state;
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
