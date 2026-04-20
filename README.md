# Nano Agent

[![CI](https://github.com/jacob-git/nano-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/jacob-git/nano-agent/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@pallattu/nano-agent.svg)](https://www.npmjs.com/package/@pallattu/nano-agent)
[![license](https://img.shields.io/npm/l/@pallattu/nano-agent.svg)](./LICENSE)

Tiny AI agents with strict token, memory, and cost budgets.

Nano Agent helps you build useful AI workflows without sending huge prompts, full chat history, or expensive model calls by default.

```text
Naive context: 14,782 tokens
Nano context:   1,204 tokens
Saved:          91.9%
Model:          cheap first
```

## Why

Most AI apps waste tokens by sending too much context:

- full chat history
- repeated instructions
- bloated policy text
- irrelevant retrieved context
- expensive models for simple tasks
- memory that is unrelated to the current goal

Nano Agent starts from one rule:

> No model call should exceed the budget unless you explicitly allow escalation.

## What Makes It Nano

Nano Agent optimizes for restraint instead of maximum autonomy:

- hard input-token budget
- compact working memory
- recent-message window instead of full history
- smallest useful context packet
- cheap model first
- optional validation-based escalation
- run reports that show kept, dropped, and saved context

## Install

```sh
npm install @pallattu/nano-agent
```

## Quick Start

```ts
import { createNanoAgent } from "@pallattu/nano-agent";

const agent = createNanoAgent({
  budget: {
    maxInputTokens: 1200,
    maxOutputTokens: 400,
  },
  models: {
    cheap: {
      name: "mini",
      async complete(request) {
        return {
          text: "response",
          inputTokens: request.messages.length,
        };
      },
    },
  },
  memory: {
    constraints: ["Refunds over $100 require approval."],
    preferences: ["Use concise customer-facing language."],
  },
});

const result = await agent.run({
  goal: "Draft a customer refund response.",
  context: {
    policy,
    customerMessage,
    order,
  },
  messages,
});

console.log(result.output);
console.log(result.report);
```

## Demo

```sh
npm run demo
```

Example output:

```json
{
  "report": {
    "modelUsed": "nano-mini",
    "inputTokens": 505,
    "originalTokens": 846,
    "savedTokens": 341,
    "savedPercent": 40.3
  }
}
```

## Core Concepts

### Token Budget

Set `maxInputTokens`. Nano Agent builds a compact context packet and drops low-priority context before the model call.

### Working Memory

Memory is intentionally small:

- facts
- preferences
- constraints
- unresolved tasks

No vector database is required for v0.1.

### Cheap-First Execution

Use a cheap model first. Add a validator and strong model only when you want escalation.

```ts
const agent = createNanoAgent({
  budget: { maxInputTokens: 1200 },
  models: {
    cheap: miniModel,
    strong: frontierModel,
  },
  validator: (response) => ({
    ok: response.text.includes("required field"),
  }),
});
```

### Run Report

Every run returns:

- model used
- input tokens
- output tokens
- original context tokens
- saved tokens
- estimated cost
- context kept
- context dropped
- escalation status

## API

### `createNanoAgent(config)`

Creates a budgeted agent runtime.

### `agent.buildContext(input)`

Builds the compact context packet without calling a model.

### `agent.run(input)`

Builds compact context, calls the cheap model, validates output, and optionally escalates to the strong model.

### `buildNanoContext(input, config)`

Standalone context budgeter for any LLM call.

### `createNanoMemory(input)`

Creates a small working memory snapshot.

### `createMockModel(options)`

Test/demo adapter for deterministic local examples.

## What This Is Not

Nano Agent is not a full agent framework, vector memory system, prompt engineering platform, workflow engine, or dashboard.

It is a small runtime primitive for this problem:

> Build the smallest useful context for the current task, run cheap first, and return the savings report.

## Roadmap

- OpenAI adapter
- Anthropic adapter
- provider pricing table
- JSON schema validator helper
- semantic context ranking
- cache-aware prompt layout
- GitHub Action for prompt budget regression checks
