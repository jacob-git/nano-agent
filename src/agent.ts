import { buildNanoContext } from "./context.js";
import { estimateTokens } from "./tokenizer.js";
import type { NanoAgentConfig, NanoRunInput, NanoRunResult, NanoValidationResult } from "./types.js";

export function createNanoAgent(config: NanoAgentConfig) {
  validateConfig(config);

  return {
    buildContext(input: NanoRunInput) {
      return buildNanoContext(input, config);
    },
    async run(input: NanoRunInput): Promise<NanoRunResult> {
      const context = buildNanoContext(input, config);
      const validator = input.validator ?? config.validator;
      const cheap = await config.models.cheap.complete({
        model: config.models.cheap.name,
        messages: context.messages,
        maxOutputTokens: config.budget.maxOutputTokens,
      });
      const cheapValidation = validator ? await validator(cheap) : { ok: true };

      if (cheapValidation.ok || !config.models.strong) {
        return toRunResult(input.goal, context, cheap, config.models.cheap.name, false, cheapValidation);
      }

      const strongModel = config.models.strong;
      const strong = await strongModel.complete({
        model: strongModel.name,
        messages: context.messages,
        maxOutputTokens: config.budget.maxOutputTokens,
      });
      const strongValidation = validator ? await validator(strong) : { ok: true };
      return toRunResult(input.goal, context, strong, strongModel.name, true, strongValidation);
    },
  };
}

function toRunResult(
  goal: string,
  context: ReturnType<typeof buildNanoContext>,
  response: Awaited<ReturnType<NanoAgentConfig["models"]["cheap"]["complete"]>>,
  modelUsed: string,
  escalated: boolean,
  validation: NanoValidationResult,
): NanoRunResult {
  const outputTokens = response.outputTokens ?? estimateTokens(response.text);
  return {
    output: response.text,
    context,
    raw: response,
    report: {
      goal,
      modelUsed,
      escalated,
      inputTokens: response.inputTokens ?? context.inputTokens,
      outputTokens,
      originalTokens: context.originalTokens,
      savedTokens: context.savedTokens,
      savedRatio: context.savedRatio,
      estimatedCostUsd: response.costUsd,
      kept: context.kept,
      dropped: context.dropped,
      validation,
    },
  };
}

function validateConfig(config: NanoAgentConfig): void {
  if (!config || typeof config !== "object") throw new TypeError("Nano agent config must be an object.");
  if (!config.models?.cheap) throw new TypeError("Nano agent requires a cheap model adapter.");
  if (!config.budget || !Number.isFinite(config.budget.maxInputTokens) || config.budget.maxInputTokens <= 0) {
    throw new TypeError("Nano agent requires budget.maxInputTokens.");
  }
}
