// Runs the real git CLI with every setting that affects results pinned.

import { spawn } from "node:child_process";

/** Config applied to every git call through GIT_CONFIG_COUNT, on top of no global or system config. */
const PINNED_CONFIG: Record<string, string> = {
  "init.defaultBranch": "main",
  "merge.conflictStyle": "merge",
  "pull.rebase": "false",
  "core.autocrlf": "false",
  "core.fileMode": "true",
  "core.hooksPath": "/dev/null",
  "core.fsmonitor": "false",
  "gc.auto": "0",
  "commit.gpgSign": "false",
  "advice.detachedHead": "false",
  "color.ui": "false",
  "user.useConfigOnly": "false",
};

const BASE_TIME = 1_700_000_000;

export type GitRun = { code: number; stdout: string; stderr: string };

export function gitEnv(actor: string, tick: number): NodeJS.ProcessEnv {
  const date = `@${BASE_TIME + tick * 60} +0000`;
  const env: Record<string, string | undefined> = {
    PATH: process.env.PATH,
    HOME: "/nonexistent",
    LANG: "C",
    LC_ALL: "C",
    TZ: "UTC",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_EDITOR: "true",
    GIT_PAGER: "cat",
    GIT_AUTHOR_NAME: actor,
    GIT_AUTHOR_EMAIL: `${actor}@merge-crew.test`,
    GIT_COMMITTER_NAME: actor,
    GIT_COMMITTER_EMAIL: `${actor}@merge-crew.test`,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  };
  const entries = Object.entries(PINNED_CONFIG);
  env.GIT_CONFIG_COUNT = String(entries.length);
  entries.forEach(([key, value], i) => {
    env[`GIT_CONFIG_KEY_${i}`] = key;
    env[`GIT_CONFIG_VALUE_${i}`] = value;
  });
  return env as NodeJS.ProcessEnv;
}

type RawRun = { code: number; stdout: Buffer; stderr: string };

/** Spawn git asynchronously, so several scenarios can run at the same time. */
function spawnGit(cwd: string, args: string[], env: NodeJS.ProcessEnv, input?: string): Promise<RawRun> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, env });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (b: Buffer) => out.push(b));
    child.stderr.on("data", (b: Buffer) => err.push(b));
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({ code: code ?? 1, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString("utf8") }),
    );
    // git may exit before reading stdin (most commands ignore it); that EPIPE is harmless.
    child.stdin.on("error", () => {});
    child.stdin.end(input ?? "");
  });
}

export async function runGit(
  cwd: string,
  args: string[],
  opts: { actor?: string; tick?: number; input?: string } = {},
): Promise<GitRun> {
  const r = await spawnGit(cwd, args, gitEnv(opts.actor ?? "player", opts.tick ?? 0), opts.input);
  return { code: r.code, stdout: r.stdout.toString("utf8"), stderr: r.stderr };
}

/** Run git and throw on a nonzero exit. For plumbing calls inside the harness. */
export async function gitOut(cwd: string, args: string[], input?: string): Promise<string> {
  const r = await runGit(cwd, args, { input });
  if (r.code !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr.trim()}`);
  return r.stdout;
}

export type GitObject = { type: string; data: Buffer };

/** Every object in a repository, read with one cat-file call. The repositories here are tiny. */
export async function readObjectStore(cwd: string): Promise<Map<string, GitObject>> {
  const r = await spawnGit(cwd, ["cat-file", "--batch-all-objects", "--batch", "--unordered"], gitEnv("player", 0));
  if (r.code !== 0) throw new Error(`git cat-file --batch-all-objects failed in ${cwd}: ${r.stderr}`);
  const buf = r.stdout;
  const out = new Map<string, GitObject>();
  let pos = 0;
  while (pos < buf.length) {
    const nl = buf.indexOf(0x0a, pos);
    const [oid, type, sizeText] = buf.subarray(pos, nl).toString("utf8").split(" ");
    const size = Number(sizeText);
    out.set(oid, { type, data: buf.subarray(nl + 1, nl + 1 + size) });
    pos = nl + 1 + size + 1;
  }
  return out;
}
