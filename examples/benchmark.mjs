import { buildNanoContext } from "../dist/index.js";

const cases = [
  {
    name: "refund reply",
    budget: 900,
    input: {
      goal: "Draft a concise customer refund reply.",
      instructions: ["Use only provided facts.", "Keep the answer under 120 words."],
      memory: {
        constraints: ["Refunds over $100 require approval.", "Duplicate charges under $100 can be processed normally."],
        preferences: ["Use plain customer-facing language."],
      },
      messages: makeMessages(16, "billing conversation"),
      context: {
        policy: repeat("Refund policy example with duplicate-charge handling, manager approval thresholds, processor notes, and customer messaging guidance.", 55),
        customer: "Sarah reports order ORD-123 was charged twice.",
        order: { id: "ORD-123", duplicateCharge: true, duplicateAmountUsd: 42 },
      },
    },
  },
  {
    name: "support triage",
    budget: 1000,
    input: {
      goal: "Classify the support ticket and suggest the next action.",
      instructions: ["Return category, priority, and next action."],
      memory: {
        facts: ["The team uses categories: billing, access, bug, sales."],
        constraints: ["Escalate access issues for enterprise customers."],
      },
      messages: makeMessages(22, "support chat"),
      context: {
        handbook: repeat("Support handbook entry covering billing, access, product bugs, enterprise escalation, response tone, and routing.", 70),
        ticket: "Enterprise customer cannot access the admin dashboard after SSO migration.",
      },
    },
  },
  {
    name: "policy answer",
    budget: 1200,
    input: {
      goal: "Answer whether a workflow needs human approval.",
      instructions: ["Use the policy, cite the decisive rule, and do not include unrelated rules."],
      memory: {
        constraints: ["High-impact production actions need explicit approval."],
      },
      messages: makeMessages(12, "policy Q&A"),
      context: {
        policy: repeat("Runtime governance policy covering deploys, refunds, email, infrastructure changes, customer data access, and approval thresholds.", 90),
        question: "Can an AI agent restart the production API during business hours without human approval?",
      },
    },
  },
  {
    name: "meeting follow-up",
    budget: 800,
    input: {
      goal: "Write the action items from the latest meeting notes.",
      instructions: ["Return owner, task, and due date when present."],
      memory: {
        preferences: ["Keep internal summaries short."],
      },
      messages: makeMessages(18, "project planning"),
      context: {
        historicalNotes: repeat("Older meeting notes with resolved tasks, previous decisions, and stale planning options.", 65),
        latestNotes: "Alex owns API rollout by Friday. Priya owns billing QA. Jacob will publish the package after CI passes.",
      },
    },
  },
  {
    name: "bug report",
    budget: 950,
    input: {
      goal: "Summarize a bug report and identify likely next debugging step.",
      instructions: ["Do not invent stack frames.", "Prefer the newest error over older logs."],
      memory: {
        facts: ["The app is a Vite React deployment."],
      },
      messages: makeMessages(20, "debugging"),
      context: {
        oldLogs: repeat("Old warning log with unrelated dependency warnings, lint notes, and resolved build output.", 80),
        latestError: "Cloudflare Pages Function failed because module node:crypto was unavailable at runtime.",
      },
    },
  },
];

const rows = cases.map((item) => {
  const context = buildNanoContext(item.input, {
    budget: { maxInputTokens: item.budget },
    maxRecentMessages: 4,
  });

  return {
    task: item.name,
    budget: item.budget,
    naive: context.originalTokens,
    nano: context.inputTokens,
    saved: context.savedTokens,
    savedPercent: context.savedRatio * 100,
    dropped: context.dropped.length,
  };
});

const widths = {
  task: Math.max("Task".length, ...rows.map((row) => row.task.length)),
  budget: 8,
  naive: 12,
  nano: 11,
  saved: 8,
  dropped: 7,
};

console.log("Nano Agent Benchmark\n");
console.log([
  pad("Task", widths.task),
  pad("Budget", widths.budget),
  pad("Naive tokens", widths.naive),
  pad("Nano tokens", widths.nano),
  pad("Saved", widths.saved),
  pad("Dropped", widths.dropped),
].join("  "));
console.log("-".repeat(widths.task + widths.budget + widths.naive + widths.nano + widths.saved + widths.dropped + 10));

for (const row of rows) {
  console.log([
    pad(row.task, widths.task),
    pad(String(row.budget), widths.budget),
    pad(row.naive.toLocaleString(), widths.naive),
    pad(row.nano.toLocaleString(), widths.nano),
    pad(`${row.savedPercent.toFixed(1)}%`, widths.saved),
    pad(String(row.dropped), widths.dropped),
  ].join("  "));
}

const totalNaive = rows.reduce((sum, row) => sum + row.naive, 0);
const totalNano = rows.reduce((sum, row) => sum + row.nano, 0);
const savedPercent = ((totalNaive - totalNano) / totalNaive) * 100;

console.log(`\nTotal naive context: ${totalNaive.toLocaleString()} tokens`);
console.log(`Total nano context:  ${totalNano.toLocaleString()} tokens`);
console.log(`Total saved:         ${savedPercent.toFixed(1)}%`);

function repeat(text, count) {
  return Array.from({ length: count }, (_, index) => `${index + 1}. ${text}`).join("\n");
}

function makeMessages(count, label) {
  return Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `${label} message ${index + 1} with background details that are usually not all needed for the current task.`,
  }));
}

function pad(value, width) {
  return String(value).padEnd(width, " ");
}
