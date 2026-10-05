// "Stuck" moments for the hint evals: two or three per level. Each case is the commands a player
// typed after the opening scene. The game itself plays them (see materialise.ts), so the recent
// commands, their output, the goals and the status in the hint request are exactly what the real
// game would send.

export type StuckKind =
  /** The player has not typed anything that moves the level on. */
  | "nothing-useful"
  /** The player tried something that does not work or goes the wrong way. */
  | "wrong-thing"
  /** One command, or one edit, from done. */
  | "one-step-away";

export type StuckCase = {
  id: string;
  levelId: string;
  kind: StuckKind;
  /** Typed by the player, in order, after the opening scene. Some are refused; that is the point. */
  commands: string[];
  /** What a good hint should point toward, for the model grader. Not shown to the hint model. */
  expect: string;
};

export const CASES: StuckCase[] = [
  // act1-01: status, add, commit
  { id: "act1-01-nothing", levelId: "act1-01", kind: "nothing-useful", commands: ["ls", "git log"], expect: "Look at git status to see that list.txt is changed and not staged." },
  { id: "act1-01-commit-first", levelId: "act1-01", kind: "wrong-thing", commands: ['git commit -m "Add batteries"'], expect: "Nothing is staged yet: stage list.txt with git add before committing." },
  { id: "act1-01-staged", levelId: "act1-01", kind: "one-step-away", commands: ["git status", "git add list.txt"], expect: "The file is staged; now commit it with a message." },

  // act1-02: branch and switch
  { id: "act1-02-nothing", levelId: "act1-02", kind: "nothing-useful", commands: ["git status"], expect: "Make a new branch for the bolts before saving them." },
  { id: "act1-02-committed-on-main", levelId: "act1-02", kind: "wrong-thing", commands: ["git add snacks.txt", 'git commit -m "bolts"'], expect: "The commit landed on main; check which branch you are on and move the work to a branch of its own." },
  { id: "act1-02-still-on-branch", levelId: "act1-02", kind: "one-step-away", commands: ["git switch -c bolts", "git add snacks.txt", 'git commit -m "Add bolts"'], expect: "The bolts are saved on the branch; switch back to main." },

  // act1-03: merge
  { id: "act1-03-nothing", levelId: "act1-03", kind: "nothing-useful", commands: ["git status"], expect: "Stay on main and merge Tidy's branches in, one at a time." },
  { id: "act1-03-switched-away", levelId: "act1-03", kind: "wrong-thing", commands: ["git switch menu"], expect: "Merging happens from main: go back to main and merge the branches into it." },
  { id: "act1-03-one-merged", levelId: "act1-03", kind: "one-step-away", commands: ["git merge menu"], expect: "The menu is in; merge the other branch (colors) too." },

  // act1-04: origin, pull, push
  { id: "act1-04-nothing", levelId: "act1-04", kind: "nothing-useful", commands: [], expect: "git status shows the copy is behind origin; pull first." },
  { id: "act1-04-push-rejected", levelId: "act1-04", kind: "wrong-thing", commands: ["git add sign.txt", 'git commit -m "Saturdays"', "git push"], expect: "The push was rejected because origin has a commit you lack: pull, then push again." },
  { id: "act1-04-ready-to-push", levelId: "act1-04", kind: "one-step-away", commands: ["git pull", "git add sign.txt", 'git commit -m "Saturdays"'], expect: "Everything is committed and you are ahead of origin; push." },

  // act2-01: reflog recovery
  { id: "act2-01-nothing", levelId: "act2-01", kind: "nothing-useful", commands: ["git status", "git log --oneline"], expect: "The lost commits are not in the log of any branch; the reflog remembers where main was." },
  { id: "act2-01-wrong-branch", levelId: "act2-01", kind: "wrong-thing", commands: ["git pull", "git switch tidy"], expect: "Tidy's branch was reset too; look in the reflog for the commit before the reset." },
  { id: "act2-01-merged-not-pushed", levelId: "act2-01", kind: "one-step-away", commands: ["git reflog", "git branch tidy-rescue main@{1}", "git merge tidy-rescue"], expect: "The price list is back on local main; push it to origin, no force needed." },

  // act2-02: merge conflict
  { id: "act2-02-nothing", levelId: "act2-02", kind: "nothing-useful", commands: ["git status"], expect: "Merge Drift's branch into main and expect a conflict in sign.txt." },
  { id: "act2-02-switch-refused", levelId: "act2-02", kind: "wrong-thing", commands: ["git switch drift"], expect: "Drift's branch is busy in Drift's worktree; merge it into main from where you are instead." },
  { id: "act2-02-in-conflict", levelId: "act2-02", kind: "one-step-away", commands: ["git merge drift"], expect: "Open sign.txt, keep both lines, then git add it and commit." },

  // act2-03: stash
  { id: "act2-03-nothing", levelId: "act2-03", kind: "nothing-useful", commands: ["git status"], expect: "Look at the stash list; the recipe is not the newest entry." },
  { id: "act2-03-popped-doodles", levelId: "act2-03", kind: "wrong-thing", commands: ["git stash pop"], expect: "That restored the doodles, not the recipe; look at the stash list and pick the recipe entry." },
  { id: "act2-03-staged-recipe", levelId: "act2-03", kind: "one-step-away", commands: ["git stash list", "git stash branch fizz stash@{1}", "git add menu.txt"], expect: "The recipe is on its own branch and staged; commit it." },

  // act2-04: revert
  { id: "act2-04-nothing", levelId: "act2-04", kind: "nothing-useful", commands: ["git status"], expect: "Pull first to see Blaze's commit, then find it in the log." },
  { id: "act2-04-reset", levelId: "act2-04", kind: "wrong-thing", commands: ["git pull", "git reset --hard HEAD~2"], expect: "Resetting rewrites shared history; undo Blaze's change with a new commit (revert) instead." },
  { id: "act2-04-reverted", levelId: "act2-04", kind: "one-step-away", commands: ["git pull", "git revert HEAD~1"], expect: "The revert commit is made locally; push it." },

  // act2-05: cherry-pick
  { id: "act2-05-nothing", levelId: "act2-05", kind: "nothing-useful", commands: ["git log --oneline"], expect: "Look at Drift's branch's commits to find the table fix." },
  { id: "act2-05-merged-all", levelId: "act2-05", kind: "wrong-thing", commands: ["git merge drift"], expect: "Merging brings the cups and the poem too; copy only the fix commit instead." },
  { id: "act2-05-picked", levelId: "act2-05", kind: "one-step-away", commands: ["git cherry-pick drift~1"], expect: "The fix is on main locally; push it." },
];
