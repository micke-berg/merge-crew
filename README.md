# Merge Crew

A free browser game that teaches git. You lead a crew of small robot coding agents who all work in the same repository, and they make the mistakes real coding agents make: force-pushing over other people's work, letting a branch drift far from main, never committing. You fix it with real git commands.

**Play it at [merge-crew.vercel.app](https://merge-crew.vercel.app).** It runs in the browser, needs no account, and keeps your progress on your device.

## What you learn

- **Act 1 (learn):** commit, branch, switch and merge, taught by Tidy.
- **Act 2 (fix):** recover commits lost to a force-push with the reflog, bring a diverged branch home and resolve the conflict, find a forgotten stash, undo a pushed change with revert, and cherry-pick one fix.
- **Act 3 (lead), in progress:** all robots work at once, and you set the rules that prevent the mistakes.

Every command you type runs in a simulated git repository that behaves like real git. The history is drawn as a metro map, and each commit, merge and lost commit is animated.

## How it is built

- **Git engine:** a pure TypeScript git simulator. It covers commits, branches, merges with conflicts, rebase, cherry-pick, revert, stash, remotes and worktrees.
- **Tested against real git:** 122 scenarios run through the real `git` command line and through the engine, and the resulting repositories must match.
- **Levels are data:** each level is a starting repository, a scripted scene and goal checks. Every level's solution is played to the win in the tests.
- **History map:** SVG and [motion](https://motion.dev), driven by events from the engine.
- **Stack:** Next.js, React, TypeScript and Tailwind CSS. Sound is synthesized with the Web Audio API.

See [docs/architecture.md](docs/architecture.md) for how the parts fit together, and [docs/decisions.md](docs/decisions.md) for why.

## Run locally

Requires Node.js 24 (npm 11).

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

| Command | What it does |
|---|---|
| `npm test` | Unit tests and the real-git comparison tests (needs `git` installed) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run sprites` | Rebuilds the web sprite sheets from the source art |
| `npm run eval:hints` | Live hint evals: asks the real hint model through the AI Gateway for every stuck case and grades the answers. Needs `AI_GATEWAY_API_KEY` (or `VERCEL_OIDC_TOKEN`), skips cleanly without; results go to `evals/hints/results/` |

## Project documents

- [docs/spec.md](docs/spec.md): what version 1 contains, and what it leaves out.

## Licence

Code: MIT, see [LICENSE](LICENSE). Robot art: Pocket Machines, CC0. See [ASSETS.md](ASSETS.md).
