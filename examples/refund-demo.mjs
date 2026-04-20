import { createMockModel, createNanoAgent } from "../dist/index.js";

const bloatedPolicy = Array.from({ length: 40 }, (_, index) => (
  `Policy example ${index + 1}: Refund handling must consider order status, duplicate charges, fraud risk, customer tier, refund amount, payment processor, and approval thresholds.`
)).join("\n");

const agent = createNanoAgent({
  budget: {
    maxInputTokens: 900,
    maxOutputTokens: 250,
  },
  models: {
    cheap: createMockModel({
      name: "nano-mini",
      response: "I found a duplicate $42 charge for order ORD-123. I can draft a concise refund response and mark it for normal processing.",
      costPer1kInputTokensUsd: 0.00015,
      costPer1kOutputTokensUsd: 0.0006,
    }),
  },
  memory: {
    facts: ["Customer reported a duplicate charge.", "Order ORD-123 has a $42 duplicate payment."],
    constraints: ["Refunds over $100 require manager approval.", "Do not mention internal policy names to customers."],
    preferences: ["Use plain, direct customer-facing language."],
  },
  maxRecentMessages: 4,
});

const result = await agent.run({
  goal: "Draft a customer support response for a duplicate-charge refund request.",
  instructions: [
    "Answer as a support agent.",
    "Keep the response under 120 words.",
  ],
  context: {
    policy: bloatedPolicy,
    customer: {
      name: "Sarah",
      tier: "standard",
    },
    order: {
      id: "ORD-123",
      duplicateCharge: true,
      duplicateAmountUsd: 42,
    },
  },
  messages: [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi, how can I help?" },
    { role: "user", content: "I was charged twice." },
    { role: "assistant", content: "Can you send the order id?" },
    { role: "user", content: "It is ORD-123." },
  ],
});

console.log(JSON.stringify({
  output: result.output,
  report: {
    modelUsed: result.report.modelUsed,
    inputTokens: result.report.inputTokens,
    originalTokens: result.report.originalTokens,
    savedTokens: result.report.savedTokens,
    savedPercent: Number((result.report.savedRatio * 100).toFixed(1)),
    estimatedCostUsd: result.report.estimatedCostUsd,
    kept: result.report.kept,
    dropped: result.report.dropped,
  },
}, null, 2));
