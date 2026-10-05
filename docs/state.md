# Current state

Updated: 2026-10-05

## Where things stand

- Live at https://merge-crew.vercel.app (auto-deploys from `main`).
- Playable: Act 1 levels 1-3, Act 2 levels 1-5. Pocket Machines robot art in the game.
- Branch `feat/act2-levels`: Act 2 levels 2-5, conflict editor, robot gibberish voices and event sounds (`src/components/sound/`, mute button in the level header; robot lines type at 45 characters a second). Sound parameters are untested by ear.
- Hints: parked by the owner (2026-10-05).

## Next

1. Merge `feat/act2-levels`.
2. Owner listens to the voices and effects; tune in `src/components/sound/voices.ts` and `effects.ts`.
3. First-run experience: the owner needed several plays to understand the game. Keep goals visible at every window width (they fall below the fold at ~800 px), and a guided first level where Tidy points at the map, the terminal, the goals and the files panel.
4. Act 3: all robots at once and rule cards.
5. `git log --graph` in the engine; `revert -m` for merge commits.

## Open questions

- Robot art: verified in a browser at tablet and desktop widths on act2-01 and the map showcase. Not yet checked on a phone or in Safari (the map sprites use CSS transforms on SVG `<image>` with `transform-box: fill-box`). Tidy's signature (offering a tidy stack) would suit the hint button when it lands.
