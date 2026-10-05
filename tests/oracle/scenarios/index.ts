import type { Scenario } from "../scenario";
import { basics } from "./basics";
import { branches } from "./branches";
import { history } from "./history";
import { merges } from "./merges";
import { remotes } from "./remotes";
import { worktrees } from "./worktrees";

export const scenarios: Scenario[] = [...basics, ...branches, ...history, ...merges, ...remotes, ...worktrees];
