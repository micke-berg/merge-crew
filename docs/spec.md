# Merge Crew — v1 spec

Status: approved by the maintainer on 2026-10-05. Amended on 2026-11-11: Act 3 in detail, the daily incident, the win recap, terminal help, the sandbox and sharing (see "Build order"). Anything not written here is not in v1. New ideas are not built until the spec changes.

## The game in one paragraph

You are the lead developer of a small crew of robot coding agents. They all work in the same git repository, each on its own branch, and they make the mistakes real coding agents make. You fix those mistakes with real git commands, and in the last act you do what a person leading coding agents does: read their work before it goes in, decide what to fix first, and set rules that stop the mistakes before they happen. It runs free in the browser, with no install and no account.

Acts 1 and 2 teach git. Act 3 is what makes this a game about leading agents and not only a git tutorial, so it is the priority for what is left.

## The screen

- **The history map.** The git history is drawn like a metro map: `main` is one line, each branch is a coloured line, every commit is a stop. The layout is flat 2D, with soft shadows and layering for depth only. No 3D.
- **The crew.** Small animated robot characters move along their own branch and hop onto each new commit they make. They react with emotions: idle, happy, celebrate, scared, guilty, surprised.
- **The command box** at the bottom. The player types real git commands. For beginners there are suggestion buttons. A button fills in the exact command, and the player presses Enter to run it. The box helps a beginner the way a good terminal does: `help` lists what works here, a mistyped command suggests the nearest real one, Tab completes commands, branch names and file names, and `git log --graph` draws the same history as the map.
- **Speech bubbles** from the robots carry story lines, problem reports and hints.
- **The files panel.** It shows working files, the staging area and their status, because the gap in existing git games is everything except the commit graph.

## The crew (v1)

| Robot | Personality | The mistake it makes |
|---|---|---|
| Tidy | Calm, helpful | None. Teaches in Act 1 and gives hints after that |
| Blaze | Fast, overconfident | Rewrites history, force-pushes over others' work |
| Drift | Dreamy, wanders off | Never pulls or rebases, so its branch diverges far from `main` |
| Hoarder | Anxious, keeps everything | Never commits. Huge uncommitted changes, forgotten stashes |

## Structure: 3 acts, about 22 levels

- **Act 1, learn.** Tidy teaches commit, branch, switch, merge, push and pull. After those come short practice levels, one tool each, with no crisis and no push or pull: stash, reset, cherry-pick, revert, reflog and resolving a conflict. Each practice level names the Act 2 level that uses the tool. The player does every command.
- **Act 2, fix (about 5 levels).** Each level opens with a short scripted scene where one robot breaks something. The player fixes it. Example: Blaze force-pushes, two commits on `main` disappear, and the player recovers them with the reflog. One robot, one mistake, one fix per level.
- **Act 3, lead (3 levels).** All robots work at once, following a script. See "Act 3 in detail".

A level is won when its goal check passes. Examples: "these commits are reachable from main", "the working tree is clean and nothing was lost". A goal that is already true when the player's turn starts is a rule to keep, shown apart from the steps.

## Act 3 in detail

Three things are new in Act 3. Each is something a person leading coding agents does and a person learning git alone does not.

- **Review before merge.** A robot says its branch is ready. The player reads it (`git log`, `git diff main..branch`, `git show`) and then merges it or sends it back. Some branches are fine. Some hide a mistake: a deleted file, a secret in a commit, a change to a file the robot was not asked to touch. Merging a bad branch does not lose the level at once; it becomes one more thing to fix.
- **A shift, in turns.** The robots follow a script that moves forward one beat after each command the player runs, never on a clock. A level therefore plays the same way every time, can be tested like any other level, and never rushes a beginner. Problems arrive as robot messages in a short inbox, and the player chooses what to deal with first. Leaving a problem costs something concrete later in the script (a second robot builds on the broken commit).
- **Rule cards.** Before a shift the player picks a few cards from a small hand, for example "no force-push to main", "commit before switching branch", "pull before you push", "one worktree per robot". When a robot's scripted step breaks a chosen rule, the step is refused on screen and the robot reacts. A mistake with no rule against it happens, and the player fixes it with git. Each card names the real tool that does this job (a protected branch, a pre-push hook, a line in the agents' instruction file), on the card and again on the win card.

The three levels:

1. **Read before you merge.** Three robots each offer a branch. No rule cards yet. The player merges the good ones and sends one back.
2. **House rules.** The first shift with cards: pick two of four. The script contains four mistakes, so two are blocked and two are left to fix. Which two is the player's choice, and the level is winnable with any pair.
3. **The full shift.** All four robots, the inbox, three cards from six, and a review. The last level of the game.

