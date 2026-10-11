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
  /**
   * The git command hint 3 should name: the subcommand of the documented solution's next step for this
   * situation ("push", or "stash list" for the two-word commands), or several when more than one is a
   * right next step. Left out where the next step is not one clear command (such as editing a file).
   * Checked deterministically by namesExpectedCommand.
   */
  expectedCommand?: string | readonly string[];
};

export const CASES: StuckCase[] = [
  // act1-01: status, add, commit
  { id: "act1-01-nothing", levelId: "act1-01", kind: "nothing-useful", commands: ["ls", "git log"], expect: "Look at git status to see that list.txt is changed and not staged." },
  { id: "act1-01-commit-first", levelId: "act1-01", kind: "wrong-thing", commands: ['git commit -m "Add batteries"'], expect: "Nothing is staged yet: stage list.txt with git add before committing.", expectedCommand: "add" },
  { id: "act1-01-staged", levelId: "act1-01", kind: "one-step-away", commands: ["git status", "git add list.txt"], expect: "The file is staged; now commit it with a message.", expectedCommand: "commit" },

  // act1-02: branch and switch
  { id: "act1-02-nothing", levelId: "act1-02", kind: "nothing-useful", commands: ["git status"], expect: "Make a new branch for the bolts before saving them.", expectedCommand: ["switch", "branch"] },
  { id: "act1-02-committed-on-main", levelId: "act1-02", kind: "wrong-thing", commands: ["git add snacks.txt", 'git commit -m "bolts"'], expect: "The commit landed on main; check which branch you are on and move the work to a branch of its own.", expectedCommand: ["switch", "branch"] },
  { id: "act1-02-still-on-branch", levelId: "act1-02", kind: "one-step-away", commands: ["git switch -c bolts", "git add snacks.txt", 'git commit -m "Add bolts"'], expect: "The bolts are saved on the branch; switch back to main.", expectedCommand: "switch" },

  // act1-03: merge
  { id: "act1-03-nothing", levelId: "act1-03", kind: "nothing-useful", commands: ["git status"], expect: "Stay on main and merge Tidy's branches in, one at a time.", expectedCommand: "merge" },
  { id: "act1-03-switched-away", levelId: "act1-03", kind: "wrong-thing", commands: ["git switch menu"], expect: "Merging happens from main: go back to main and merge the branches into it.", expectedCommand: "switch" },
  { id: "act1-03-one-merged", levelId: "act1-03", kind: "one-step-away", commands: ["git merge menu"], expect: "The menu is in; merge the other branch (colors) too.", expectedCommand: "merge" },

  // act1-04: origin, pull, push
  { id: "act1-04-nothing", levelId: "act1-04", kind: "nothing-useful", commands: [], expect: "git status shows the copy is behind origin; pull first.", expectedCommand: "pull" },
  { id: "act1-04-push-rejected", levelId: "act1-04", kind: "wrong-thing", commands: ["git add sign.txt", 'git commit -m "Saturdays"', "git push"], expect: "The push was rejected because origin has a commit you lack: pull, then push again.", expectedCommand: "pull" },
  { id: "act1-04-ready-to-push", levelId: "act1-04", kind: "one-step-away", commands: ["git pull", "git add sign.txt", 'git commit -m "Saturdays"'], expect: "Everything is committed and you are ahead of origin; push.", expectedCommand: "push" },

  // act1-05: stash
  { id: "act1-05-nothing", levelId: "act1-05", kind: "nothing-useful", commands: ["git status"], expect: "The edit in menu.txt is not saved and would be overwritten by the other branch; put it on the stash shelf before switching.", expectedCommand: "stash" },
  { id: "act1-05-switch-refused", levelId: "act1-05", kind: "wrong-thing", commands: ["git switch prices"], expect: "Git refused the switch to protect the unsaved edit; put the edit aside with the stash first.", expectedCommand: "stash" },
  { id: "act1-05-back-on-main", levelId: "act1-05", kind: "one-step-away", commands: ["git stash", "git switch prices", "git switch main"], expect: "Back on main with the edit still on the shelf; take it off the stash again.", expectedCommand: "stash pop" },

  // act1-06: cherry-pick
  { id: "act1-06-nothing", levelId: "act1-06", kind: "nothing-useful", commands: ["git status"], expect: "Only one commit on Tidy's branch is wanted; copy just that commit onto main instead of merging the branch.", expectedCommand: "cherry-pick" },
  { id: "act1-06-merged-all", levelId: "act1-06", kind: "wrong-thing", commands: ["git merge ideas"], expect: "The merge brought the unfinished cups onto main too; undo the merge and copy only the opening hours commit.", expectedCommand: "reset" },
  { id: "act1-06-looked-at-log", levelId: "act1-06", kind: "one-step-away", commands: ["git log --oneline ideas"], expect: "The opening hours commit is the newest on the branch; copy it onto main.", expectedCommand: "cherry-pick" },

  // act1-07: revert
  { id: "act1-07-nothing", levelId: "act1-07", kind: "nothing-useful", commands: ["git status"], expect: "The sign typo is two saves back and the price list on top must stay; cancel that one save with a new commit.", expectedCommand: "revert" },
  { id: "act1-07-reverted-latest", levelId: "act1-07", kind: "wrong-thing", commands: ["git revert HEAD"], expect: "That cancelled the price list, not the sign change; the sign save is one further back, so revert that one.", expectedCommand: "revert" },
  { id: "act1-07-looked-at-log", levelId: "act1-07", kind: "one-step-away", commands: ["git log --oneline"], expect: "The sign change is the second commit from the top; cancel it with a revert.", expectedCommand: "revert" },

  // act1-08: reset
  { id: "act1-08-nothing", levelId: "act1-08", kind: "nothing-useful", commands: ["git status"], expect: "The last save was made too soon and has not been pushed; move the branch back one save and keep the changes in the files.", expectedCommand: "reset" },
  { id: "act1-08-hard-reset", levelId: "act1-08", kind: "wrong-thing", commands: ["git reset --hard HEAD~1"], expect: "The hard reset threw the fizz line away; the reflog still remembers the save, so look there to get it back.", expectedCommand: "reflog" },
  { id: "act1-08-looked-at-log", levelId: "act1-08", kind: "one-step-away", commands: ["git log --oneline"], expect: "The fizz save is the latest one; move the branch back one save, keeping the changes.", expectedCommand: "reset" },

  // act1-09: reflog
  { id: "act1-09-nothing", levelId: "act1-09", kind: "nothing-useful", commands: ["git status"], expect: "The fizz save is on no branch, but the reflog remembers where it was; look there and put a branch back on it.", expectedCommand: "reflog" },
  { id: "act1-09-log-all", levelId: "act1-09", kind: "wrong-thing", commands: ["git log --oneline --all"], expect: "The deleted branch's save is on no branch so log does not list it; the reflog is your own diary of past positions.", expectedCommand: "reflog" },
  { id: "act1-09-found-it", levelId: "act1-09", kind: "one-step-away", commands: ["git reflog"], expect: "The fizz save is in the reflog; put a branch back on it.", expectedCommand: "branch" },

  // act1-10: merge conflict
  { id: "act1-10-nothing", levelId: "act1-10", kind: "nothing-useful", commands: ["git status"], expect: "Tidy's slogan branch has to be merged into main; git will stop on a conflict that you then settle.", expectedCommand: "merge" },
  { id: "act1-10-commit-too-soon", levelId: "act1-10", kind: "wrong-thing", commands: ["git merge slogan", "git commit"], expect: "Git refused to commit because the conflict in sign.txt is not settled; fix the file, then add it.", expectedCommand: "add" },

  // act1-11: diff, add and commit
  { id: "act1-11-nothing", levelId: "act1-11", kind: "nothing-useful", commands: ["git status"], expect: "Two files are changed and only one change is wanted; look at what changed in each file before saving anything.", expectedCommand: "diff" },
  { id: "act1-11-commit-unstaged", levelId: "act1-11", kind: "wrong-thing", commands: ["git diff", 'git commit -m "Save"'], expect: "Nothing is staged, so there is nothing to save; stage just the file with the good change first.", expectedCommand: "add" },
  { id: "act1-11-staged-sign", levelId: "act1-11", kind: "one-step-away", commands: ["git diff", "git add sign.txt"], expect: "Only sign.txt is staged and the test line in menu.txt is left out; commit what is staged.", expectedCommand: "commit" },

  // act1-12: restore
  { id: "act1-12-nothing", levelId: "act1-12", kind: "nothing-useful", commands: ["git status"], expect: "The edit in sign.txt is unwanted and the one in menu.txt is good; put just sign.txt back to its last saved version.", expectedCommand: "restore" },
  { id: "act1-12-stashed", levelId: "act1-12", kind: "wrong-thing", commands: ["git stash"], expect: "The stash took both edits off the files, including the good one; bring them back first, then put back only sign.txt.", expectedCommand: "stash pop" },
  { id: "act1-12-looked-at-diff", levelId: "act1-12", kind: "one-step-away", commands: ["git diff"], expect: "The diff shows the loud edit is in sign.txt; put that one file back to its last saved version.", expectedCommand: "restore" },

  // act1-13: rebase
  { id: "act1-13-nothing", levelId: "act1-13", kind: "nothing-useful", commands: ["git status"], expect: "The menu branch is one save behind main; replay its save on top of main so the history stays one straight line.", expectedCommand: "rebase" },
  { id: "act1-13-merged", levelId: "act1-13", kind: "wrong-thing", commands: ["git merge main"], expect: "The merge added an extra joining commit, so the history is not a straight line; undo it and rebase instead.", expectedCommand: "reset" },
  { id: "act1-13-looked-at-log", levelId: "act1-13", kind: "one-step-away", commands: ["git log --oneline --all"], expect: "Main has a commit the menu branch lacks; replay the branch on top of main.", expectedCommand: "rebase" },

  // act2-01: reflog recovery
  { id: "act2-01-nothing", levelId: "act2-01", kind: "nothing-useful", commands: ["git status", "git log --oneline"], expect: "The lost commits are not in the log of any branch; the reflog remembers where main was.", expectedCommand: "reflog" },
  { id: "act2-01-wrong-branch", levelId: "act2-01", kind: "wrong-thing", commands: ["git pull", "git switch tidy"], expect: "Tidy's branch was reset too; look in the reflog for the commit before the reset.", expectedCommand: "reflog" },
  { id: "act2-01-merged-not-pushed", levelId: "act2-01", kind: "one-step-away", commands: ["git reflog", "git branch tidy-rescue main@{1}", "git merge tidy-rescue"], expect: "The price list is back on local main; push it to origin, no force needed.", expectedCommand: "push" },

  // act2-02: merge conflict
  { id: "act2-02-nothing", levelId: "act2-02", kind: "nothing-useful", commands: ["git status"], expect: "Merge Drift's branch into main and expect a conflict in sign.txt.", expectedCommand: "merge" },
  { id: "act2-02-switch-refused", levelId: "act2-02", kind: "wrong-thing", commands: ["git switch drift"], expect: "Drift's branch is busy in Drift's worktree; merge it into main from where you are instead.", expectedCommand: "merge" },
  { id: "act2-02-in-conflict", levelId: "act2-02", kind: "one-step-away", commands: ["git merge drift"], expect: "Open sign.txt, keep both lines, then git add it and commit." },

  // act2-03: stash
  { id: "act2-03-nothing", levelId: "act2-03", kind: "nothing-useful", commands: ["git status"], expect: "Look at the stash list; the recipe is not the newest entry.", expectedCommand: ["stash list", "stash show", "stash branch"] },
  { id: "act2-03-popped-doodles", levelId: "act2-03", kind: "wrong-thing", commands: ["git stash pop"], expect: "That restored the doodles, not the recipe; look at the stash list and pick the recipe entry." },
  { id: "act2-03-staged-recipe", levelId: "act2-03", kind: "one-step-away", commands: ["git stash list", "git stash branch fizz stash@{1}", "git add menu.txt"], expect: "The recipe is on its own branch and staged; commit it.", expectedCommand: "commit" },

  // act2-04: revert
  { id: "act2-04-nothing", levelId: "act2-04", kind: "nothing-useful", commands: ["git status"], expect: "Pull first to see Blaze's commit, then find it in the log.", expectedCommand: "pull" },
  { id: "act2-04-reset", levelId: "act2-04", kind: "wrong-thing", commands: ["git pull", "git reset --hard HEAD~2"], expect: "Resetting rewrites shared history; undo Blaze's change with a new commit (revert) instead.", expectedCommand: ["pull", "revert"] },
  { id: "act2-04-reverted", levelId: "act2-04", kind: "one-step-away", commands: ["git pull", "git revert HEAD~1"], expect: "The revert commit is made locally; push it.", expectedCommand: "push" },

  // act2-05: cherry-pick
  { id: "act2-05-nothing", levelId: "act2-05", kind: "nothing-useful", commands: ["git log --oneline"], expect: "Look at Drift's branch's commits to find the table fix.", expectedCommand: ["log", "cherry-pick"] },
  { id: "act2-05-merged-all", levelId: "act2-05", kind: "wrong-thing", commands: ["git merge drift"], expect: "Merging brings the cups and the poem too; copy only the fix commit instead.", expectedCommand: ["reset", "cherry-pick"] },
  { id: "act2-05-picked", levelId: "act2-05", kind: "one-step-away", commands: ["git cherry-pick drift~1"], expect: "The fix is on main locally; push it.", expectedCommand: "push" },
];

/** The expected commands of a case as a list (empty when the case has none). */
export function expectedCommands(c: Pick<StuckCase, "expectedCommand">): readonly string[] {
  return c.expectedCommand === undefined ? [] : typeof c.expectedCommand === "string" ? [c.expectedCommand] : c.expectedCommand;
}

/**
 * Does the hint name one of the case's expected commands as `git <subcommand>`? A one-word
 * expectation also matches its two-word forms ("stash" matches "git stash list"). Undefined when the
 * case has no expected command.
 */
export function namesExpectedCommand(named: readonly string[], c: Pick<StuckCase, "expectedCommand">): boolean | undefined {
  const expected = expectedCommands(c);
  if (!expected.length) return undefined;
  return named.some((n) => expected.some((e) => n === e || n.startsWith(`${e} `)));
}
