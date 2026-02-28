import type { CodeUnit } from '@/domain/models/index.js';
import { getComplexityLevel } from '@/domain/models/index.js';

/**
 * Build a search-optimized text representation of a code unit for embedding.
 */
export function buildEmbeddingText(unit: CodeUnit, summary?: string): string {
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

  // LLM-generated summary
  if (summary) {
    parts.push(`Summary: ${summary}`);
  }

  return parts.join('\n');
}
