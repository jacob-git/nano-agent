import assert from "node:assert/strict";
import test from "node:test";
import { createOpenAIResponsesModel } from "../dist/index.js";

test("createOpenAIResponsesModel calls responses.create and maps output text", async () => {
  const calls = [];
  const model = createOpenAIResponsesModel({
    responses: {
      async create(input) {
        calls.push(input);
        return {
          output_text: "hello from openai",
          usage: {
            input_tokens: 12,
            output_tokens: 4,
          },
        };
      },
    },
  }, {
    model: "gpt-test-mini",
    costPer1kInputTokensUsd: 0.1,
    costPer1kOutputTokensUsd: 0.2,
  });

  const response = await model.complete({
    model: "ignored",
    maxOutputTokens: 100,
    messages: [
      { role: "system", content: "Be concise." },
      { role: "user", content: "Say hello." },
    ],
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "gpt-test-mini");
  assert.equal(calls[0].max_output_tokens, 100);
  assert.deepEqual(calls[0].input, [
    { role: "system", content: "Be concise." },
    { role: "user", content: "Say hello." },
  ]);
  assert.equal(response.text, "hello from openai");
  assert.equal(response.inputTokens, 12);
  assert.equal(response.outputTokens, 4);
  assert.equal(response.costUsd, 0.002);
  assert.equal(response.metadata.provider, "openai");
});

test("createOpenAIResponsesModel maps tool messages to user-visible tool results", async () => {
  const calls = [];
  const model = createOpenAIResponsesModel({
    responses: {
      async create(input) {
        calls.push(input);
        return { output_text: "ok" };
      },
    },
  }, {
    model: "gpt-test-mini",
  });

  await model.complete({
    model: "ignored",
    messages: [
      { role: "tool", name: "lookupOrder", content: "Order is duplicated." },
    ],
  });

  assert.deepEqual(calls[0].input, [
    { role: "user", content: "Tool result (lookupOrder):\nOrder is duplicated." },
  ]);
});
