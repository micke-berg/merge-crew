<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Merge Crew — agent instructions

A free browser game that teaches git. The player leads a crew of robot coding agents who break things in a shared repository, and fixes them with real git commands.

## Read first, every session

1. `docs/spec.md` defines what v1 is. If a task is not covered by the spec, stop and ask. Do not build it.
2. `docs/state.md` describes where the work stands right now and what is next.
3. `docs/decisions.md` records why things are the way they are.

## Scope rules

- Work only on the task you were given. A new idea goes as one line in `docs/ideas.md`. It does not go into code, a refactor, or a "while I was here" change.
- If the spec looks wrong, say so in your report. Do not quietly change direction.
- Each task ends with an updated `docs/state.md`.

## Public repository rules

This repository is public. Everything in it, including commit messages, PR text, issues and comments, is written for strangers.

- Project content only. No personal notes, private names, local machine paths, or references to tools or notes outside this repo.
- No secrets. Use environment variables, and keep `.env*` files out of git.
- Art and other assets go in only when their licence allows public redistribution. Record each asset and its licence in `ASSETS.md`.
- The pre-commit, commit-msg and pre-push checks must pass. Never bypass them with `--no-verify`.

## Code

- The git engine (`src/engine/`) is pure TypeScript with no React or browser imports. Every behaviour change ships with a test that compares the engine against real git.
- Levels are data (`src/levels/`). Components render the state and play the events. They do not contain level rules.
- Run `npm run lint`, `npm run typecheck` and the tests before calling work done.

## Parallel work

Each parallel agent owns specific folders, named in its task. Do not edit files outside your folders. Shared types live in `src/engine/types.ts`, and only the lead changes them.

## Processes

- Stop only processes you started, by their process id (`kill <pid>`) or with the tool that started them. Never use `pkill -f`, `killall` or any name or pattern match. A pattern like "cat" also matches "Application", which closed most of the owner's apps on 2026-10-05.

## Workflow notes

When you notice something about the way of working that helped or hurt (a handoff that failed, an instruction that was misread, a check that caught a mistake), add a dated line to `docs/workflow-notes.md`.
