# Current state

Updated: 2026-10-05

## Where things stand

- Spec approved.
- Pocket Machines selected by the owner. The full set is in `public/assets/pocket-machines/` under CC0-1.0, recorded in `ASSETS.md`. It contains 36 four-frame sheets, four portraits, a manifest, a drawing helper and an interactive preview. The live game still uses code-drawn placeholders; integration is the next art task.
- `main` has wave 1 (PR #1): engine, real-git comparison tests (45 scenarios), history map, four levels.
- Branch `feat/playable-level`: all four levels playable at `/level/[id]` with a start screen. Scenes with dialogue, a terminal with history and suggestions, files panel, goals panel, brief and win panels, progress saved in the browser. act2-01 was played start to win in a browser by the lead.
- In progress on the same branch: engine wave 2 (rebase, cherry-pick, revert, stash, diff, cat, ls) in `src/engine/` and `tests/oracle/`.

## Next

1. Finish engine wave 2, open the PR for this branch, merge when green (the owner gave a standing OK for green PRs).
2. Deploy to Vercel so the game is playable online.
3. More levels: the rest of Act 2 (Drift diverges, Hoarder never commits) and Act 3 with rule cards. A conflict editor is needed for levels that end in a merge conflict.
4. Hints: Tidy hint button backed by a low-cost model, with a spending cap, evals and tracing.
5. Polish requests: `by` field on scripted git steps that a robot runs in another worktree; speech bubbles anchored to robots (needs robot positions from the map); map polish list from wave 1.

## Open questions

- Connect Pocket Machines to map markers and dialogue portraits, then verify the actual game at map and portrait sizes. The asset README explains anchors, scaling, frame timing and one-shot transitions.
