import OpenAI from "openai";
import { createNanoAgent, createOpenAICompatibleChatModel } from "@pallattu/nano-agent";

const client = new OpenAI({
  apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
  baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL,
});

const agent = createNanoAgent({
  budget: {
    maxInputTokens: 1000,
    maxOutputTokens: 300,
  },
  models: {
    cheap: createOpenAICompatibleChatModel(client, {
      model: process.env.NANO_AGENT_MODEL ?? "gpt-4.1-mini",
    }),
  },
});

const result = await agent.run({
  goal: "Summarize the current customer issue.",
  context: {
    ticket: "Customer cannot reset password after changing email.",
    history: "Old account notes. ".repeat(120),
  },
});

console.log(result.output);
console.log(result.report);
