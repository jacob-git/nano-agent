import assert from "node:assert/strict";
import test from "node:test";
import { createMockModel, createNanoAgent } from "../dist/index.js";

test("nano agent runs cheap model and returns token savings report", async () => {
  const agent = createNanoAgent({
    budget: { maxInputTokens: 200 },
    models: {
      cheap: createMockModel({
        name: "cheap",
        response: "done",
      }),
    },
  });

  const result = await agent.run({
    goal: "Summarize latest customer issue.",
    context: {
      huge: "irrelevant ".repeat(500),
      latest: "Customer needs refund help.",
    },
  });

  assert.equal(result.output, "done");
  assert.equal(result.report.modelUsed, "cheap");
  assert.equal(result.report.escalated, false);
  assert.equal(result.report.inputTokens <= 200, true);
  assert.equal(result.report.savedTokens > 0, true);
});

test("nano agent escalates to strong model when validation fails", async () => {
  const agent = createNanoAgent({
    budget: { maxInputTokens: 300 },
    models: {
      cheap: createMockModel({ name: "cheap", response: "bad" }),
      strong: createMockModel({ name: "strong", response: "valid answer" }),
    },
    validator: (response) => ({
      ok: response.text.includes("valid"),
      reason: "Output must include valid.",
    }),
  });

  const result = await agent.run({
    goal: "Produce validated answer.",
    context: {
      item: "important",
    },
  });

  assert.equal(result.output, "valid answer");
  assert.equal(result.report.modelUsed, "strong");
  assert.equal(result.report.escalated, true);
  assert.equal(result.report.validation?.ok, true);
});
