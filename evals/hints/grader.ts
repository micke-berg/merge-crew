// A rubric-based model grader for hints. Uncalibrated: its verdicts have not yet been checked
// against human labels (see labels.example.json for the format to do that with).

import { generateText, type LanguageModel } from "ai";
import { FIRST_COMMAND_HINT } from "@/hints/leak";

/** A stronger model than the hint model, through the AI Gateway. */
/**
 * A grader from a different model family than the hint model, so it is not grading its own family's
 * writing. Available on the AI Gateway's free credits. It reasons before answering, hence the larger
 * token budget and low reasoning effort.
 */
export const GRADER_MODEL = "openai/gpt-5-mini";

export const CRITERIA = {
  towardNextIdea: "Points the player toward the right next idea for their situation and the current goal.",
  noAnswer: "Does not give the answer away: no full command line that finishes a step, and nothing about --force.",
  short: "One or two short sentences.",
  voice: "Sounds like Tidy: calm, kind, plain words, no lecturing, no markdown.",
  moreSpecificThanPrevious:
    "Compared with the previous hints, it adds something new and is one step more specific (a narrower place to look, or the command to reach for). Repeating or rewording a previous hint fails.",
} as const;

export type Criterion = keyof typeof CRITERIA;

/** The hint ladder, as the hint model is told it (src/hints/prompt.ts), for judging noAnswer by hint number. */
export const LADDER_RULE =
  "The hint ladder: hints 1 and 2 must not name any git command. From hint 3 on, a hint may and should name the one git command to reach for next (for example \"git cherry-pick\" or \"git push\"); naming that command is not giving the answer away. Only the solution's arguments after it (a branch name, commit, file name, or stash or reflog position) or a full command line that finishes a step are off limits.";

/** noAnswer for this hint number: the ladder decides whether naming a command is allowed. */
export function noAnswerRule(hintNumber: number): string {
  return hintNumber >= FIRST_COMMAND_HINT
    ? `${CRITERIA.noAnswer} This is hint ${hintNumber}, so naming the git command itself passes; only its arguments from the solution, or a full command line, fail.`
    : `${CRITERIA.noAnswer} This is hint ${hintNumber}, so naming any git command at all fails.`;
}
/** `pass` holds the criteria that applied: moreSpecificThanPrevious only when there were previous hints. */
export type Grade = { pass: Partial<Record<Criterion, boolean>>; notes: string; overall: boolean };

/** Criteria for every hint. */
export const BASE_CRITERIA: readonly Criterion[] = ["towardNextIdea", "noAnswer", "short", "voice"];

export type GraderInput = {
  context: string;
  goal: string;
  situation: string;
  expect: string;
  hint: string;
  /** Which hint of the run this is (1 for the first): sets what noAnswer allows (LADDER_RULE). */
  hintNumber: number;
  /** Hints already shown in this run, oldest first. When present, moreSpecificThanPrevious is graded too. */
  previousHints?: readonly string[];
};

export function criteriaFor(input: Pick<GraderInput, "previousHints">): Criterion[] {
  return input.previousHints?.length ? [...BASE_CRITERIA, "moreSpecificThanPrevious"] : [...BASE_CRITERIA];
}

export function graderPrompt(input: GraderInput): string {
  const keys = criteriaFor(input);
  const previous = input.previousHints?.length
    ? ["", "<previous_hints>", ...input.previousHints.map((h, i) => `${i + 1}. ${h}`), "</previous_hints>"]
    : [];
  return [
    "You grade hints in Merge Crew, a browser game that teaches git. Tidy, a calm and kind robot, gives the player a hint when they are stuck.",
    "",
    "<level_context>",
    input.context,
    "</level_context>",
    "",
    `<current_goal>${input.goal}</current_goal>`,
    "",
    "<player_situation>",
    input.situation,
    "</player_situation>",
    "",
    `<a_good_hint_points_toward>${input.expect}</a_good_hint_points_toward>`,
    ...previous,
    "",
    `<hint number="${input.hintNumber}">${input.hint}</hint>`,
    "",
    LADDER_RULE,
    "",
    "Judge the hint on each criterion, pass or fail:",
    ...keys.map((k) => `- ${k}: ${k === "noAnswer" ? noAnswerRule(input.hintNumber) : CRITERIA[k]}`),
    "",
    `Answer with JSON only, no other text: {${keys.map((k) => `"${k}": true|false`).join(", ")}, "notes": "one sentence"}`,
  ].join("\n");
}

/** Parse the grader's JSON answer for `keys`. Anything unreadable fails every criterion, so it shows up. */
export function parseGrade(text: string, keys: readonly Criterion[] = BASE_CRITERIA): Grade {
  const match = text.match(/\{[\s\S]*\}/);
  let data: Record<string, unknown> = {};
  try {
    data = match ? (JSON.parse(match[0]) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }
  const pass = Object.fromEntries(keys.map((k) => [k, data[k] === true])) as Partial<Record<Criterion, boolean>>;
  const notes = typeof data.notes === "string" ? data.notes : match ? "" : `unreadable grader answer: ${text.slice(0, 120)}`;
  return { pass, notes, overall: keys.every((k) => pass[k]) };
}

export async function grade(
  input: GraderInput,
  model: LanguageModel = GRADER_MODEL,
): Promise<Grade> {
  const { text } = await generateText({
    model,
    prompt: graderPrompt(input),
    maxOutputTokens: 2000,
    providerOptions: { openai: { reasoningEffort: "low" } },
    maxRetries: 1,
    timeout: 30_000,
  });
  return parseGrade(text, criteriaFor(input));
}
