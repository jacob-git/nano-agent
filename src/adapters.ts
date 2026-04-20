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

export type OpenAIResponsesClient = {
  responses: {
    create(input: {
      model: string;
      input: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }>;
      max_output_tokens?: number;
      reasoning?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }): Promise<{
      output_text?: string;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
      };
      [key: string]: unknown;
    }>;
  };
};

export type OpenAIModelOptions = {
  model: string;
  reasoning?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  costPer1kInputTokensUsd?: number;
  costPer1kOutputTokensUsd?: number;
};

export function createOpenAIResponsesModel(
  client: OpenAIResponsesClient,
  options: OpenAIModelOptions,
): NanoModelAdapter {
  if (!client?.responses?.create) {
    throw new TypeError("createOpenAIResponsesModel requires an OpenAI client with responses.create().");
  }
  if (!options?.model) {
    throw new TypeError("createOpenAIResponsesModel requires options.model.");
  }

  return {
    name: options.model,
    async complete(request): Promise<NanoModelResponse> {
      const response = await client.responses.create({
        model: options.model,
        input: toOpenAIInput(request.messages),
        ...(request.maxOutputTokens === undefined ? {} : { max_output_tokens: request.maxOutputTokens }),
        ...(options.reasoning === undefined ? {} : { reasoning: options.reasoning }),
        ...(options.metadata === undefined ? {} : { metadata: options.metadata }),
      });

      const text = typeof response.output_text === "string" ? response.output_text : "";
      const inputTokens = response.usage?.input_tokens
        ?? estimateTokens(request.messages.map((message) => `${message.role}: ${message.content}`).join("\n"));
      const outputTokens = response.usage?.output_tokens ?? estimateTokens(text);
      const costUsd = ((inputTokens / 1000) * (options.costPer1kInputTokensUsd ?? 0))
        + ((outputTokens / 1000) * (options.costPer1kOutputTokensUsd ?? 0));

      return {
        text,
        inputTokens,
        outputTokens,
        costUsd,
        metadata: {
          provider: "openai",
          model: options.model,
          raw: response,
        },
      };
    },
  };
}

function toOpenAIInput(messages: NanoModelMessage[]): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  return messages.map((message) => ({
    role: message.role === "tool" ? "user" : message.role,
    content: message.role === "tool" && message.name
      ? `Tool result (${message.name}):\n${message.content}`
      : message.content,
  }));
}
