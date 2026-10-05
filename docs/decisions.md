# Decisions

Newest first. Each entry: date, what was decided, why.

## 2026-10-05 — Engine wave 1: refused commands change nothing

- **A refused command returns the unchanged state, even where real git leaves partial changes.** Teaching git's half-finished failure states is not a goal, and a clean rule keeps levels predictable. Known differences from git: a failed pull drops the fetched refs; a push with several refspecs applies none if one is rejected; `worktree add` on a used path creates no branch.
- **A merge or pull that stops on a conflict is `ok: true`** with a conflict event, because the state did change.
- **Other known differences:** no rename detection in merges; criss-cross merges with several common ancestors are simplified.

## 2026-10-05 — Spec approved, art route changed

- **Spec approved by the owner as written.**
- **Not the Rive robot.** It did not appeal. Art comes from an external AI art tool working from `docs/art-brief.md`, which fixes the game's technical needs and leaves the style open. Free toy-like characters with many poses (Kenney) are the reference for charm. Game code uses placeholder shapes until the art is chosen.

## 2026-10-05 — Project start

- **Standalone game, public from the first commit, MIT licence for code.** Art has its own licences, listed in `ASSETS.md`.
- **Game loop: the player leads a crew of robot coding agents who make real agent mistakes.** Act 1 teaches, Act 2 fixes, Act 3 leads with rule cards. Why: no existing git game teaches the problems people now hit while working with coding agents, and existing games mostly show only the commit graph.
- **Flat 2D with soft shadows, no 3D, no photo mode.** Why: an early 3D sketch read as a molecule model, not a game. The appeal has to come from the characters and the animation, and 3D made the history harder to read.
- **Real character art, low cost.** First choice: a free, CC BY licensed Rive robot as the base style, adapted into four crew members. Commissioning custom art is an option after the first playable level, if the base art falls short.
- **Own git simulator, checked against real git in tests.** Why: browser git libraries lack rebase, reflog and worktrees, and earlier attempts drifted because nothing defined correct behaviour.
- **Scripted robots in v1. Live AI robots and local models are out of v1.** Why: levels must play the same way every time, and running costs must stay near zero.
- **AI is used for hints only in v1,** with a low-cost model, a hard spending cap, evals and tracing.
