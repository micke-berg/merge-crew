// Mock models for hint tests and evals. Test-only.

import { MockLanguageModelV4 } from "ai/test";

/** A model that always answers `text`, and records the prompts it saw. */
export function replyModel(text: string, finish: "stop" | "length" = "stop") {
  return new MockLanguageModelV4({
    modelId: "mock-hint",
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: finish, raw: undefined },
      usage: {
        inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

/** A model whose call fails, like a Gateway error. */
export function failingModel(message = "gateway unavailable") {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error(message);
    },
  });
}

/** A model that never answers until the call is aborted. */
export function hangingModel() {
  return new MockLanguageModelV4({
    doGenerate: ({ abortSignal }) =>
      new Promise((_, reject) => {
        abortSignal?.addEventListener("abort", () => reject(new Error("aborted")));
      }),
  });
}
