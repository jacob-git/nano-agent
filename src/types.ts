export type NanoModelMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
};

export type NanoContextInput = {
  goal: string;
  instructions?: string | string[];
  context?: Record<string, unknown>;
  memory?: NanoMemorySnapshot;
  messages?: NanoModelMessage[];
};

export type NanoMemorySnapshot = {
  facts: string[];
  preferences: string[];
  constraints: string[];
  unresolvedTasks: string[];
};

export type NanoMemoryInput = Partial<NanoMemorySnapshot>;

export type TokenBudget = {
  maxInputTokens: number;
  maxOutputTokens?: number;
  reserveOutputTokens?: number;
};

export type NanoModelRequest = {
  model: string;
  messages: NanoModelMessage[];
  maxOutputTokens?: number;
};

export type NanoModelResponse = {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  metadata?: Record<string, unknown>;
};

export type NanoModelAdapter = {
  name: string;
  complete(request: NanoModelRequest): Promise<NanoModelResponse>;
};

export type NanoValidationResult = {
  ok: boolean;
  reason?: string;
};

export type NanoValidator = (response: NanoModelResponse) => NanoValidationResult | Promise<NanoValidationResult>;

export type NanoAgentConfig = {
  budget: TokenBudget;
  models: {
    cheap: NanoModelAdapter;
    strong?: NanoModelAdapter;
  };
  memory?: NanoMemoryInput;
  maxRecentMessages?: number;
  estimateTokens?: (text: string) => number;
  validator?: NanoValidator;
};

export type NanoContextPacket = {
  goal: string;
  messages: NanoModelMessage[];
  inputTokens: number;
  originalTokens: number;
  savedTokens: number;
  savedRatio: number;
  kept: string[];
  dropped: string[];
  memory: NanoMemorySnapshot;
};

export type NanoRunInput = NanoContextInput & {
  validator?: NanoValidator;
};

export type NanoRunReport = {
  goal: string;
  modelUsed: string;
  escalated: boolean;
  inputTokens: number;
  outputTokens?: number;
  originalTokens: number;
  savedTokens: number;
  savedRatio: number;
  estimatedCostUsd?: number;
  kept: string[];
  dropped: string[];
  validation?: NanoValidationResult;
};

export type NanoRunResult = {
  output: string;
  context: NanoContextPacket;
  report: NanoRunReport;
  raw: NanoModelResponse;
};
