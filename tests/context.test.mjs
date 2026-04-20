import assert from "node:assert/strict";
import test from "node:test";
import { buildNanoContext, createNanoMemory, estimateTokens } from "../dist/index.js";

test("buildNanoContext keeps goal and drops low-priority bloated context under budget", () => {
  const largePolicy = Array.from({ length: 100 }, (_, index) => `Long policy example ${index}`).join("\n");
  const context = buildNanoContext({
    goal: "Answer refund question.",
    instructions: "Be concise.",
    context: {
      largePolicy,
      latestMessage: "Customer was charged twice.",
    },
    memory: {
      constraints: ["Refunds over $100 need approval."],
    },
  }, {
    budget: { maxInputTokens: 120 },
    memory: createNanoMemory(),
    maxRecentMessages: 2,
  });

  assert.equal(context.inputTokens <= 120, true);
  assert.equal(context.kept.some((item) => item.startsWith("goal")), true);
  assert.equal(context.savedTokens > 0, true);
  assert.equal(context.dropped.some((item) => item.includes("largePolicy")), true);
});

test("estimateTokens returns stable positive estimates for text", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("hello") > 0, true);
  assert.equal(estimateTokens("hello ".repeat(100)) > estimateTokens("hello"), true);
});
