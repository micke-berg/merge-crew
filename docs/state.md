# Current state

Updated: 2026-10-05

## Where things stand

- Spec approved.
- Pocket Machines robot art (CC0, recorded in `ASSETS.md`) is in the game: animated sprites on the history map (idle, mood, hop onto a new commit, move along the line, mirrored when moving left), in dialogue portraits, on the start-screen crew cards (signature move on arrival and hover) and on the win panel. The player is a blue pawn, not a robot. `npm run sprites` (`scripts/build-sprites.mjs`) builds cropped WebP sheets in `public/assets/pocket-machines/web/` (about 2 MB for all, from 18.8 MB of source PNGs) and `src/components/robots/sheets.generated.ts`; a level preloads only the sheets it plays (about 0.7 MB for act2-01). Code: `src/components/robots/`. Credit link on the start screen footer.
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

- Robot art: verified in a browser at tablet and desktop widths on act2-01 and the map showcase. Not yet checked on a phone or in Safari (the map sprites use CSS transforms on SVG `<image>` with `transform-box: fill-box`). Tidy's signature (offering a tidy stack) would suit the hint button when it lands.
