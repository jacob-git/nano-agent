import { estimateTokens } from "./tokenizer.js";
import type { NanoModelAdapter, NanoModelMessage, NanoModelResponse } from "./types.js";

export type MockModelOptions = {
  name?: string;
  response?: string | ((messages: NanoModelMessage[]) => string);
  costPer1kInputTokensUsd?: number;
  costPer1kOutputTokensUsd?: number;
};

export function createMockModel(options: MockModelOptions = {}): NanoModelAdapter {
  const name = options.name ?? "mock-mini";
  return {
    name,
    async complete(request): Promise<NanoModelResponse> {
      const inputText = request.messages.map((message) => `${message.role}: ${message.content}`).join("\n");
      const text = typeof options.response === "function"
        ? options.response(request.messages)
        : options.response ?? `Completed with ${request.messages.length} compact message${request.messages.length === 1 ? "" : "s"}.`;
      const inputTokens = estimateTokens(inputText);
      const outputTokens = estimateTokens(text);
      const costUsd = ((inputTokens / 1000) * (options.costPer1kInputTokensUsd ?? 0))
        + ((outputTokens / 1000) * (options.costPer1kOutputTokensUsd ?? 0));
      return {
        text,
        inputTokens,
        outputTokens,
        costUsd,
      };
    },
  };
}
