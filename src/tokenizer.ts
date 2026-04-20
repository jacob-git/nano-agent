const averageCharsPerToken = 4;

export function estimateTokens(text: string): number {
  const normalized = String(text ?? "").trim();
  if (!normalized) return 0;
  const wordish = normalized.split(/\s+/).filter(Boolean).length;
  const charEstimate = Math.ceil(normalized.length / averageCharsPerToken);
  return Math.max(1, Math.ceil((wordish + charEstimate) / 2));
}

export function trimToTokens(text: string, maxTokens: number, estimate = estimateTokens): string {
  const value = String(text ?? "");
  if (maxTokens <= 0) return "";
  if (estimate(value) <= maxTokens) return value;

  const words = value.split(/\s+/).filter(Boolean);
  let low = 0;
  let high = words.length;
  let best = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = words.slice(0, mid).join(" ");
    if (estimate(candidate) <= maxTokens) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best ? `${best} ...` : "";
}
