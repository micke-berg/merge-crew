# Current state

Updated: 2026-10-05

## Where things stand

- Repository scaffolded (Next.js, TypeScript, Tailwind v4).
- Privacy check (private word list), secret scan (gitleaks), lint, typecheck and build run in CI.
- `docs/spec.md` approved by the owner (2026-10-05).
- Art: the free Rive robot was rejected. `docs/art-brief.md` goes to an external art tool; its three style directions come back to the owner to choose from.

## In progress (branch `feat/engine-foundation`)

Four parallel lanes in the same checkout, each owning its folders. The lead commits and installs packages.

| Lane | Folders | Task |
|---|---|---|
| Engine | `src/engine/` (not `types.ts`) | Core git simulator: add, commit, branch, switch/checkout, restore, reset, merge with conflicts, push/fetch/pull, worktrees, reflog |
| Oracle | `tests/oracle/` | Runs scenarios through real git and the engine, compares snapshots |
| Map view | `src/components/map/`, `src/app/play/` | Metro-map history view with placeholder robots, animated from engine events |
| Levels | `src/levels/` | Act 1 levels 1-3 and the Act 2 showcase level (Blaze force-pushes) |

Shared contract: `src/engine/types.ts` (lead only). Second engine wave after this: rebase, cherry-pick, revert, stash, diff, simple shell commands.

## Next

1. Owner runs the art brief and picks a style direction. Until then, build with simple placeholder shapes so the art can be swapped in.
2. Shared types in `src/engine/types.ts` (repository state, command, event, level).
3. First playable slice: one Act 2 level (Blaze force-pushes, the player recovers the commits), fully animated.

## Open questions

- Which art style direction, and whether the generated art's licence allows a public repo.
