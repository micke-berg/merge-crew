import type { Scenario } from "../scenario";
import { basics } from "./basics";
import { branches } from "./branches";
import { edgeCases } from "./edge-cases";
import { history } from "./history";
import { merges } from "./merges";
import { picks } from "./picks";
import { rebases } from "./rebases";
import { remotes } from "./remotes";
import { specialNames } from "./special-names";
import { stashes } from "./stashes";
import { worktrees } from "./worktrees";

export const scenarios: Scenario[] = [...basics, ...branches, ...history, ...merges, ...remotes, ...worktrees, ...edgeCases, ...rebases, ...picks, ...stashes, ...specialNames];
