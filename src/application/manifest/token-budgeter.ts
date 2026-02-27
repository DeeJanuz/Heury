export interface TokenBudget {
  readonly modules: number;
  readonly patterns: number;
  readonly dependencies: number;
  readonly hotspots: number;
}

const CHARS_PER_TOKEN = 4;

/**
 * Rough token estimation: ~4 chars per token for English/code text.
 */
export function estimateTokens(text: string): number {
  return Math.floor(text.length / CHARS_PER_TOKEN);
}

/**
 * Allocate token budget across 4 manifest files.
 * Split: modules 30%, patterns 30%, dependencies 20%, hotspots 20%.
 */
export function allocateBudget(totalTokens: number): TokenBudget {
  return {
    modules: Math.floor(totalTokens * 0.3),
    patterns: Math.floor(totalTokens * 0.3),
    dependencies: Math.floor(totalTokens * 0.2),
    hotspots: Math.floor(totalTokens * 0.2),
  };
}

/**
 * Truncate content to fit within token budget, cutting at line boundaries.
 */
export function truncateToTokenBudget(content: string, maxTokens: number): string {
  if (estimateTokens(content) <= maxTokens) {
    return content;
  }

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const lines = content.split('\n');
  const result: string[] = [];
  let currentLength = 0;

  for (const line of lines) {
    const lineLength = line.length + 1; // +1 for newline
    if (currentLength + lineLength > maxChars) {
      break;
    }
    result.push(line);
    currentLength += lineLength;
  }

  return result.join('\n');
}
