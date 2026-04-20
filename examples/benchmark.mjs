import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { buildNanoContext } from "../dist/index.js";

const fixturesDir = new URL("../benchmarks/fixtures/", import.meta.url);
const fixtureFiles = (await readdir(fixturesDir))
  .filter((file) => file.endsWith(".json"))
  .sort();
const cases = await Promise.all(fixtureFiles.map(async (file) => {
  const fixture = JSON.parse(await readFile(new URL(file, fixturesDir), "utf8"));
  return {
    file: join("benchmarks/fixtures", file),
    name: fixture.name,
    budget: fixture.budget,
    input: fixture.input,
  };
}));

const rows = cases.map((item) => {
  const context = buildNanoContext(item.input, {
    budget: { maxInputTokens: item.budget },
    maxRecentMessages: 4,
  });

  return {
    task: item.name,
    fixture: item.file,
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

console.log(`\nFixtures:            ${rows.length}`);
console.log(`Total naive context: ${totalNaive.toLocaleString()} tokens`);
console.log(`Total nano context:  ${totalNano.toLocaleString()} tokens`);
console.log(`Total saved:         ${savedPercent.toFixed(1)}%`);

function pad(value, width) {
  return String(value).padEnd(width, " ");
}