The robots' worktrees, which the engine already has, become visible in Act 3: the files panel can show a robot's folder, read-only.

## Winning a level

The win is a moment, not only a card. The crew celebrates on the map, and the win card says in one line what the player just learned, lists the commands they ran, and compares the count with the level's par (the length of the documented solution). Commands that only look (`status`, `log`, `diff`, `show`, `reflog`, `help`, `ls`, `cat`) are free and do not count. Beating or matching par is marked on the level list.

## The daily incident

One small broken repository per day, the same for every player, solvable in a few minutes. It is the reason to come back after the acts are done.

- **Incidents are data,** like levels: a setup, a short scene, goals, a documented solution and a par, tested the same way. The day's incident is picked from the pool by the date, with no server. The pool starts at about 20 and repeats after that.
- **Streak and results live in browser storage only.**
- **A result can be shared as plain text with no spoilers:** the incident's number and name, commands against par, hints used, and the link. Example: `Merge Crew #12 · Blaze was in a hurry · 4 commands (par 4) · 0 hints`.
- **A challenge link** opens one named level or incident directly, with the sender's command count to beat in the address. No data is stored anywhere.

## The sandbox

A free-play page: an empty repository, the map, the files panel and the command box, with no goals and no script. The player can create and edit files there. It is for trying things the levels do not ask for.

## Sound

The robots speak in cartoon gibberish: short synthesized beeps and blips while their text types out, a different voice per robot. Simple effects mark game events (a commit appears, a robot hops, a force-push, a win). Sounds are generated in the browser with no audio files, start only after the player's first interaction, default to a low volume, and have a mute button that is remembered.

## Hints

The player can ask Tidy for a hint. Hints come from a low-cost AI model with a hard monthly spending cap. A hint points the player toward the fix and must never contain the full answer command. The hint quality is measured with evals, and every hint call is traced.

## Technical decisions

- **App:** Next.js (App Router) and TypeScript on Vercel, Tailwind v4.
- **Git engine:** our own TypeScript simulator in `src/engine/`. It is pure functions with no React: commits, branches, HEAD, index, working tree, stash, reflog, remotes. Every command returns the new state plus a list of events, and the events drive the animations.
- **Correctness:** tests run the same command sequence through real git (in a temporary folder) and through the engine, then compare refs, history, index and status. Real git decides what is correct.
- **Levels:** data files in `src/levels/` with the starting repository, the scripted robot actions and the goal check. Hint context and scripted hints live server-side in `src/hints/data/`, so they never reach the browser. No level logic lives in components.
- **Characters:** Rive animations, or sprites if the chosen art requires them. Art goes in the repo only when its licence allows public redistribution (CC0 or CC BY with credit in `ASSETS.md`).
- **AI:** Vercel AI SDK and AI Gateway, a low-cost model for hints, and telemetry to Langfuse.
- **Saving progress:** browser storage only. No accounts.
- **Security:** security headers on every page, including a Content-Security-Policy. CI fails on a high or critical `npm audit` finding in the shipped dependencies.

## Not in v1

3D, photo mode, accounts, a backend database, multiplayer, live AI-driven robots, local models in the browser, payments, a level editor, music or recorded speech, mobile layout beyond "playable on a tablet", leaderboards, streaks or results stored on a server, a real-time clock in any level.

## Finished means

- About 22 levels across the 3 acts, playable start to end at a public URL.
- The daily incident with a pool of about 20, the sandbox, and the shareable result.
- At least 4 animated robot characters.
- Hints with evals and tracing in place.
- The engine comparison tests are green in CI.
- The privacy and secret checks are green.
- A README with screenshots, plus a short write-up of what was learned.

## Build order

What is left, in the order it is built. Each line is one batch of work with its own pull request.

1. Terminal help: `help`, a suggestion for a mistyped command, Tab completion, `git log --graph`.
2. The win: par per level, free looking commands, the recap on the win card, the crew's celebration.
3. Act 3, level 1: review before merge, and a robot's folder in the files panel.
4. Act 3, level 2: the turn-based shift, the inbox and rule cards.
5. Act 3, level 3: the full shift.
6. The daily incident: the pool, the date pick, the streak, the shared result and the challenge link.
7. The sandbox.
8. Content-Security-Policy and the audit step in CI. Move the source art boards out of the repository's main history if the licence notes can follow them.
9. README screenshots and the write-up of what was learned.
