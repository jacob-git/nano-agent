import assert from "node:assert/strict";
import test from "node:test";
import { createAnthropicMessagesModel, createOpenAICompatibleChatModel, getModelPricing } from "../dist/index.js";

test("createOpenAICompatibleChatModel calls chat completions and maps usage", async () => {
  const calls = [];
  const model = createOpenAICompatibleChatModel({
    chat: {
      completions: {
        async create(input) {
          calls.push(input);
          return {
            choices: [{ message: { content: "chat answer" } }],
            usage: {
              prompt_tokens: 20,
              completion_tokens: 5,
            },
          };
        },
      },
    },
  }, {
    model: "gpt-4.1-mini",
  });

  const response = await model.complete({
    model: "ignored",
    maxOutputTokens: 100,
    messages: [
      { role: "system", content: "Be concise." },
      { role: "user", content: "Answer." },
    ],
  });

  assert.equal(calls[0].model, "gpt-4.1-mini");
  assert.equal(calls[0].max_tokens, 100);
  assert.equal(response.text, "chat answer");
  assert.equal(response.inputTokens, 20);
  assert.equal(response.outputTokens, 5);
  assert.equal(response.metadata.provider, "openai-compatible");
});

test("createAnthropicMessagesModel separates system messages and maps text content", async () => {
  const calls = [];
  const model = createAnthropicMessagesModel({
    messages: {
      async create(input) {
        calls.push(input);
        return {
          content: [{ type: "text", text: "anthropic answer" }],
          usage: {
            input_tokens: 30,
            output_tokens: 6,
          },
        };
      },
    },
  }, {
    model: "claude-3-5-haiku",
  });

  const response = await model.complete({
    model: "ignored",
    maxOutputTokens: 80,
    messages: [
      { role: "system", content: "Use policy." },
      { role: "tool", name: "lookup", content: "Order found." },
      { role: "user", content: "Answer customer." },
    ],
  });

  assert.equal(calls[0].model, "claude-3-5-haiku");
  assert.equal(calls[0].max_tokens, 80);
  assert.equal(calls[0].system, "Use policy.");
  assert.deepEqual(calls[0].messages, [
    { role: "user", content: "Tool result (lookup):\nOrder found." },
    { role: "user", content: "Answer customer." },
  ]);
  assert.equal(response.text, "anthropic answer");
  assert.equal(response.inputTokens, 30);
  assert.equal(response.outputTokens, 6);
  assert.equal(response.metadata.provider, "anthropic");
});

test("getModelPricing resolves known pricing by model substring", () => {
  assert.equal(getModelPricing("openai/gpt-4.1-mini")?.inputPer1kTokensUsd, 0.0004);
});
