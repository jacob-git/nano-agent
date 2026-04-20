import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("CLI budget command emits compact context JSON", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nano-agent-cli-"));
  const inputPath = join(directory, "input.json");
  await writeFile(inputPath, JSON.stringify({
    goal: "Summarize support ticket.",
    context: {
      longHistory: "old context ".repeat(400),
      latest: "Customer cannot log in.",
    },
    budget: {
      maxInputTokens: 120,
    },
  }));

  const { stdout } = await execFileAsync("node", [
    "dist/cli.js",
    "budget",
    "--input",
    inputPath,
    "--format",
    "json",
  ]);
  const result = JSON.parse(stdout);

  assert.equal(result.goal, "Summarize support ticket.");
  assert.equal(result.inputTokens <= 120, true);
  assert.equal(result.savedTokens > 0, true);
});
