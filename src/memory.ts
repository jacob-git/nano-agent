import type { NanoMemoryInput, NanoMemorySnapshot, NanoModelMessage } from "./types.js";

export function createNanoMemory(input: NanoMemoryInput = {}): NanoMemorySnapshot {
  return {
    facts: normalizeItems(input.facts),
    preferences: normalizeItems(input.preferences),
    constraints: normalizeItems(input.constraints),
    unresolvedTasks: normalizeItems(input.unresolvedTasks),
  };
}

export function mergeMemory(left: NanoMemorySnapshot, right?: NanoMemoryInput): NanoMemorySnapshot {
  if (!right) return createNanoMemory(left);
  return {
    facts: unique([...left.facts, ...normalizeItems(right.facts)]),
    preferences: unique([...left.preferences, ...normalizeItems(right.preferences)]),
    constraints: unique([...left.constraints, ...normalizeItems(right.constraints)]),
    unresolvedTasks: unique([...left.unresolvedTasks, ...normalizeItems(right.unresolvedTasks)]),
  };
}

export function memoryToText(memory: NanoMemorySnapshot): string {
  const sections = [
    formatSection("Known facts", memory.facts),
    formatSection("User preferences", memory.preferences),
    formatSection("Constraints", memory.constraints),
    formatSection("Unresolved tasks", memory.unresolvedTasks),
  ].filter(Boolean);
  return sections.join("\n\n");
}

export function summarizeMessages(messages: NanoModelMessage[] = [], maxRecentMessages = 6): {
  recent: NanoModelMessage[];
  dropped: string[];
} {
  const safeMax = Math.max(0, Math.floor(maxRecentMessages));
  if (messages.length <= safeMax) return { recent: [...messages], dropped: [] };
  const droppedCount = messages.length - safeMax;
  return {
    recent: messages.slice(-safeMax),
    dropped: [`Dropped ${droppedCount} older message${droppedCount === 1 ? "" : "s"} outside recent window.`],
  };
}

function formatSection(label: string, items: string[]): string {
  if (items.length === 0) return "";
  return `${label}:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function normalizeItems(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return unique(items.map((item) => String(item).trim()).filter(Boolean));
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
