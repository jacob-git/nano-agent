import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicMessagesModel, createNanoAgent } from "@pallattu/nano-agent";

const anthropic = new Anthropic();

const agent = createNanoAgent({
  budget: {
    maxInputTokens: 1200,
    maxOutputTokens: 300,
  },
  models: {
    cheap: createAnthropicMessagesModel(anthropic, {
      model: process.env.NANO_AGENT_MODEL ?? "claude-3-5-haiku-latest",
    }),
  },
  memory: {
    constraints: ["Refunds over $100 require manual approval."],
  },
});

const result = await agent.run({
  goal: "Draft a concise support response.",
  context: {
    ticket: "Customer reports a duplicate $42 charge on order ORD-123.",
    policy: "Duplicate charges under $100 can be acknowledged and sent to billing review.",
  },
});

console.log(result.output);
console.log(result.report);
