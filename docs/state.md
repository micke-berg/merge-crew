# Current state

Updated: 2026-10-05

## Where things stand

- Spec approved. Art brief is with the owner (external AI art tool); robots are code-drawn stand-ins until then.
- Branch `feat/engine-foundation` holds wave 1, all green: typecheck, lint, 185 tests.
  - `src/engine/`: git simulator. add, rm, commit, status, log, reflog, branch, switch, checkout, restore, reset, merge with git-identical conflicts, push, fetch, pull, worktrees, full revision syntax. Known differences from git: `docs/decisions.md`.
  - `tests/oracle/`: 45 scenarios run through real git and the engine and compared. All match.
  - `src/levels/`: act1-01 to act1-03 and act2-01 (Blaze force-pushes). Each level's documented solution passes in the engine.
  - `src/components/map/` and `/play`: metro-style history map, animated from engine events, with a dev showcase page.

## Next

1. Owner merges the wave 1 pull request.
2. First playable level: a `/level/[id]` page that wires the engine, a level, the map, the command box, speech bubbles and goal checks together. Start with act2-01.
3. Engine wave 2: rebase, cherry-pick, revert, stash, diff, simple shell commands (cat, ls). Move the 27 extra edge-case scenarios from the engine lane into `tests/oracle`.
4. Map polish from the map lane's list: tighter long histories, measured label widths, faster force-push scene, speech-bubble anchors.

## Open questions

- Which art style direction, and whether the generated art's licence allows a public repo.
