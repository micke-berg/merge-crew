// The commands reference: plain-language notes on the git commands the game teaches.
// Pure data. The page at /commands renders it, and tests check its links against the level list.

export type CommandEntry = {
  /** The anchor on the page, so /commands#stash opens at this entry. Unique. */
  slug: string;
  /** The command as you would type it. */
  command: string;
  /** A short, plain name for what it is for. */
  title: string;
  /** One sentence: what it does. */
  what: string;
  /** One sentence: when you would use it. */
  when: string;
  /** One thing that can go wrong. */
  risk: string;
  /** One to three lines you could type. */
  examples: string[];
  /** The practice level for this command, if there is one. */
  practice?: string;
  /** The Act 2 level that uses it for real, if there is one. */
  usedIn?: string;
};

export const entries: CommandEntry[] = [
  {
    slug: "status",
    command: "git status",
    title: "See where things stand",
    what: "Shows which files you changed, which are ready to be saved, and which branch you are on.",
    when: "Any time you are not sure what state things are in. It is a good first move before almost anything else.",
    risk: "Nothing breaks, because it only looks. The risk is skipping it and then saving files you did not mean to.",
    examples: ["git status", "git status --short"],
  },
  {
    slug: "add",
    command: "git add",
    title: "Choose what goes in the next save",
    what: "Marks changes as ready for the next commit. Git calls this waiting area the staging area.",
    when: "After you edit files and before you commit. It lets you save some changes now and leave others for later.",
    risk: "A change you make after adding a file is not included. Add the file again, or the commit will miss it.",
    examples: ["git add menu.txt", "git add src/", "git add ."],
  },
  {
    slug: "commit",
    command: "git commit",
    title: "Save a snapshot",
    what: "Saves the changes you added as one new point in history, with a short message saying what you did.",
    when: "Whenever you have a piece of work that makes sense on its own.",
    risk: "Leave out -m and git opens a text editor, which can feel like being stuck. Also, a commit only saves what you added.",
    examples: ['git commit -m "Add prices to the menu"'],
  },
  {
    slug: "log",
    command: "git log --oneline",
    title: "Read the history",
    what: "Lists the saves on your branch, newest first, one short line each.",
    when: "To see what happened, to find a save you want to undo or copy, or to check that yours is there.",
    risk: "By default it shows only the branch you are on. Saves on other branches stay out of the list unless you add --all.",
    examples: ["git log --oneline", "git log --oneline --all", "git log --oneline drift"],
  },
  {
    slug: "branch",
    command: "git branch, git switch",
    title: "Work on a separate line",
    what: "A branch is your own line of work. git branch lists or makes branches, and git switch moves you onto one.",
    when: "Before you start something new, so the main line stays untouched until the work is ready.",
    risk: "Git refuses to switch when your unsaved changes would be overwritten. Commit them or stash them first.",
    examples: ["git branch", "git switch -c prices", "git switch main"],
  },
  {
    slug: "merge",
    command: "git merge",
    title: "Bring a branch home",
    what: "Joins another branch into the one you are on.",
    when: "When the work on a side branch is finished and should become part of the main line.",
    risk: "Merge goes into the branch you are standing on, so check that first. If both sides changed the same lines, git stops with a conflict.",
    examples: ["git switch main", "git merge prices"],
  },
  {
    slug: "push",
    command: "git push",
    title: "Share your saves",
    what: "Sends your commits to the shared copy, usually called origin.",
    when: "When your work is ready for other people to see.",
    risk: "Git refuses if the shared copy has saves you do not have. Pull first. Avoid --force, because it can erase other people's work.",
    examples: ["git push", "git push origin prices"],
  },
  {
    slug: "pull",
    command: "git pull",
    title: "Get other people's work",
    what: "Fetches new saves from the shared copy and merges them into your branch.",
    when: "Before you push, and at the start of a work session, so you build on the latest work.",
    risk: "It can start a merge, and a merge can stop on a conflict. Save or stash your own changes first.",
    examples: ["git pull", "git pull origin main"],
  },
  {
    slug: "stash",
    command: "git stash",
    title: "Put unfinished work aside",
    what: "Puts your unsaved changes on a shelf and gives you back a clean working copy.",
    when: "When you have to look at another branch but your edit is not ready to be saved.",
    risk: "A shelf is easy to forget. Check it with git stash list, and remember that dropping it throws the work away.",
    examples: ["git stash", "git stash list", "git stash pop"],
    practice: "act1-05",
    usedIn: "act2-03",
  },
  {
    slug: "cherry-pick",
    command: "git cherry-pick",
    title: "Copy one save to another branch",
    what: "Copies a single commit from another branch onto the branch you are on.",
    when: "When another branch has one fix you want now, and you do not want the rest of its work.",
    risk: "The copy is a new commit, not the original. If it depends on earlier saves you did not take, it can conflict.",
    examples: ["git log --oneline ideas", "git cherry-pick 3f9c1ab"],
    practice: "act1-06",
    usedIn: "act2-05",
  },
  {
    slug: "revert",
    command: "git revert",
    title: "Undo a save without rewriting history",
    what: "Adds a new commit that cancels out an earlier one. The old commit stays in the history.",
    when: "When the bad save is already shared, so nobody's history should change.",
    risk: "It can conflict if later saves touched the same lines. Reverting a merge needs extra care, because git has to be told which side to keep.",
    examples: ["git log --oneline", "git revert 3f9c1ab"],
    practice: "act1-07",
    usedIn: "act2-04",
  },
  {
    slug: "reset",
    command: "git reset",
    title: "Take your last saves back",
    what: "Moves your branch back to an earlier commit, so the later saves are no longer on it.",
    when: "To take back your own saves that nobody else has yet.",
    risk: "After a push this rewrites history other people already have. Also, --hard throws away your unsaved changes too.",
    examples: ["git reset --soft HEAD~1", "git reset HEAD~1", "git reset --hard HEAD~1"],
    practice: "act1-08",
    usedIn: "act2-04",
  },
  {
    slug: "reflog",
    command: "git reflog",
    title: "Find a save that seems lost",
    what: "Shows git's private diary of where your branches and HEAD have been, including saves that no branch points to any more.",
    when: "After a deleted branch or a reset, when you need to find where things were.",
    risk: "The diary is only on your machine, and old entries are cleaned up in time. Look sooner rather than later.",
    examples: ["git reflog", "git branch fizz HEAD@{1}"],
    practice: "act1-09",
    usedIn: "act2-01",
  },
  {
    slug: "conflict",
    command: "git merge, then git add and git commit",
    title: "Settle a merge conflict",
    what: "When two branches changed the same lines, git stops and marks both versions in the file. You choose what the file should say, then finish the merge.",
    when: "Whenever a merge or pull stops and git tells you there is a conflict.",
    risk: "Committing with the markers (<<<<<<<, =======, >>>>>>>) still in the file. Remove them and check the result before you add it.",
    examples: ["git merge slogan", "git add sign.txt", "git commit"],
    practice: "act1-10",
    usedIn: "act2-02",
  },
  {
    slug: "diff",
    command: "git diff",
    title: "See what changed",
    what: "Shows the exact lines that differ, for example between your files and your last save.",
    when: "Before you add or commit, to check that you are saving what you meant to.",
    risk: "By default it leaves out changes you have already added. Use --staged to see those.",
    examples: ["git diff", "git diff --staged"],
  },
  {
    slug: "show",
    command: "git show",
    title: "Look inside one save",
    what: "Shows the message and the changes of a single commit.",
    when: "When the log gives you a line and you want to know what that save really did.",
    risk: "With no argument it shows the latest commit, which may not be the one you were thinking of.",
    examples: ["git show", "git show 3f9c1ab"],
  },
  {
    slug: "restore",
    command: "git restore",
    title: "Put a file back as it was",
    what: "Brings a file back to the version in your last save, or takes a file out of the staging area.",
    when: "When an edit went nowhere and you want the file as it was, or you added a file by mistake.",
    risk: "Restoring a file's contents throws away the edit for good. Git has no copy of unsaved work.",
    examples: ["git restore menu.txt", "git restore --staged menu.txt"],
  },
  {
    slug: "rebase",
    command: "git rebase",
    title: "Replay your work on a newer base",
    what: "Takes the commits on your branch and replays them on top of another branch, so the history reads as one straight line.",
    when: "To tidy your own branch before sharing it, or to catch it up with main.",
    risk: "It rewrites commits. Do not rebase saves that other people already have.",
    examples: ["git rebase main"],
  },
];
