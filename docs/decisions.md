# Decisions

Newest first. Each entry: date, what was decided, why.

## 2026-10-05 — Pocket Machines character art

- The maintainer chose Pocket Machines from three directions. Tidy walks, Blaze rolls, Drift hovers and Hoarder shuffles. Each has eight standard states and one signature action.
- Delivery is transparent PNG sprite sheets, four 512 by 512 px frames per row, with a shared ground anchor and manifest. Artwork is licensed under CC0-1.0; see `ASSETS.md`.
- The asset import does not change the current game components. Use the supplied manifest and drawing helper when replacing the placeholders.

## 2026-10-05 — Robot gibberish voices

- **Robots speak in cartoon gibberish beeps, plus simple event sounds.** Maintainer's request after playing. Generated in the browser (no audio files, no cost), muted until the first interaction, with a mute button. Music and recorded speech stay out of v1.

## 2026-10-05 — Engine: refused commands change nothing

- **A refused command returns the unchanged state, even where real git leaves partial changes.** Teaching git's half-finished failure states is not a goal, and a clean rule keeps levels predictable. Known differences from git: a failed pull drops the fetched refs; a push with several refspecs applies none if one is rejected; `worktree add` on a used path creates no branch.
- **A merge or pull that stops on a conflict is `ok: true`** with a conflict event, because the state did change.
- **Other known differences:** no rename detection in merges; criss-cross merges with several common ancestors are simplified.
- **Wave 2 known differences (rebase, cherry-pick, revert, stash, diff, show):**
  - `stash apply`/`pop` refused because an untracked file from the stash is in the way changes nothing; git has already merged the tracked changes at that point.
  - `rebase --continue` with unstaged changes is refused, and a later pick that would overwrite local changes refuses the whole command instead of stopping part-way.
  - Concluding a stopped multi-commit cherry-pick or revert with a plain `git commit` ends the sequence; the remaining commits are not kept for `--continue` as git does.
  - `git diff` and `git show` follow git's format (blob ids, function context, "No newline" markers) but have no indent heuristic, so hunk edges can differ in rare ambiguous cases. Unmerged paths print as `* Unmerged path <file>` instead of a combined diff, merge commits show no diff, and there are no Date lines. The `--stat` graph scaling is approximate.
  - `git status` during a rebase lists the done and remaining picks in a simplified form.
  - Remote-tracking refs keep a reflog (for pull --rebase's fork point and `origin/main@{1}`). types.ts has no field for it yet, so it is stored in `branchReflogs` under the full ref name, e.g. `refs/remotes/origin/main`.

## 2026-10-05 — Spec approved, art route changed

- **Spec approved by the maintainer as written.**
- **Not the Rive robot.** It did not appeal. Art comes from an external AI art tool working from `docs/art-brief.md`, which fixes the game's technical needs and leaves the style open. Free toy-like characters with many poses (Kenney) are the reference for charm. Game code uses placeholder shapes until the art is chosen.

## 2026-10-05 — Project start

- **Standalone game, public from the first commit, MIT licence for code.** Art has its own licences, listed in `ASSETS.md`.
- **Game loop: the player leads a crew of robot coding agents who make real agent mistakes.** Act 1 teaches, Act 2 fixes, Act 3 leads with rule cards. Why: no existing git game teaches the problems people now hit while working with coding agents, and existing games mostly show only the commit graph.
- **Flat 2D with soft shadows, no 3D, no photo mode.** Why: an early 3D sketch read as a molecule model, not a game. The appeal has to come from the characters and the animation, and 3D made the history harder to read.
- **Real character art, low cost.** First choice: a free, CC BY licensed Rive robot as the base style, adapted into four crew members. Commissioning custom art is an option after the first playable level, if the base art falls short.
- **Own git simulator, checked against real git in tests.** Why: browser git libraries lack rebase, reflog and worktrees, and earlier attempts drifted because nothing defined correct behaviour.
- **Scripted robots in v1. Live AI robots and local models are out of v1.** Why: levels must play the same way every time, and running costs must stay near zero.
- **AI is used for hints only in v1,** with a low-cost model, a hard spending cap, evals and tracing.
