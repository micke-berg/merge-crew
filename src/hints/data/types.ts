/** One level's server-side hint data. */
export type LevelHints = {
  /** The problem and the intended fix, for the model's prompt. */
  context: string;
  /**
   * Three fallback hints, gentle to specific, held to the same rules as model hints: the first two name
   * no git command, the third may name one but not the solution's arguments.
   */
  scripted: readonly [string, string, string];
};
