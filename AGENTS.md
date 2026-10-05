<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Merge Crew — instructions for AI coding agents and contributors

A free browser game that teaches git. The player leads a crew of robot coding agents who break things in a shared repository, and fixes them with real git commands.

## Read first, every session

1. `docs/spec.md` defines what v1 is. If a task is not covered by the spec, stop and ask. Do not build it.
2. `docs/architecture.md` explains how the parts fit together.
3. `docs/decisions.md` records why things are the way they are.

## Scope rules

- Work only on the task you were given. Report new ideas instead of building them; they do not go into code, a refactor, or a "while I was here" change.
- If the spec looks wrong, say so in your report. Do not quietly change direction.
- Status, plans and handover notes are not kept in this repository. Report them to whoever gave you the task.

## Public repository rules

This repository is public. Everything in it, including commit messages, PR text, issues and comments, is written for strangers.

- Project content only. No personal notes, private names, local machine paths, or references to tools or notes outside this repo.
- No secrets. Use environment variables, and keep `.env*` files out of git.
- Art and other assets go in only when their licence allows public redistribution. Record each asset and its licence in `ASSETS.md`.
- CI must pass: lint, typecheck, tests, build, a secret scan and the maintainer's private-word check. The maintainer also runs that check as local git hooks; never bypass hooks with `--no-verify`.

## Code

- The git engine (`src/engine/`) is pure TypeScript with no React or browser imports. Every behaviour change ships with a test that compares the engine against real git.
- Levels are data (`src/levels/`). Components render the state and play the events. They do not contain level rules.
- Run `npm run lint`, `npm run typecheck` and the tests before calling work done.

## Parallel work

When several agents work at once, each owns specific folders, named in its task. Do not edit files outside your folders. Shared types live in `src/engine/types.ts`; changing them is a contract change that the maintainer makes.

## Processes

- Scratch files go in a folder you create with a unique name, and you delete exactly that path. Never delete with wildcards in shared places such as the system temp folder.
- Stop only processes you started, by their process id (`kill <pid>`) or with the tool that started them. Never use `pkill -f`, `killall` or any name or pattern match. A name pattern matches far more than intended: "cat" also matches "Application".
