const sampleContext = `ticket:
Customer says order ORD-123 was charged twice and asks for a duplicate-charge refund.

latest facts:
- Duplicate charge: true
- Amount: $42
- Payment event matched the same card twice

old conversation:
${"Customer asked about shipping updates, loyalty points, password reset, address changes, coupon eligibility, delivery windows, and older orders. ".repeat(18)}

policy:
Refund requests must include customer id, order id, amount, reason, prior refund history, and approval status. Refunds over $100 require manual approval. Duplicate-charge refunds under $100 can be acknowledged, but the agent must avoid promising money before billing review confirms eligibility. ${"Internal policy appendix: collect evidence, avoid unsupported promises, summarize action taken, and route exceptions. ".repeat(16)}
`;

const goal = document.querySelector("#goal");
const budget = document.querySelector("#budget");
const budgetValue = document.querySelector("#budgetValue");
const context = document.querySelector("#context");
const naiveTokens = document.querySelector("#naiveTokens");
const nanoTokens = document.querySelector("#nanoTokens");
const savedPercent = document.querySelector("#savedPercent");
const naiveBar = document.querySelector("#naiveBar");
const nanoBar = document.querySelector("#nanoBar");
const statNaive = document.querySelector("#statNaive");
const statNano = document.querySelector("#statNano");
const statDropped = document.querySelector("#statDropped");
const keptList = document.querySelector("#keptList");
const droppedList = document.querySelector("#droppedList");
const packet = document.querySelector("#packet");

context.value = sampleContext;

for (const element of [goal, budget, context]) {
  element.addEventListener("input", render);
}

render();

function render() {
  const maxTokens = Number(budget.value);
  budgetValue.value = `${maxTokens.toLocaleString()} tokens`;

  const candidates = [
    { label: "goal", priority: 100, text: `Goal:\n${goal.value}` },
    { label: "instruction:1", priority: 90, text: "Instruction:\nUse only facts in context." },
    { label: "memory", priority: 80, text: "Memory:\nConstraint: Refunds over $100 require approval.\nPreference: Keep customer replies concise." },
    ...splitContext(context.value).map((item, index) => ({
      label: `context:${item.label}`,
      priority: 60 - index,
      text: `Context: ${item.label}\n${item.text}`,
    })),
  ];
  const original = candidates.reduce((sum, item) => sum + estimateTokens(item.text), 0);
  let used = 0;
  const kept = [];
  const dropped = [];
  const messages = [];

  for (const item of candidates.sort((a, b) => b.priority - a.priority)) {
    const tokens = estimateTokens(item.text);
    if (used + tokens <= maxTokens) {
      kept.push(item.label);
      messages.push({ role: item.priority >= 80 ? "system" : "user", content: item.text });
      used += tokens;
    } else if (item.priority >= 80 && maxTokens - used > 24) {
      const trimmed = trimToTokens(item.text, maxTokens - used);
      kept.push(`${item.label}:trimmed`);
      messages.push({ role: "system", content: trimmed });
      used += estimateTokens(trimmed);
    } else {
      dropped.push(item.label);
    }
  }

  const saved = original === 0 ? 0 : Math.max(0, (original - used) / original);
  naiveTokens.textContent = original.toLocaleString();
  nanoTokens.textContent = used.toLocaleString();
  savedPercent.textContent = `${(saved * 100).toFixed(1)}%`;
  statNaive.textContent = original.toLocaleString();
  statNano.textContent = used.toLocaleString();
  statDropped.textContent = String(dropped.length);
  naiveBar.style.width = "100%";
  nanoBar.style.width = `${Math.max(4, Math.min(100, (used / Math.max(original, 1)) * 100))}%`;

  renderList(keptList, kept);
  renderList(droppedList, dropped.length ? dropped : ["nothing"]);
  packet.textContent = JSON.stringify({
    goal: goal.value,
    inputTokens: used,
    originalTokens: original,
    savedTokens: original - used,
    savedPercent: Number((saved * 100).toFixed(1)),
    kept,
    dropped,
    messages,
  }, null, 2);
}

function renderList(target, items) {
  target.replaceChildren(...items.map((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    return li;
  }));
}

function splitContext(value) {
  return value
    .split(/\n\s*\n/g)
    .map((section, index) => {
      const [first, ...rest] = section.trim().split("\n");
      const clean = first.replace(/:$/, "").trim();
      return {
        label: clean && clean.length < 48 ? clean : `section-${index + 1}`,
        text: rest.length ? rest.join("\n").trim() : section.trim(),
      };
    })
    .filter((item) => item.text);
}

function estimateTokens(text) {
  const normalized = String(text ?? "").trim();
  if (!normalized) return 0;
  const wordish = normalized.split(/\s+/).filter(Boolean).length;
  const charEstimate = Math.ceil(normalized.length / 4);
  return Math.max(1, Math.ceil((wordish + charEstimate) / 2));
}

function trimToTokens(text, maxTokens) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  let output = "";
  for (const word of words) {
    const candidate = output ? `${output} ${word}` : word;
    if (estimateTokens(candidate) > maxTokens) break;
    output = candidate;
  }
  return output ? `${output} ...` : "";
}
