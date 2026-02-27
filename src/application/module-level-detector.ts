/**
 * Module-Level Pattern Detector
 *
 * Detects patterns at file/module scope that aren't inside any extracted code unit.
 * For example, Express routes defined at the top level of a file rather than
 * inside a function body.
 */

import type { DetectedPattern, PatternRuleSet } from '@/extraction/types.js';
import { detectPatterns } from '@/extraction/pattern-detector.js';

/**
 * Detect patterns at file/module scope that aren't inside any extracted code unit.
 *
 * Runs pattern detection on the full file content, then filters out any patterns
 * whose lineNumber falls within a code unit's [lineStart, lineEnd] range.
 *
 * @param content - Full file content
 * @param codeUnitLineRanges - Line ranges of extracted code units
 * @param patternRules - Language-specific pattern rules
 * @param filePath - Optional file path for context
 * @returns Patterns found at module level only
 */
export function detectModuleLevelPatterns(
  content: string,
  codeUnitLineRanges: Array<{ lineStart: number; lineEnd: number }>,
  patternRules: PatternRuleSet,
  filePath?: string,
): DetectedPattern[] {
  if (!content) return [];

  const allPatterns = detectPatterns(content, patternRules, filePath);
  if (allPatterns.length === 0) return [];

  // Filter out patterns whose lineNumber falls within any code unit range
  return allPatterns.filter(pattern => {
    if (pattern.lineNumber === undefined) return true;

    for (const range of codeUnitLineRanges) {
      if (pattern.lineNumber >= range.lineStart && pattern.lineNumber <= range.lineEnd) {
        return false;
      }
    }

    return true;
  });
}
