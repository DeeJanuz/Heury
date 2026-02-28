import type { CodeUnit } from '@/domain/models/index.js';
import { getComplexityLevel } from '@/domain/models/index.js';

const SUMMARY_WORD_LIMIT = 50;

export interface EmbeddingTextContext {
  readonly unit: CodeUnit;
  readonly summary?: string;
  readonly callers?: string[];
  readonly callees?: string[];
  readonly events?: string[];
  readonly clusterName?: string;
}

/**
 * Type guard to distinguish between CodeUnit and EmbeddingTextContext.
 */
function isEmbeddingTextContext(
  arg: CodeUnit | EmbeddingTextContext,
): arg is EmbeddingTextContext {
  return 'unit' in arg;
}

/**
 * Truncate text to a maximum number of words.
 */
function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) {
    return text;
  }
  return words.slice(0, maxWords).join(' ');
}

/**
 * Build a search-optimized text representation of a code unit for embedding.
 *
 * Accepts either a CodeUnit directly (backward compatible) or an EmbeddingTextContext
 * with enrichment data (callers, callees, events, cluster).
 *
 * Priority order (most important first, for 128-token local model truncation):
 *   1. Name and location
 *   2. Flags (async, exported)
 *   3. Summary (first 50 words)
 *   4. Patterns
 *   5. Complexity
 *   6. Callers
 *   7. Callees
 *   8. Events
 *   9. Cluster
 */
export function buildEmbeddingText(unitOrContext: CodeUnit | EmbeddingTextContext, summary?: string): string {
  let unit: CodeUnit;
  let enrichedSummary: string | undefined;
  let callers: string[] | undefined;
  let callees: string[] | undefined;
  let events: string[] | undefined;
  let clusterName: string | undefined;

  if (isEmbeddingTextContext(unitOrContext)) {
    unit = unitOrContext.unit;
    enrichedSummary = unitOrContext.summary;
    callers = unitOrContext.callers;
    callees = unitOrContext.callees;
    events = unitOrContext.events;
    clusterName = unitOrContext.clusterName;
  } else {
    unit = unitOrContext;
    enrichedSummary = summary;
  }

  const parts: string[] = [];

  // Name and location
  parts.push(`${unit.unitType.toLowerCase()} ${unit.name} in ${unit.filePath}`);

  // Flags
  const flags: string[] = [];
  if (unit.isAsync) flags.push('async');
  if (unit.isExported) flags.push('exported');
  if (flags.length > 0) {
    parts.push(`${flags.join(' ')} ${unit.unitType.toLowerCase()}`);
  }

  // Summary (truncated to ~50 words)
  if (enrichedSummary) {
    const truncated = truncateToWords(enrichedSummary, SUMMARY_WORD_LIMIT);
    parts.push(`Summary: ${truncated}`);
  }

  // Patterns
  if (unit.patterns.length > 0) {
    const patternSummaries = unit.patterns.map(
      (p) => `${p.patternType} ${p.patternValue}`,
    );
    parts.push(`Patterns: ${patternSummaries.join(', ')}`);
  }

  // Complexity
  const level = getComplexityLevel(unit.complexityScore);
  parts.push(`Complexity: ${level} (score ${unit.complexityScore})`);

  // Callers
  if (callers && callers.length > 0) {
    parts.push(`callers: ${callers.join(', ')}`);
  }

  // Callees
  if (callees && callees.length > 0) {
    parts.push(`callees: ${callees.join(', ')}`);
  }

  // Events
  if (events && events.length > 0) {
    parts.push(`events: ${events.join(', ')}`);
  }

  // Cluster
  if (clusterName) {
    parts.push(`cluster: ${clusterName}`);
  }

  return parts.join('\n');
}
