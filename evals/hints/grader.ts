// A rubric-based model grader for hints. Uncalibrated: its verdicts have not yet been checked
// against human labels (see labels.example.json for the format to do that with).

import { generateText, type LanguageModel } from "ai";

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
} as const;

export type Criterion = keyof typeof CRITERIA;
export type Grade = { pass: Record<Criterion, boolean>; notes: string; overall: boolean };

const KEYS = Object.keys(CRITERIA) as Criterion[];

export function graderPrompt(input: { context: string; goal: string; situation: string; expect: string; hint: string }): string {
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
    "",
    `<hint>${input.hint}</hint>`,
    "",
    "Judge the hint on each criterion, pass or fail:",
    ...KEYS.map((k) => `- ${k}: ${CRITERIA[k]}`),
    "",
    'Answer with JSON only, no other text: {"towardNextIdea": true|false, "noAnswer": true|false, "short": true|false, "voice": true|false, "notes": "one sentence"}',
  ].join("\n");
}

/** Parse the grader's JSON answer. Anything unreadable fails every criterion, so it shows up. */
export function parseGrade(text: string): Grade {
  const match = text.match(/\{[\s\S]*\}/);
  let data: Record<string, unknown> = {};
  try {
    data = match ? (JSON.parse(match[0]) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }
  const pass = Object.fromEntries(KEYS.map((k) => [k, data[k] === true])) as Record<Criterion, boolean>;
  const notes = typeof data.notes === "string" ? data.notes : match ? "" : `unreadable grader answer: ${text.slice(0, 120)}`;
  return { pass, notes, overall: KEYS.every((k) => pass[k]) };
}

export async function grade(
  input: Parameters<typeof graderPrompt>[0],
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
  return parseGrade(text);
}
