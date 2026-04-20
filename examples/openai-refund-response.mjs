import OpenAI from "openai";
import { createNanoAgent, createOpenAIResponsesModel } from "../dist/index.js";

const client = new OpenAI();

const agent = createNanoAgent({
  budget: {
    maxInputTokens: 1200,
    maxOutputTokens: 250,
  },
  models: {
    cheap: createOpenAIResponsesModel(client, {
      model: process.env.NANO_AGENT_MODEL ?? "gpt-5-mini",
      reasoning: { effort: "low" },
    }),
  },
  memory: {
    constraints: ["Refunds over $100 require approval.", "Never promise a refund before eligibility is checked."],
    preferences: ["Use concise customer-facing language."],
  },
});

const result = await agent.run({
  goal: "Draft a customer response for a duplicate-charge refund request.",
  instructions: ["Keep the response under 120 words.", "Use only the supplied facts."],
  context: {
    refundPolicy: "Duplicate charges under $100 may be processed after order verification. Refunds over $100 require approval.",
    customerMessage: "I was charged twice for order ORD-123. Please refund the duplicate $42 charge.",
    order: {
      id: "ORD-123",
      duplicateCharge: true,
      amountUsd: 42,
    },
  },
});

console.log(result.output);
console.log(JSON.stringify(result.report, null, 2));
