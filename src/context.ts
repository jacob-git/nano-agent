import { createNanoMemory, memoryToText, mergeMemory, summarizeMessages } from "./memory.js";
import { estimateTokens as defaultEstimateTokens, trimToTokens } from "./tokenizer.js";
import type { NanoAgentConfig, NanoContextInput, NanoContextPacket, NanoModelMessage } from "./types.js";

type Candidate = {
  label: string;
  priority: number;
  message: NanoModelMessage;
};

export function buildNanoContext(input: NanoContextInput, config: Pick<NanoAgentConfig, "budget" | "memory" | "maxRecentMessages" | "estimateTokens">): NanoContextPacket {
  validateInput(input);
  validateBudget(config.budget.maxInputTokens);

  const estimate = config.estimateTokens ?? defaultEstimateTokens;
  const memory = mergeMemory(createNanoMemory(config.memory), input.memory);
  const recent = summarizeMessages(input.messages, config.maxRecentMessages ?? 6);
  const instructions = normalizeInstructions(input.instructions);
  const contextEntries = flattenContext(input.context);

  const candidates: Candidate[] = [
    {
      label: "goal",
      priority: 100,
      message: {
        role: "system" as const,
        content: `Goal:\n${input.goal}`,
      },
    },
    ...instructions.map((instruction, index) => ({
      label: `instruction:${index + 1}`,
      priority: 90,
      message: {
        role: "system" as const,
        content: `Instruction:\n${instruction}`,
      },
    })),
    {
      label: "memory",
      priority: 80,
      message: {
        role: "system" as const,
        content: memoryToText(memory),
      },
    },
    ...recent.recent.map((message, index) => ({
      label: `recent-message:${index + 1}`,
      priority: 70,
      message,
    })),
    ...contextEntries.map((entry, index) => ({
      label: `context:${entry.key}`,
      priority: 60 - index,
      message: {
        role: "user" as const,
        content: `Context: ${entry.key}\n${entry.value}`,
      },
    })),
  ].filter((candidate) => candidate.message.content.trim().length > 0);

  const originalTokens = candidates.reduce((sum, candidate) => sum + estimate(candidate.message.content), 0);
  const budget = Math.max(1, config.budget.maxInputTokens - (config.budget.reserveOutputTokens ?? 0));
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);
  const messages: NanoModelMessage[] = [];
  const kept: string[] = [];
  const dropped: string[] = [...recent.dropped];
  let inputTokens = 0;

  for (const candidate of sorted) {
    const candidateTokens = estimate(candidate.message.content);
    if (inputTokens + candidateTokens <= budget) {
      messages.push(candidate.message);
      kept.push(candidate.label);
      inputTokens += candidateTokens;
      continue;
    }

    const remaining = budget - inputTokens;
    if (candidate.priority >= 80 && remaining > 24) {
      const trimmed = trimToTokens(candidate.message.content, remaining, estimate);
      if (trimmed) {
        messages.push({ ...candidate.message, content: trimmed });
        kept.push(`${candidate.label}:trimmed`);
        inputTokens += estimate(trimmed);
      } else {
        dropped.push(candidate.label);
      }
    } else {
      dropped.push(candidate.label);
    }
  }

  return {
    goal: input.goal,
    messages,
    inputTokens,
    originalTokens,
    savedTokens: Math.max(0, originalTokens - inputTokens),
    savedRatio: originalTokens === 0 ? 0 : Math.max(0, (originalTokens - inputTokens) / originalTokens),
    kept,
    dropped,
    memory,
  };
}

function validateInput(input: NanoContextInput): void {
  if (!input || typeof input !== "object") throw new TypeError("Nano context input must be an object.");
  if (typeof input.goal !== "string" || input.goal.trim().length === 0) {
    throw new TypeError("Nano context input goal must be a non-empty string.");
  }
}

function validateBudget(maxInputTokens: number): void {
  if (!Number.isFinite(maxInputTokens) || maxInputTokens <= 0) {
    throw new TypeError("maxInputTokens must be a positive number.");
  }
}

function normalizeInstructions(instructions: NanoContextInput["instructions"]): string[] {
  if (instructions === undefined) return [];
  if (typeof instructions === "string") return [instructions].filter((item) => item.trim().length > 0);
  if (!Array.isArray(instructions)) throw new TypeError("instructions must be a string or string array.");
  return instructions.map((item) => String(item).trim()).filter(Boolean);
}

function flattenContext(context: NanoContextInput["context"]): Array<{ key: string; value: string }> {
  if (context === undefined) return [];
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new TypeError("context must be an object when provided.");
  }
  return Object.entries(context)
    .map(([key, value]) => ({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    }))
    .filter((entry) => entry.value !== undefined && entry.value.length > 0)
    .sort((a, b) => a.value.length - b.value.length);
}
