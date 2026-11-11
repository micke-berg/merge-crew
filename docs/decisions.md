# Decisions

Newest first. Each entry: date, what was decided, why.

## 2026-11-11 — The daily incident, a result to paste, and challenge links

- **`/daily` plays one level a day, the same for everyone.** The day is counted in UTC from 2026-11-11 (incident #1). The level comes from a pool, shuffled afresh each round with a seeded generator, so no server is involved and no incident repeats two days running (`src/daily/daily.ts`, pure and tested).
- **The pool is the six existing levels with a par where a robot breaks or hides something** (Act 2, and the review level of Act 3). Levels with rule cards are left out: the pick decides how much there is to fix, so two players' counts could not be compared. Six is thin. A player who has finished the acts has seen them all, and the daily is then a chase for par. Incidents written only for the daily are the way to make it worth coming back for; the spec now says the pool grows and does not promise 20 for v1.
- **The streak and each day's best result live in browser storage only.** A streak survives until a whole day is missed.
- **The win card can copy the result as plain text with no spoilers:** the incident number, the title, commands against par, hints used and the link. When the browser refuses the clipboard, the text is shown to copy by hand.
- **A challenge link is a level address with the sender's count, `/level/act2-01?beat=3`.** The brief says what there is to beat, the win card says whether it was matched, and nothing is stored anywhere. The page stays static: the count is read in the browser.

## 2026-11-11 — The full shift (act3-03) ends the game

- **The last level gives the player two jobs at once: a review and a fix.** Tidy commits honest work on a branch and asks for a review; no card can stop that beat (`ShiftBeat.stoppedBy` is now optional, and `review` marks it in the report). Of the other three robots, the player's two cards stop two. The order of the two jobs is the player's.
- **Only the beats a card can stop push to origin's main,** and exactly one of them gets through. A beat that always runs commits locally. That keeps every push in the scene valid in real git whatever the pick, without a script that branches on earlier beats.
- **Drift's mistake differs from level 2:** unread work pushed straight to main, where one commit called "Tidy the folder" deletes the price list. It ties the review card back to the first Act 3 level.
- **Three picks, three documented solutions, each compared with real git,** as in level 2.

## 2026-11-11 — Rule cards and the shift (act3-02, "House rules")

- **A shift is data on the level (`Level.shift`): rule cards, how many to pick, and beats.** A beat is one robot's turn: what it says, the git steps it would run, and the id of the card that stops it. `src/levels/shift.ts` turns a shift and a pick into ordinary script steps that play after the intro, so the game, the level tests and the real-git comparison all run the same thing. No new phase, and no level logic in components.
- **The shift plays as one scene, then the player fixes what got through.** The amended spec first said the script would move one beat per player command. That would have interleaved robot steps with the player's fix, and every card pick would need its own interleaved solution checked against real git. One scene keeps each pick's solution short and exact. The spec is corrected to match.
- **Pick two of three, so exactly one mistake gets through and every pick is a different level.** Blaze force-pushes over main (fix: pull, which merges, then push). Drift pushes unfinished notes onto the menu (fix: revert). Hoarder commits the till password (fix: remove the file in a new commit; the outro says the password must be changed too, because it stays in the history).
- **Every pick has a documented solution, and each is compared with real git** (`variantSolutions`, three runs for this level). The hint leak check uses the commands of all of them.
- **No par for a level with cards.** The pick decides how much there is to fix, so one number would be unfair to two of the three picks.
- **A level with cards always shows its brief,** also to a returning player, because the cards are picked there.
- **Contract changes (additive, in `src/engine/types.ts`):** `RuleCard`, `ShiftBeat`, `Shift`, `Level.shift?`, and a `note` script step that writes one line into the command box.

## 2026-11-11 — Act 3 begins: review before merge

- **act3-01, "Read before you merge", is the first level about leading and not about a git tool.** Three robots each say a branch is ready. Two are. Blaze's second commit is called "Make the site faster" and deletes the price list. Nothing in the level says which branch is the bad one: the goals ask for "the safe ones", and the rule is "nothing goes missing from main".
- **Merging the bad branch does not lose the level.** The rule turns into a warning and the player puts it right (undo the merge, or revert the commit that deleted the file). Taking only the banner with a cherry-pick is also accepted.
- **In Act 3 the files panel can show each robot's folder, read-only.** The engine has had one worktree per robot from the start; a lead who reviews work has a reason to look inside them. The player's commands still run in the player's own folder.
- **`git log --stat` is not in the engine.** The level's buttons use `git show --stat` and `git diff main...branch`, which are.

## 2026-11-11 — Par, a recap and a celebration on the win

- **Every level has a par: the number of commands in its documented solution that change something.** Looking is free (`status`, `log`, `diff`, `show`, `reflog`, `blame`, listing branches or stashes, `ls`, `cat`, `help`), because looking is how a player learns and a count that punishes it teaches the wrong habit. A typo or a command git refuses is not counted either. The rule is one function, `countsAsMove` in `src/components/game/moves.ts`.
- **Par is written in the level file, and a test holds it to the solution.** The solution itself must not reach the browser, so the number is copied; the test fails when they drift apart, and a second test plays each solution and requires it to land on par.
- **The win card says what was learned in one or two sentences (`Level.learned`), shows the count against par, and lists the commands that counted.** The old line counted everything typed, `ls` included, and meant nothing.
- **A short fall of confetti in the crew's colours marks the win on the map,** not drawn with reduced motion.
- **The fewest moves per level are kept in browser storage,** and the level list marks a level solved at or under par.
- **Contract change (additive, in `src/engine/types.ts`):** `Level.par?: number` and `Level.learned?: string`.

## 2026-11-11 — Help, a guess for a mistyped command, and Tab

- **`help`, `git help` and `git --help` list what the game runs,** one plain line per command. The list is checked against the engine's command table in a test, so a new command needs a help line.
- **A mistyped git command gets git's own "The most similar command is" answer.** The wording is git's (checked against git 2.43). The scoring is not: the engine uses a plain edit distance where swapped neighbours count once, and also offers a command the typed word is the start of. Git's list can differ, for example it also offers its `stage` alias, which the game does not have.
- **A git command typed without `git` in front is answered with "Did you mean: git status".** It is the most common slip a beginner makes.
- **Tab completes commands, branch names and file names** in the command box (`completion.ts`, pure and tested). An empty box leaves Tab alone, so keyboard users can still move on from it.
- **`git log --graph` is not in this batch.** Its output is the behaviour, so it needs its own comparison against real git's drawing, which is a port of git's graph code and not a small change.

## 2026-11-11 — Goals that start true are rules, not steps

- **The job bar shows a goal that is already met when the player's turn begins under "Keep it that way", apart from the numbered steps.** Every Act 2 level has one or two such goals ("Blaze's commit stays in the history"). They were drawn as ticked steps, so a level opened on "2 of 3 done" before the player had typed anything. The earlier rule against pre-done goals removed them from the practice levels; in Act 2 they have to stay, because they are what rejects a shortcut.
- **A kept rule is quiet, a broken one is loud.** It is not counted in the progress line. If a command makes it false it turns into a warning, and it becomes the current line once every step is done.
- **No level or contract change.** Which goals are rules is worked out from the game state at the start of the turn (`GameState.kept`), so `Level` and `Goal` are untouched and every level gets it for free. A test plays each level to the player's turn and requires at least one step, none of them ticked.

## 2026-11-11 — Robot names avoid the tags of other stops

- **Name pills treat the tags under a stop on the row above as obstacles,** and go above the robots when both sides are taken. After a merge, the names of robots on main could cover the `origin/main` tag hanging from the branch above them, which is the label several levels are about.

## 2026-10-11 — `git blame` in the engine, and a level for it

- **`git blame <file>` (and `git blame <rev> <file>`) is in the engine.** A line is blamed on the commit that introduced it: starting from the commit, a line unchanged in a parent is handed to the first parent that has it, and a line no parent has stays with the commit. This is git's own rule, in parent order, using the same line diff as `git diff`.
- **Checked against real git on its attribution,** in `tests/oracle/blame.test.ts`: five histories (edits over several commits, inserted and removed lines, a clean merge, a conflict settled by hand, a line removed and added back) must blame every line on the same commit as `git blame --line-porcelain`.
- **Known differences from git:** no rename or copy detection, no `-L`, `-w` or `-C`, no dates (the game has none), and the output is `<id> (<author> <line>) <text>`.
- **A practice level uses it** (act1-14, "Who changed this line?"): several robots have saved into one file, a price became free, and the player finds which save did it with `blame` and undoes only that one with `revert`. `git bisect` is not in the engine; it would need a bisect state in the repository model and its own comparison tests.

## 2026-10-11 — Two basic practice levels open Act 1's practice group

- **Added `act1-11` "Look before you save" and `act1-12` "Undo an edit", placed first in the practice group.** The most basic everyday tools come before the ones Act 2 relies on. `act1-11` practises `git diff`, `git add` and `git commit` with two changed files where only one change is wanted. `act1-12` practises `git restore <file>`, where the good edit in another file must survive.
- **Both are ordinary practice levels:** one new idea, no crisis, only Tidy, one goal each, and both name `act2-04` ("Undo, politely") in `usedIn`. `git show` is a suggestion button in `act1-11`, not a goal.
- **`git restore --staged` is left out of `act1-12`.** Unstaging is a second idea, and the level is about one.
- **Only `order` changed on the existing practice levels** (`act1-05` to `act1-10` are now 7 to 12, same sequence). Ids, saved progress and hint data are unaffected.

## 2026-10-11 — Practice levels in Act 1, and Act 2 ordered by difficulty

- **Each tool Act 2 relies on gets a short practice level in Act 1** (act1-05 to act1-10): stash, cherry-pick, revert, reset, reflog and a first merge conflict. Playtesting showed that Act 2 asked the player to use tools they had never practised, each one cold, inside a crisis. A practice level has one new idea, no crisis and only Tidy, and ends when the player has used the tool once.
- **A practice level names the Act 2 level that uses the tool (`Level.usedIn`).** The win card offers it as "Try it for real", and the start page groups practice levels under their own heading. Nothing is locked: every level builds its own repository from nothing, so a player can move between acts freely.
- **Practice levels have one goal where a second goal would already be true at the start.** A step that shows as done before the player does anything does not help them. The same reason removed a pre-done goal from act1-03.
- **Act 2 is ordered easiest first, the conflict last:** stash, cherry-pick, revert, reflog, conflict. Only each level's `order` changed, so level ids, saved progress and hint data are unaffected.
- **The stash's own commits are never drawn or reported as lost.** After a pop or a drop they are bookkeeping, not history, and the game gives no way to bring a dropped stash back. If a dropped stash becomes recoverable (as `git stash apply <id>` is in git), it should be shown as lost again.

## 2026-10-06 — Hint models chosen by evals, one per hint number

Supersedes the model and leak-check lines of the 2026-10-05 entry below.

- **Hints 1 and 2: `google/gemini-2.5-flash-lite`. Hint 3 and later: `google/gemini-2.5-flash` with thinking off.** Chosen by `npm run eval:hints` on 27 stuck cases. Against Claude Haiku 4.5, Flash-Lite gave the answer away less often in early hints and costs about a tenth. For hint 3, which has to name the right command for the player's situation, Flash named the right command in 17 of 24 cases (Flash-Lite 10, Haiku 19, Sonnet 5 21) at about a third of Haiku's cost and with the lowest latency. Haiku is the Gateway fallback for hint 3. Gemini's thinking is off for hint calls, because it used up the 120-token answer budget and left fragments.
- **The leak check depends on the hint number.** Hints 1 and 2 may not name any git command; later hints may name the command but not the solution's arguments; a force push is rejected at any hint. Suggestion buttons no longer make a command acceptable. A hint that repeats the opening of an earlier hint, or that stopped at the output limit, is replaced by a scripted hint.
- **The browser sends the hints already shown in the run**, so each hint can go one step further.
- **Tracing uses Langfuse's own AI SDK 7 integration** (`@langfuse/vercel-ai-sdk`) instead of a hand-written one, with stable span names, a session per level run and an environment per deployment.
- **The eval grader judges "gives the answer away" per hint number**, following the same ladder. Scores from before 2026-10-06 are not comparable on that criterion. The grader is not yet checked against human labels.

## 2026-10-05 — AI hints from Tidy

- **"Ask Tidy" gives a hint from a low-cost model, with scripted hints as the safety net.** The model is `anthropic/claude-haiku-4.5` through the Vercel AI Gateway, with `google/gemini-2.5-flash-lite` as the Gateway's fallback model, at most 120 output tokens and a 6 second timeout. Every level has three scripted hints, gentle to specific. They are used when the model is switched off (`HINTS_AI=off`), has no credentials, fails, times out, or gives a hint the checks reject. The response says which source was used and why, so traces and evals can tell them apart.
- **Answer safety is checked in code.** A hint is rejected when it contains a force flag, a documented solution command that is not already a suggestion button, or the same git subcommand with one of the solution's own arguments. A prompt instruction alone can be talked around; a string check cannot.
- **Contract change (in `src/engine/types.ts`): `Level.hintContext` is removed.** It held the intended fix in plain words and shipped to every browser with the level list. The context now lives in server-only modules (`src/hints/data`, guarded by `import "server-only"`) next to the scripted hints, and the build output is checked for it. `src/levels/solutions.ts` may now also be imported by those server modules, for the leak check.
- **Five hints per level per run, counted in the browser; a best-effort per-IP limit on the server.** The server limit lives in one instance's memory, so it is not a guarantee. The hard cap on spending is the AI Gateway budget on the Vercel project, as the spec's "hard monthly spending cap".
- **The hint never blocks the game.** It shows in the dialogue strip under an active command box, so the player keeps typing while reading it.
- **Tracing to Langfuse only when its keys are set.** The AI SDK's ready-made OpenTelemetry integration is a separate package this project does not install, so a small integration on `@langfuse/tracing` records each model call. Without keys nothing is sent.
- **Evals:** deterministic checks run with the normal tests, without network. A live eval with a rubric-based model grader runs on demand (`npm run eval:hints`). The grader is not yet checked against human judgement; `evals/hints/labels.example.json` is the format for doing that.

## 2026-10-05 — A guided screen tour

- **Tidy points at the screen in the first level.** After playing, the maintainer said nobody explains the map: that the line is main, where the saved versions are. The first level's opening now has Tidy point at the map (every dot is a commit), the main line, the files, the job bar and the command box, one short sentence each, while the game dims everything else softly and outlines that part in Tidy's colour. The tour replaced the opening lines that said the same thing, so the scene grew by four lines, not five.
- **Later levels point once, at the moment the thing first matters:** the new branch line in act1-02's closing scene, the merge commit in act1-03's, and the grey lost band in act2-01's opening.
- **A "?" button in every level header replays the screen tour** (the first level's point steps only, no story, no git) during the player turn. Esc ends it, Enter moves it on, like a scene.
- **A branch the player names is matched loosely.** act1-02 points at "bolts", the name the job bar suggests; if the player picked another name, the map lights every branch line except main instead, so the pointer never points at nothing.
- **No git behaviour changed.** Only `say` and `point` lines were edited; every setup, intro and outro git step is identical, and the real-git level test is green.

## 2026-10-05 — Story and first run: Café Cog

- **The crew's world is a small robot café, Café Cog.** The crew builds and runs the café's website (menu, prices, opening hours, the sign); the player is their new lead and keeps the crew's work safe and shipped. Why: playtesting showed players had no idea who they were or why they were there, and scenes opened mid-conversation about things never shown. The existing level content (lemonade, prices, sign, iced tea, tip jar) already fit a café.
- **A short opening story, shown once.** Six lines and a café front with the crew, on the first visit (start screen or a level opened directly), remembered in browser storage, skippable, and replayable from the start screen. The start screen carries a one-sentence version.
- **Story and instructions are separate.** Each level has a mission card in plain words (what's going on, your job, what you'll practise) on the brief. A "Your job" bar sits directly above the terminal at every width and shows the first unmet goal. Scenes were cut to at most five lines, start from what is on screen, and name each file they mention. In Act 1, every teaching line Tidy says is word for word the goal the job bar shows.
- **Contract change (additive, in `src/engine/types.ts`):** `Level.mission?: { situation; job; practise }`, and `files?: Path[]` on the `say` script step. While a line with `files` shows, the files panel highlights those files and the line shows them as chips that open the file. A level test plays each intro and checks every named file exists in the player's working files at that line.
- **No git behaviour changed.** Only `say` lines, briefs, goal descriptions, suggestions and missions were edited; every setup and intro git or edit step is identical, and the real-git level test is green.

## 2026-10-05 — Pocket Machines character art

- The maintainer chose Pocket Machines from three directions. Tidy walks, Blaze rolls, Drift hovers and Hoarder shuffles. Each has eight standard states and one signature action.
- Delivery is transparent PNG sprite sheets, four 512 by 512 px frames per row, with a shared ground anchor and manifest. Artwork is licensed under CC0-1.0; see `ASSETS.md`.
- The asset import does not change the current game components. Use the supplied manifest and drawing helper when replacing the placeholders.

## 2026-10-05 — Robot gibberish voices

- **Robots speak in cartoon gibberish beeps, plus simple event sounds.** Requested after playtesting. Generated in the browser (no audio files, no cost), muted until the first interaction, with a mute button. Music and recorded speech stay out of v1.

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
- **Not the Rive robot.** It did not appeal. Art comes from an external AI art tool working from a written brief that fixes the game's technical needs and leaves the style open. Free toy-like characters with many poses (Kenney) are the reference for charm. Game code uses placeholder shapes until the art is chosen.

## 2026-10-05 — Project start

- **Standalone game, public from the first commit, MIT licence for code.** Art has its own licences, listed in `ASSETS.md`.
- **Game loop: the player leads a crew of robot coding agents who make real agent mistakes.** Act 1 teaches, Act 2 fixes, Act 3 leads with rule cards. Why: no existing git game teaches the problems people now hit while working with coding agents, and existing games mostly show only the commit graph.
- **Flat 2D with soft shadows, no 3D, no photo mode.** Why: an early 3D sketch read as a molecule model, not a game. The appeal has to come from the characters and the animation, and 3D made the history harder to read.
- **Real character art, low cost.** First choice: a free, CC BY licensed Rive robot as the base style, adapted into four crew members. Commissioning custom art is an option after the first playable level, if the base art falls short.
- **Own git simulator, checked against real git in tests.** Why: browser git libraries lack rebase, reflog and worktrees, and earlier attempts drifted because nothing defined correct behaviour.
- **Scripted robots in v1. Live AI robots and local models are out of v1.** Why: levels must play the same way every time, and running costs must stay near zero.
- **AI is used for hints only in v1,** with a low-cost model, a hard spending cap, evals and tracing.
