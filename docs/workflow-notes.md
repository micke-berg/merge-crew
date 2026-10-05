# Building with parallel AI agents: lessons

Merge Crew is built by several AI coding agents working at the same time, each owning specific folders, against a shared spec (`docs/spec.md`) and a shared type contract (`src/engine/types.ts`). These are the lessons, newest first within each section. Add one dated line when something helps or hurts.

## Contracts and coordination

- 2026-10-05 — Earlier attempts at this idea drifted when agents built things outside the goal. What held this time: a written spec with an explicit "not in v1" list, an ideas file as the only place for new ideas, and a review against the spec before every merge.
- 2026-10-05 — Writing the shared types before starting any parallel work let four agents build the engine, the real-git tests, the map and the levels at the same time. The map was built against hand-made state fixtures, before the engine existed.
- 2026-10-05 — The engine and test agents agreed on conventions directly and early (reflog order, how empty ids are written, pull merge messages), so the first comparison run was 94 of 96 green.
- 2026-10-05 — Agents that verify their work in a shell must never stop processes by name or delete with wildcards. A pattern match on "cat" also matches "Application" and stopped unrelated programs on the development machine. A wildcard delete in the shared temp folder could remove another agent's files. Both are now rules in `AGENTS.md`.

## Real git as the referee

- 2026-10-05 — A throwaway fuzz of the merge code against `git merge-file` found a 2% mismatch that the scenario tests missed: tie-breaking between equally short diffs. Porting git's own diff algorithm fixed it.
- 2026-10-05 — Writing each scenario step's expected real-git outcome (ok, error, stopped) into the scenario caught a wrong assumption before any engine comparison ran: `branch -f` cannot move a branch checked out in another worktree.
- 2026-10-05 — The comparison caught git rules nobody had written down: a detached HEAD that does not move gets no reflog line, and remote-tracking refs need their own reflog because `pull --rebase` finds its fork point there.
- 2026-10-05 — Rebase, cherry-pick and revert copy commits with the same message, which broke the "commits are identified by message" rule of the snapshots. Scenarios that copy commits now declare it, and ids inside messages and conflict markers are replaced by labels.
- 2026-10-05 — The first real-git harness took about a minute, because starting a git process costs about 40 ms. Reading the whole object store with one `cat-file` call, reading reflogs and HEAD files from disk, and running scenarios concurrently brought it to about 10 seconds.

## Levels

- 2026-10-05 — Check a level's story in real git, not just its commands. In a shared repository, commits "lost" to a force-push stay reachable through the robot's own branch and worktree, and a plain pull refuses to drop diverged commits. The force-push scene had to reset both checkouts to make the loss real.
- 2026-10-05 — Real git refuses `git rebase main drift` when `drift` is checked out in a robot's worktree. Robots holding their branches limits what the player can do to them, so goals must accept every fair route (merge, or rebasing a copy).
- 2026-10-05 — Running every suggestion button through the engine, not only the solutions, found a button offering `git log --graph`, which the engine did not support.
- 2026-10-05 — Goals evaluated during a scripted scene showed "2/3 done" before the problem had even happened. Goals are now checked from the player's turn on.

## Interface

- 2026-10-05 — Several layout problems appeared only when playing a level to the end in a browser; the unit tests were green throughout. A speech bubble hid the one tag the force-push scene is about, and robot name labels covered the player's marker after a merge once the wider final art arrived.
- 2026-10-05 — Measuring the artwork's bounding boxes with a throwaway script gave a safe shared crop (about half the pixels) and the per-robot widths used for spacing. The web sprites are about 11% of the source size.
- 2026-10-05 — Next.js 16 allows one dev server per checkout, so parallel agents share it. Browser automation screenshots can lag behind animations; wait, or read the DOM, before judging a frame.

## Tooling and CI

- 2026-10-05 — Local checks passing is not proof. CI failed on the first push twice: a lockfile made with a global `legacy-peer-deps` setting (fixed by the project `.npmrc`), and Next.js route types that exist only after a local build (fixed by running `next typegen` before typechecking).
- 2026-10-05 — Set the repository's commit identity before anything creates a commit. The project scaffolder committed with the machine's global identity.
- 2026-10-05 — Asset handoffs need the files, frame metadata, a redistribution licence and an `ASSETS.md` entry. Source files and tool verification output belong outside the folder the website serves.
- 2026-10-05 — Dependabot runs cannot read repository secrets, so checks that need one must have it added as a Dependabot secret too. Packages that must move together (React and React DOM) need a Dependabot group.
