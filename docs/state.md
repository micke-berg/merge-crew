# Current state

Updated: 2026-10-05

## Where things stand

- Live at https://merge-crew.vercel.app (auto-deploys from `main`).
- Playable: Act 1 levels 1-3, Act 2 levels 1-5. Pocket Machines robot art in the game.
- Branch `feat/act2-levels`: Act 2 levels 2-5, conflict editor, robot gibberish voices and event sounds (`src/components/sound/`, mute button in the level header; robot lines type at 45 characters a second). Sound parameters are untested by ear.
- Hints: parked by the maintainer (2026-10-05).

## Story and first run (2026-10-05, branch `feat/story-onboarding`)

- The crew runs the website of Café Cog, a small robot café; the player is their new lead. A six-line opening (café front, the crew, "when the crew breaks something, you fix it with real git commands") shows once on the first visit, is skippable, and replays from the start screen ("Watch the opening again"). The start screen has a one-sentence premise.
- Every level has a mission card on the brief: what's going on, your job, what you'll practise.
- A "Your job" bar above the terminal shows the current unmet goal at every width (checked at 1280, 800 and 768 px).
- All eight intros rewritten: at most five lines, start from what is on screen, introduce each file they mention. Lines that mention a file highlight it in the files panel and show it as a clickable chip in the dialogue (the chip matters at tablet width, where the files panel is below the terminal).
- At tablet width the map is a little shorter (40dvh) and the terminal fills its column, so the job bar, terminal and dialogue fit an 800 px tall window.
- Played as a first-time player: start page, opening, act1-01 and act2-01 to the win at 1280 and 800 px.

## Review cleanup (2026-10-05)

Two independent code reviews (Claude and Codex) were run on the whole codebase. Fixed on `chore/review-cleanup`: special names like `constructor` breaking the engine; level tests that skipped instead of failing; level solutions now also checked in real git; solutions kept out of the browser bundle; colour tokens and contrast; the map and conflict editor split into smaller parts; the map uses the engine's reachability; source art and verification files moved out of the served folder; `/play` dev page moved to `/dev/map` (development only); security headers; contributor-facing docs. Still open: hint context ships to the browser (move server-side when hints are built).

## Next

1. Merge `feat/act2-levels`.
2. Maintainer listens to the voices and effects; tune in `src/components/sound/voices.ts` and `effects.ts`.
3. First-run experience: premise, mission cards and the job bar are done (see above). Still open: a guided first level where Tidy points at the map, the terminal and the files panel; the maintainer should replay act1-01 cold to judge whether the map needs its own introduction.
4. Act 3: all robots at once and rule cards.
5. `git log --graph` in the engine; `revert -m` for merge commits.

## Open questions

- Robot art: verified in a browser at tablet and desktop widths on act2-01 and the map showcase. Not yet checked on a phone or in Safari (the map sprites use CSS transforms on SVG `<image>` with `transform-box: fill-box`). Tidy's signature (offering a tidy stack) would suit the hint button when it lands.
