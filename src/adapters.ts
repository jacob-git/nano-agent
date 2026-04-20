import { estimateTokens } from "./tokenizer.js";
import { estimateModelCostUsd, getModelPricing, type NanoModelPricing } from "./pricing.js";
import type { NanoModelAdapter, NanoModelMessage, NanoModelResponse } from "./types.js";

export type MockModelOptions = {
  name?: string;
  response?: string | ((messages: NanoModelMessage[]) => string);
  pricing?: Partial<NanoModelPricing>;
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
      const costUsd = estimateCost(inputTokens, outputTokens, name, options);
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
  pricing?: Partial<NanoModelPricing>;
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
      const costUsd = estimateCost(inputTokens, outputTokens, options.model, options);

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

export type OpenAICompatibleChatClient = {
  chat: {
    completions: {
      create(input: {
        model: string;
        messages: Array<{
          role: "system" | "user" | "assistant" | "tool";
          content: string;
          name?: string;
        }>;
        max_tokens?: number;
        temperature?: number;
        metadata?: Record<string, unknown>;
      }): Promise<{
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
        [key: string]: unknown;
      }>;
    };
  };
};

export type OpenAICompatibleModelOptions = {
  model: string;
  temperature?: number;
  metadata?: Record<string, unknown>;
  pricing?: Partial<NanoModelPricing>;
};

export function createOpenAICompatibleChatModel(
  client: OpenAICompatibleChatClient,
  options: OpenAICompatibleModelOptions,
): NanoModelAdapter {
  if (!client?.chat?.completions?.create) {
    throw new TypeError("createOpenAICompatibleChatModel requires a client with chat.completions.create().");
  }
  if (!options?.model) {
    throw new TypeError("createOpenAICompatibleChatModel requires options.model.");
  }

  return {
    name: options.model,
    async complete(request): Promise<NanoModelResponse> {
      const response = await client.chat.completions.create({
        model: options.model,
        messages: request.messages,
        ...(request.maxOutputTokens === undefined ? {} : { max_tokens: request.maxOutputTokens }),
        ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
        ...(options.metadata === undefined ? {} : { metadata: options.metadata }),
      });
      const text = response.choices?.[0]?.message?.content ?? "";
      const inputTokens = response.usage?.prompt_tokens
        ?? estimateTokens(request.messages.map((message) => `${message.role}: ${message.content}`).join("\n"));
      const outputTokens = response.usage?.completion_tokens ?? estimateTokens(text);

      return {
        text,
        inputTokens,
        outputTokens,
        costUsd: estimateCost(inputTokens, outputTokens, options.model, options),
        metadata: {
          provider: "openai-compatible",
          model: options.model,
          raw: response,
        },
      };
    },
  };
}

export type AnthropicMessagesClient = {
  messages: {
    create(input: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Array<{
        role: "user" | "assistant";
        content: string;
      }>;
      metadata?: Record<string, unknown>;
    }): Promise<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
      [key: string]: unknown;
    }>;
  };
};

export type AnthropicModelOptions = {
  model: string;
  maxOutputTokens?: number;
  metadata?: Record<string, unknown>;
  pricing?: Partial<NanoModelPricing>;
};

export function createAnthropicMessagesModel(
  client: AnthropicMessagesClient,
  options: AnthropicModelOptions,
): NanoModelAdapter {
  if (!client?.messages?.create) {
    throw new TypeError("createAnthropicMessagesModel requires an Anthropic client with messages.create().");
  }
  if (!options?.model) {
    throw new TypeError("createAnthropicMessagesModel requires options.model.");
  }

  return {
    name: options.model,
    async complete(request): Promise<NanoModelResponse> {
      const anthropicMessages = toAnthropicInput(request.messages);
      const response = await client.messages.create({
        model: options.model,
        max_tokens: request.maxOutputTokens ?? options.maxOutputTokens ?? 512,
        ...(anthropicMessages.system === "" ? {} : { system: anthropicMessages.system }),
        messages: anthropicMessages.messages,
        ...(options.metadata === undefined ? {} : { metadata: options.metadata }),
      });
      const text = response.content
        ?.filter((item) => item.type === undefined || item.type === "text")
        .map((item) => item.text ?? "")
        .join("")
        ?? "";
      const inputTokens = response.usage?.input_tokens
        ?? estimateTokens(request.messages.map((message) => `${message.role}: ${message.content}`).join("\n"));
      const outputTokens = response.usage?.output_tokens ?? estimateTokens(text);

      return {
        text,
        inputTokens,
        outputTokens,
        costUsd: estimateCost(inputTokens, outputTokens, options.model, options),
        metadata: {
          provider: "anthropic",
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

function toAnthropicInput(messages: NanoModelMessage[]): {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const system: string[] = [];
  const output: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const message of messages) {
    if (message.role === "system") {
      system.push(message.content);
      continue;
    }
    if (message.role === "assistant") {
      output.push({ role: "assistant", content: message.content });
      continue;
    }
    output.push({
      role: "user",
      content: message.role === "tool" && message.name
        ? `Tool result (${message.name}):\n${message.content}`
        : message.content,
    });
  }

  return {
    system: system.join("\n\n"),
    messages: output.length > 0 ? output : [{ role: "user", content: "Continue." }],
  };
}

function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  options: {
    pricing?: Partial<NanoModelPricing>;
    costPer1kInputTokensUsd?: number;
    costPer1kOutputTokensUsd?: number;
  },
): number {
  const pricing = options.pricing
    ?? (options.costPer1kInputTokensUsd !== undefined || options.costPer1kOutputTokensUsd !== undefined
      ? {
          inputPer1kTokensUsd: options.costPer1kInputTokensUsd,
          outputPer1kTokensUsd: options.costPer1kOutputTokensUsd,
        }
      : getModelPricing(model));
  return estimateModelCostUsd(inputTokens, outputTokens, pricing);
}
