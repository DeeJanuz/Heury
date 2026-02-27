/**
 * File Processor
 *
 * Processes a single file through the full extraction pipeline:
 * code unit extraction, complexity calculation, pattern detection,
 * dependency extraction, and module-level pattern detection.
 */

import {
  createCodeUnit,
  createCodeUnitPattern,
  calculateComplexityScore,
  type CodeUnit,
} from '@/domain/models/index.js';
import type { DetectedPattern, FileDependencyInfo, CodeUnitDeclaration } from '@/extraction/types.js';
import type { LanguageExtractor } from '@/extraction/language-registry.js';
import { calculateComplexity } from '@/extraction/complexity-calculator.js';
import { detectPatterns } from '@/extraction/pattern-detector.js';
import { detectModuleLevelPatterns } from './module-level-detector.js';

/**
 * Extract the body of a code unit from file content using line ranges.
 * Falls back to decl.body if available.
 */
function extractBody(
  content: string,
  lines: string[],
  decl: CodeUnitDeclaration,
): string {
  if (decl.body) return decl.body;
  // Extract from content using line numbers (1-indexed)
  const start = Math.max(0, decl.lineStart - 1);
  const end = Math.min(lines.length, decl.lineEnd);
  return lines.slice(start, end).join('\n');
}

export interface FileProcessingResult {
  readonly filePath: string;
  readonly codeUnits: CodeUnit[];
  readonly dependencies: FileDependencyInfo[];
  readonly moduleLevelPatterns: DetectedPattern[];
}

/**
 * Process a single file through the full extraction pipeline.
 *
 * @param content - The file content
 * @param filePath - The file path
 * @param extractor - The language extractor for this file type
 * @returns Processing result with code units, dependencies, and patterns
 */
export function processFile(
  content: string,
  filePath: string,
  extractor: LanguageExtractor,
): FileProcessingResult {
  if (!content) {
    return {
      filePath,
      codeUnits: [],
      dependencies: [],
      moduleLevelPatterns: [],
    };
  }

  // 1. Extract code unit declarations
  const declarations = extractor.extractCodeUnits(content, filePath);
  const complexityPatterns = extractor.getComplexityPatterns();
  const patternRules = extractor.getPatternRules();
  const lines = content.split('\n');

  // 2-4. For each declaration, calculate complexity, detect patterns, and create domain objects
  const codeUnits: CodeUnit[] = [];
  const codeUnitLineRanges: Array<{ lineStart: number; lineEnd: number }> = [];

  for (const decl of declarations) {
    const body = extractBody(content, lines, decl);
    const complexity = calculateComplexity(body, complexityPatterns, decl.signature);
    const complexityScore = calculateComplexityScore(complexity);
    const detectedPatterns = detectPatterns(body, patternRules, filePath);

    // Create a temporary ID for the code unit so patterns can reference it
    const unit = createCodeUnit({
      filePath,
      name: decl.name,
      unitType: decl.unitType,
      lineStart: decl.lineStart,
      lineEnd: decl.lineEnd,
      signature: decl.signature,
      isAsync: decl.isAsync,
      isExported: decl.isExported,
      language: extractor.languageId,
      complexity: complexity as unknown as Record<string, number>,
      complexityScore,
      patterns: detectedPatterns.map(p =>
        createCodeUnitPattern({
          codeUnitId: 'pending', // Will be set after unit creation
          patternType: p.patternType,
          patternValue: p.patternValue,
          lineNumber: p.lineNumber,
          columnAccess: p.columnAccess,
        }),
      ),
      children: processChildren(decl.children ?? [], content, lines, filePath, extractor, complexityPatterns, patternRules),
    });

    // Re-create patterns with the correct codeUnitId
    const patternsWithId = detectedPatterns.map(p =>
      createCodeUnitPattern({
        codeUnitId: unit.id,
        patternType: p.patternType,
        patternValue: p.patternValue,
        lineNumber: p.lineNumber,
        columnAccess: p.columnAccess,
      }),
    );

    // Create final unit with correct pattern IDs
    const finalUnit = createCodeUnit({
      id: unit.id,
      filePath,
      name: decl.name,
      unitType: decl.unitType,
      lineStart: decl.lineStart,
      lineEnd: decl.lineEnd,
      signature: decl.signature,
      isAsync: decl.isAsync,
      isExported: decl.isExported,
      language: extractor.languageId,
      complexity: complexity as unknown as Record<string, number>,
      complexityScore,
      patterns: patternsWithId,
      children: unit.children,
    });

    codeUnits.push(finalUnit);
    codeUnitLineRanges.push({ lineStart: decl.lineStart, lineEnd: decl.lineEnd });
  }

  // 5. Extract dependencies
  const dependencies = extractor.extractDependencies(content, filePath);

  // 6. Detect module-level patterns
  const moduleLevelPatterns = detectModuleLevelPatterns(
    content,
    codeUnitLineRanges,
    patternRules,
    filePath,
  );

  return {
    filePath,
    codeUnits,
    dependencies,
    moduleLevelPatterns,
  };
}

function processChildren(
  children: CodeUnitDeclaration[],
  content: string,
  lines: string[],
  filePath: string,
  extractor: LanguageExtractor,
  complexityPatterns: import('@/extraction/types.js').LanguageComplexityPatterns,
  patternRules: import('@/extraction/types.js').PatternRuleSet,
): CodeUnit[] {
  return children.map(child => {
    const body = extractBody(content, lines, child);
    const complexity = calculateComplexity(body, complexityPatterns, child.signature);
    const complexityScore = calculateComplexityScore(complexity);
    const detectedPatterns = detectPatterns(body, patternRules, filePath);

    const unit = createCodeUnit({
      filePath,
      name: child.name,
      unitType: child.unitType,
      lineStart: child.lineStart,
      lineEnd: child.lineEnd,
      signature: child.signature,
      isAsync: child.isAsync,
      isExported: child.isExported,
      language: extractor.languageId,
      complexity: complexity as unknown as Record<string, number>,
      complexityScore,
      patterns: detectedPatterns.map(p =>
        createCodeUnitPattern({
          codeUnitId: 'pending',
          patternType: p.patternType,
          patternValue: p.patternValue,
          lineNumber: p.lineNumber,
          columnAccess: p.columnAccess,
        }),
      ),
    });

    // Re-create with correct ID
    const patternsWithId = detectedPatterns.map(p =>
      createCodeUnitPattern({
        codeUnitId: unit.id,
        patternType: p.patternType,
        patternValue: p.patternValue,
        lineNumber: p.lineNumber,
        columnAccess: p.columnAccess,
      }),
    );

    return createCodeUnit({
      id: unit.id,
      filePath,
      name: child.name,
      unitType: child.unitType,
      lineStart: child.lineStart,
      lineEnd: child.lineEnd,
      signature: child.signature,
      isAsync: child.isAsync,
      isExported: child.isExported,
      language: extractor.languageId,
      complexity: complexity as unknown as Record<string, number>,
      complexityScore,
      patterns: patternsWithId,
    });
  });
}
