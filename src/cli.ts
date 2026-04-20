#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { stdin, exit } from "node:process";
import { buildNanoContext } from "./context.js";
import { estimateTokens } from "./tokenizer.js";
import type { NanoAgentConfig, NanoContextInput, NanoMemoryInput } from "./types.js";

type CliOptions = {
  command: "demo" | "budget" | "help";
  input?: string;
  output?: "table" | "json" | "messages";
  maxInputTokens?: number;
  reserveOutputTokens?: number;
  maxRecentMessages?: number;
  failOnOverBudget?: boolean;
};

type BudgetFile = NanoContextInput & {
  budget?: {
    maxInputTokens?: number;
    reserveOutputTokens?: number;
  };
  maxRecentMessages?: number;
  globalMemory?: NanoMemoryInput;
};

const options = parseArgs(process.argv.slice(2));

try {
  if (options.command === "help") {
    printHelp();
  } else if (options.command === "budget") {
    await runBudget(options);
  } else {
    await runDemo();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  exit(1);
}

async function runBudget(options: CliOptions): Promise<void> {
  const input = await readBudgetInput(options.input);
  const maxInputTokens = options.maxInputTokens ?? input.budget?.maxInputTokens ?? 1200;
  const reserveOutputTokens = options.reserveOutputTokens ?? input.budget?.reserveOutputTokens;
  const maxRecentMessages = options.maxRecentMessages ?? input.maxRecentMessages ?? 6;
  const packet = buildNanoContext(input, {
    budget: {
      maxInputTokens,
      ...(reserveOutputTokens === undefined ? {} : { reserveOutputTokens }),
    },
    memory: input.globalMemory,
    maxRecentMessages,
  } satisfies Pick<NanoAgentConfig, "budget" | "memory" | "maxRecentMessages">);

  if (options.output === "json") {
    console.log(JSON.stringify(packet, null, 2));
  } else if (options.output === "messages") {
    console.log(JSON.stringify(packet.messages, null, 2));
  } else {
    printBudgetTable(packet, maxInputTokens);
  }

  if (options.failOnOverBudget && packet.inputTokens > maxInputTokens) {
    exit(2);
  }
}

async function runDemo(): Promise<void> {
  const repeatedPolicy = Array.from({ length: 30 }, (_, index) => (
    `Policy example ${index + 1}: Refund requests must include customer id, order id, amount, reason, prior refund history, and approval status.`
  )).join("\n");

  await runBudget({
    command: "budget",
    output: "table",
    maxInputTokens: 1200,
    input: JSON.stringify({
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
      memory: {
        constraints: ["Refunds over $100 require approval.", "Never promise a refund before eligibility is checked."],
        preferences: ["Use concise customer-facing language."],
      },
      messages: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello, how can I help?" },
        { role: "user", content: "I need help with billing." },
        { role: "assistant", content: "Please share the order id." },
        { role: "user", content: "Order ORD-123 was charged twice." },
      ],
    }),
  });
}

async function readBudgetInput(input?: string): Promise<BudgetFile> {
  if (!input || input === "-") {
    return parseBudgetJson(await readStdin());
  }
  if (input.trim().startsWith("{")) {
    return parseBudgetJson(input);
  }
  return parseBudgetJson(await readFile(input, "utf8"));
}

function parseBudgetJson(raw: string): BudgetFile {
  if (!raw.trim()) {
    throw new TypeError("No input provided. Pass --input file.json or pipe JSON to stdin.");
  }
  const parsed = JSON.parse(raw) as BudgetFile;
  if (!parsed.goal) {
    throw new TypeError("Budget input JSON must include a goal.");
  }
  return parsed;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function printBudgetTable(packet: ReturnType<typeof buildNanoContext>, maxInputTokens: number): void {
  const savedPercent = (packet.savedRatio * 100).toFixed(1);
  console.log(`Nano Agent Budget

Goal: ${packet.goal}

Budget:        ${maxInputTokens.toLocaleString()} tokens
Naive context: ${packet.originalTokens.toLocaleString()} tokens
Nano context:  ${packet.inputTokens.toLocaleString()} tokens
Saved:         ${packet.savedTokens.toLocaleString()} tokens (${savedPercent}%)

Kept:
${packet.kept.map((item) => `- ${item}`).join("\n") || "- nothing"}

Dropped:
${packet.dropped.map((item) => `- ${item}`).join("\n") || "- nothing"}

Messages:
${packet.messages.map((message) => `- ${message.role}: ${estimateTokens(message.content).toLocaleString()} tokens`).join("\n")}
`);
}

function parseArgs(args: string[]): CliOptions {
  if (args.includes("--help") || args.includes("-h")) return { command: "help" };
  const command = args[0] === "budget" ? "budget" : args[0] === "demo" || args.length === 0 ? "demo" : "help";
  const options: CliOptions = { command };

  for (let index = command === "budget" || command === "demo" ? 1 : 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--input" || arg === "-i") {
      options.input = requireValue(arg, next);
      index += 1;
    } else if (arg === "--format" || arg === "--output") {
      const value = requireValue(arg, next);
      if (value !== "table" && value !== "json" && value !== "messages") {
        throw new TypeError("--format must be table, json, or messages.");
      }
      options.output = value;
      index += 1;
    } else if (arg === "--max-input-tokens" || arg === "--budget") {
      options.maxInputTokens = parsePositiveInteger(arg, requireValue(arg, next));
      index += 1;
    } else if (arg === "--reserve-output-tokens") {
      options.reserveOutputTokens = parsePositiveInteger(arg, requireValue(arg, next));
      index += 1;
    } else if (arg === "--max-recent-messages") {
      options.maxRecentMessages = parsePositiveInteger(arg, requireValue(arg, next));
      index += 1;
    } else if (arg === "--fail-on-over-budget") {
      options.failOnOverBudget = true;
    } else {
      throw new TypeError(`Unknown option: ${arg}`);
    }
  }

  options.output ??= "table";
  return options;
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    throw new TypeError(`${flag} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(flag: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function printHelp(): void {
  console.log(`Nano Agent

Usage:
  nano-agent demo
  nano-agent budget --input prompt.json --max-input-tokens 1200
  cat prompt.json | nano-agent budget --input - --format json

Commands:
  demo                         Show a local token-budget demo.
  budget                       Build compact context without calling a model.

Options:
  -i, --input <file|json|->     JSON input file, inline JSON, or stdin.
  --max-input-tokens <number>   Hard input token budget.
  --reserve-output-tokens <n>   Reserve part of the input budget.
  --max-recent-messages <n>     Recent chat messages to consider.
  --format <table|json|messages>
  --fail-on-over-budget         Exit 2 if compacted context exceeds budget.
`);
}
