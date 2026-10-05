# Merge Crew — v1 spec

Status: approved by the maintainer on 2026-10-05. Anything not written here is not in v1. New ideas go to `docs/ideas.md`, never into code.

## The game in one paragraph

You are the lead developer of a small crew of robot coding agents. They all work in the same git repository, each on its own branch, and they make the mistakes real coding agents make. You fix those mistakes with real git commands, and in the last act you also set rules that stop the mistakes before they happen. It runs free in the browser, with no install and no account.

## The screen

- **The history map.** The git history is drawn like a metro map: `main` is one line, each branch is a coloured line, every commit is a stop. The layout is flat 2D, with soft shadows and layering for depth only. No 3D.
- **The crew.** Small animated robot characters move along their own branch and hop onto each new commit they make. They react with emotions: idle, happy, celebrate, scared, guilty, surprised.
- **The command box** at the bottom. The player types real git commands. For beginners there are suggestion buttons. A button fills in the exact command, and the player presses Enter to run it.
- **Speech bubbles** from the robots carry story lines, problem reports and hints.
- **The files panel.** It shows working files, the staging area and their status, because the gap in existing git games is everything except the commit graph.

## The crew (v1)

| Robot | Personality | The mistake it makes |
|---|---|---|
| Tidy | Calm, helpful | None. Teaches in Act 1 and gives hints after that |
| Blaze | Fast, overconfident | Rewrites history, force-pushes over others' work |
| Drift | Dreamy, wanders off | Never pulls or rebases, so its branch diverges far from `main` |
| Hoarder | Anxious, keeps everything | Never commits. Huge uncommitted changes, forgotten stashes |

## Structure: 3 acts, about 12 levels

- **Act 1, learn (about 4 levels).** Tidy teaches commit, branch, switch and merge. The player does every command.
- **Act 2, fix (about 5 levels).** Each level opens with a short scripted scene where one robot breaks something. The player fixes it. Example: Blaze force-pushes, two commits on `main` disappear, and the player recovers them with the reflog. One robot, one mistake, one fix per level.
- **Act 3, lead (about 3 levels).** All robots work at once, following a script, and problems pop up as robot messages. The player chooses what to fix first. Before each shift the player picks rule cards ("no force-push to main", "commit before switching branch"), and a good rule blocks the mistake on screen.

A level is won when its goal check passes. Examples: "these commits are reachable from main", "the working tree is clean and nothing was lost".

## Sound

The robots speak in cartoon gibberish: short synthesized beeps and blips while their text types out, a different voice per robot. Simple effects mark game events (a commit appears, a robot hops, a force-push, a win). Sounds are generated in the browser with no audio files, start only after the player's first interaction, default to a low volume, and have a mute button that is remembered.

## Hints

The player can ask Tidy for a hint. Hints come from a low-cost AI model with a hard monthly spending cap. A hint points the player toward the fix and must never contain the full answer command. The hint quality is measured with evals, and every hint call is traced.

## Technical decisions

- **App:** Next.js (App Router) and TypeScript on Vercel, Tailwind v4.
- **Git engine:** our own TypeScript simulator in `src/engine/`. It is pure functions with no React: commits, branches, HEAD, index, working tree, stash, reflog, remotes. Every command returns the new state plus a list of events, and the events drive the animations.
- **Correctness:** tests run the same command sequence through real git (in a temporary folder) and through the engine, then compare refs, history, index and status. Real git decides what is correct.
- **Levels:** data files in `src/levels/` with the starting repository, the scripted robot actions, the goal check and the hint context. No level logic lives in components.
- **Characters:** Rive animations, or sprites if the chosen art requires them. Art goes in the repo only when its licence allows public redistribution (CC0 or CC BY with credit in `ASSETS.md`).
- **AI:** Vercel AI SDK and AI Gateway, a low-cost model for hints, and telemetry to Langfuse.
- **Saving progress:** browser storage only. No accounts.

## Not in v1

3D, photo mode, accounts, a backend database, multiplayer, live AI-driven robots, local models in the browser, payments, a level editor, music or recorded speech, mobile layout beyond "playable on a tablet".

## Finished means

- About 12 levels across the 3 acts, playable start to end at a public URL.
- At least 4 animated robot characters.
- Hints with evals and tracing in place.
- The engine comparison tests are green in CI.
- The privacy and secret checks are green.
- A README with screenshots, plus a short write-up of what was learned.
