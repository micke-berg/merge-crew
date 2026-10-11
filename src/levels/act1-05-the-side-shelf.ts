import type { Level } from "@/engine/types";
import { allOf, currentBranchIs, hasVisitedBranch, stashIsEmpty, workingFileEquals } from "./goals";
import { git, say, write } from "./script";

const MENU = "Lemonade\nIced tea\n";
/** The unfinished edit in the player's working files: a drink that is not ready to be saved yet. */
const MENU_WITH_FIZZ = "Lemonade\nIced tea\nLemon-lavender fizz (not ready!)\n";
const MENU_WITH_PRICES = "Lemonade 20 kr\nIced tea 25 kr\n";

/*
 * Verified against real git 2.46:
 *
 *   Setup: main has one commit (menu.txt). Tidy makes one more commit in its own worktree, which
 *   rewrites menu.txt with prices, and branch `prices` points at it (Tidy is left detached there, so
 *   the player can switch to it). The player is on main with an unsaved edit to menu.txt (the fizz line).
 *
 *   git switch prices   refused: "Your local changes to the following files would be overwritten"
 *   git stash           the edit goes on the shelf, menu.txt is back to the last save
 *   git switch prices   works
 *   git switch main
 *   git stash pop       the edit comes back, the shelf is empty
 *
 *   Not accepted: git stash drop or git stash clear (the edit is thrown away), or discarding the edit
 *   with git restore / git checkout -- menu.txt.
 */

export const level: Level = {
  id: "act1-05",
  act: 1,
  order: 5,
  title: "The side shelf",
  brief: "Your edit is not ready to be saved, but you have to look at another branch. Put it aside, look, and bring it back.",
  mission: {
    situation:
      "You started adding a fizz drink to menu.txt and it is not finished. Tidy needs you to look at the prices branch right now.",
    job: "Put your unfinished edit on the stash shelf, visit the prices branch, come back to main and take your edit off the shelf again. You will meet this again when Hoarder piles things up in Act 2.",
    practise: ["git stash", "git switch", "git stash pop"],
  },
  usedIn: "act2-03",
  crew: ["tidy"],
  setup: [
    write("player", "menu.txt", MENU),
    git("player", "add", "menu.txt"),
    git("player", "commit", "-m", "Write the menu"),
    // Tidy builds the prices branch in its own worktree, so the player's own position never moves
    // during setup and "has visited prices" starts out false.
    git("player", "worktree", "add", "/crew/tidy", "-b", "tidy-prices"),
    write("tidy", "menu.txt", MENU_WITH_PRICES),
    git("tidy", "add", "menu.txt"),
    git("tidy", "commit", "-m", "Add prices"),
    git("tidy", "switch", "--detach"),
    git("player", "branch", "prices", "tidy-prices"),
    git("player", "branch", "-D", "tidy-prices"),
    // The unfinished edit the player is carrying: modified and not staged.
    write("player", "menu.txt", MENU_WITH_FIZZ),
  ],
  intro: [
    say("tidy", "You started adding a fizz drink to menu.txt. It is not finished, so we should not save it yet.", "talking", ["menu.txt"]),
    say("tidy", "But I need you to look at the prices branch for a second. Try git switch prices and see what git says.", "thinking"),
    say("tidy", "It will say no, to protect your edit. The fix is the stash: a shelf for work you are not ready to save.", "happy"),
    say("tidy", "git stash puts your edit on the shelf and cleans your files. git stash pop takes it back off.", "talking"),
  ],
  goals: [
    {
      id: "visit-prices",
      description: "Visit the prices branch: git switch prices (put your edit on the shelf first, with git stash)",
      check: hasVisitedBranch("player", "prices"),
    },
    {
      id: "edit-back",
      description: "Come back to main with your fizz edit back in menu.txt and nothing left on the shelf: git switch main, then git stash pop",
      check: allOf(
        hasVisitedBranch("player", "prices"),
        currentBranchIs("player", "main"),
        workingFileEquals("player", "menu.txt", MENU_WITH_FIZZ),
        stashIsEmpty(),
      ),
    },
  ],
  suggestions: ["git status", "git stash", "git switch prices", "git switch main", "git stash pop", "git stash list"],
  outro: [
    say("tidy", "Your fizz edit is back, exactly where you left it. And the shelf is empty again.", "celebrate"),
    say("tidy", "Stash is for when you have to move but you are not ready to save. Some of the crew never stop using it.", "happy"),
  ],
};
