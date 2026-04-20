const examples = [
  {
    name: "support ticket",
    budget: 160,
    goal: "Classify the support ticket and suggest the next action.",
    context: `ticket:
Enterprise customer cannot access the admin dashboard after SSO migration. Their admins receive an authorization loop after login.

account:
Tier: enterprise
SSO enabled: true
Affected users: 8

old conversation:
We are evaluating plan limits. Older question: can invoices include PO numbers? Current issue: our enterprise admin cannot access the dashboard after SSO migration.

handbook:
Support handbook: billing issues include invoice, payment, refunds, and failed card updates. Access issues include login failures, SSO migration errors, permission loops, account lockouts, and enterprise identity provider mismatch. Product bug issues include regressions, console errors, failed workflow states, and broken integrations. Enterprise access issues must be escalated to identity support with account id, identity provider, timestamp, and affected users. Older handbook sections describe response tone, greeting style, link formatting, and unrelated routing examples. Repeat: billing, access, bug, sales, escalation, routing, tone, greeting, procurement, onboarding, renewal, security questionnaire, old invoice note, old support macro, deprecated identity provider checklist, retired SSO provider migration guidance.`
  },
  {
    name: "RAG answer",
    budget: 150,
    goal: "Answer the user question using only relevant retrieved context.",
    context: `question:
Can an AI agent restart the production API during business hours without human approval?

retrievedPolicyA:
Runtime governance policy: high-impact production actions require explicit human approval. Restarting production APIs, changing infrastructure settings, deleting customer data, modifying access control, or applying production migrations are high-impact actions.

retrievedPolicyB:
Low-impact actions include drafting messages, summarizing tickets, preparing pull requests, and checking read-only status dashboards.

retrievedNoise:
Unrelated policy archive: refund thresholds, customer communication tone, invoice corrections, marketing approvals, office access, lunch reimbursement, meeting room booking, deprecated vendor onboarding, archived security review notes, and outdated deployment calendar. This archive repeats many unrelated rules and examples that should not be used for the production restart question.`
  },
  {
    name: "coding assistant",
    budget: 140,
    goal: "Identify the likely next debugging step for the newest deployment error.",
    context: `latestError:
Cloudflare Pages Function failed with: Uncaught Error: No such module "node:crypto" imported from functionsWorker.js.

package:
type: module
dependency: @pallattu/aeg-intent-gate

oldLogs:
Old warnings: lint preferred double quotes, README badge URL outdated, old npm cache notice, old deprecation warning, old CSS warning, resolved dependency warning, previous successful build output, unrelated Vite chunk size note, old package-lock diff, old Cloudflare deployment success log, repeated old warning lines that no longer matter.`
  },
  {
    name: "long chat",
    budget: 130,
    goal: "Write a concise answer for the user's latest request.",
    context: `latestNeed:
The user needs a short migration checklist for moving the support team to SSO.

migrationFacts:
SSO migration requires identity provider setup, test group validation, admin access fallback, user communication, migration date, rollback owner, and post-migration login verification.

oldChatSummary:
The old conversation covered pricing, integrations, billing history, product roadmap, trial extensions, admin roles, workspace naming, notification preferences, older implementation questions, unrelated API examples, and repeated exploration of non-current product features.`
  },
  {
    name: "policy answer",
    budget: 140,
    goal: "Decide whether the requested action needs approval.",
    context: `request:
The proposed action is automatic deletion of stale customer records in production.

policy:
Rule 1: Drafting text is low impact. Rule 2: Read-only status checks are low impact. Rule 3: Any deletion or mutation of production customer data is high impact and requires explicit human approval. Rule 4: Billing refunds above threshold require approval. Rule 5: Marketing copy can be drafted without approval. Rule 6: Infrastructure changes require approval. Appendix: examples, tone, old policy migration notes, duplicate historical rules, archived approval routing, unrelated office policy, deprecated email review policy, old refund examples, and repeated historical notes.`
  },
  {
    name: "meeting summary",
    budget: 120,
    goal: "Extract current action items from the latest meeting notes.",
    context: `latestNotes:
Alex owns API rollout by Friday. Priya owns billing QA before launch. Jacob will publish the package after CI passes. Sam will update the demo URL in the README today.

historicalNotes:
Older meeting notes: resolved landing page copy, old deployment checklist, completed domain setup, archived launch ideas, previous naming debate, old support routing decision, completed package rename, stale issue triage, repeated older action items that were already done, outdated roadmap notes, old demo experiment, old benchmark draft, completed npm token setup.`
  }
];

const example = document.querySelector("#example");
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

example.replaceChildren(...examples.map((item, index) => {
  const option = document.createElement("option");
  option.value = String(index);
  option.textContent = item.name;
  return option;
}));

example.addEventListener("change", () => {
  loadExample(Number(example.value));
});

for (const element of [goal, budget, context]) {
  element.addEventListener("input", render);
}

loadExample(0);

function loadExample(index) {
  const item = examples[index] ?? examples[0];
  goal.value = item.goal;
  budget.value = String(item.budget);
  context.value = item.context;
  render();
}

function render() {
  const maxTokens = Number(budget.value);
  budgetValue.value = `${maxTokens.toLocaleString()} tokens`;

  const candidates = [
    { label: "goal", priority: 100, text: `Goal:\n${goal.value}` },
    { label: "instruction:1", priority: 90, text: "Instruction:\nUse only facts in context." },
    { label: "memory", priority: 80, text: "Memory:\nConstraint: High-impact actions require approval.\nPreference: Keep answers concise." },
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
