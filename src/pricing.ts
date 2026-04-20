export type NanoModelPricing = {
  inputPer1kTokensUsd: number;
  outputPer1kTokensUsd: number;
};

export const NANO_AGENT_PRICING: Record<string, NanoModelPricing> = {
  "gpt-4.1": { inputPer1kTokensUsd: 0.002, outputPer1kTokensUsd: 0.008 },
  "gpt-4.1-mini": { inputPer1kTokensUsd: 0.0004, outputPer1kTokensUsd: 0.0016 },
  "gpt-4.1-nano": { inputPer1kTokensUsd: 0.0001, outputPer1kTokensUsd: 0.0004 },
  "gpt-5-mini": { inputPer1kTokensUsd: 0.00025, outputPer1kTokensUsd: 0.002 },
  "claude-3-5-haiku": { inputPer1kTokensUsd: 0.0008, outputPer1kTokensUsd: 0.004 },
  "claude-3-5-sonnet": { inputPer1kTokensUsd: 0.003, outputPer1kTokensUsd: 0.015 },
};

export function getModelPricing(model: string): NanoModelPricing | undefined {
  const normalized = model.toLowerCase();
  return Object.entries(NANO_AGENT_PRICING)
    .sort(([left], [right]) => right.length - left.length)
    .find(([key]) => normalized.includes(key))?.[1];
}

export function estimateModelCostUsd(
  inputTokens: number,
  outputTokens: number,
  pricing?: Partial<NanoModelPricing>,
): number {
  return ((inputTokens / 1000) * (pricing?.inputPer1kTokensUsd ?? 0))
    + ((outputTokens / 1000) * (pricing?.outputPer1kTokensUsd ?? 0));
}
