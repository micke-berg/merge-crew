/** One level's server-side hint data. */
export type LevelHints = {
  /** The problem and the intended fix, for the model's prompt. */
  context: string;
  /** Three fallback hints, gentle to specific. The third may name a command but not its full arguments. */
  scripted: readonly [string, string, string];
};
