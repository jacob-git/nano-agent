#!/usr/bin/env node
import { createNanoAgent } from "./agent.js";
import { createMockModel } from "./adapters.js";

const repeatedPolicy = Array.from({ length: 30 }, (_, index) => (
  `Policy example ${index + 1}: Refund requests must include customer id, order id, amount, reason, prior refund history, and approval status.`
)).join("\n");

const agent = createNanoAgent({
  budget: {
    maxInputTokens: 1200,
    maxOutputTokens: 300,
  },
  models: {
    cheap: createMockModel({
      name: "nano-mini",
      response: "Draft refund response created using compact context.",
      costPer1kInputTokensUsd: 0.00015,
      costPer1kOutputTokensUsd: 0.0006,
    }),
  },
  memory: {
    constraints: ["Refunds over $100 require approval.", "Never promise a refund before eligibility is checked."],
    preferences: ["Use concise customer-facing language."],
  },
});

const result = await agent.run({
  goal: "Draft a customer response for a duplicate-charge refund request.",
  instructions: [
    "Use only facts in context.",
    "Keep the reply under 120 words.",
  ],
  context: {
    refundPolicy: repeatedPolicy,
    customerMessage: "I was charged twice for order ORD-123. Please refund the duplicate $42 charge.",
    order: {
      id: "ORD-123",
      duplicateCharge: true,
      amountUsd: 42,
    },
  },
  messages: [
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello, how can I help?" },
    { role: "user", content: "I need help with billing." },
    { role: "assistant", content: "Please share the order id." },
    { role: "user", content: "Order ORD-123 was charged twice." },
  ],
});

console.log(`Nano Agent Demo

Goal: ${result.report.goal}

Naive context: ${result.report.originalTokens.toLocaleString()} tokens
Nano context:  ${result.report.inputTokens.toLocaleString()} tokens
Saved:         ${(result.report.savedRatio * 100).toFixed(1)}%

Model used:    ${result.report.modelUsed}
Escalated:     ${result.report.escalated ? "yes" : "no"}
Cost estimate: $${(result.report.estimatedCostUsd ?? 0).toFixed(6)}

Kept:
${result.report.kept.map((item) => `- ${item}`).join("\n")}

Dropped:
${result.report.dropped.map((item) => `- ${item}`).join("\n") || "- nothing"}

Output:
${result.output}
`);
