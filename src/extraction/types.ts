/**
 * Extraction-specific types
 *
 * These types are used within the extraction layer to represent
 * intermediate results before they are mapped to domain models.
 */

import { CodeUnitType, ImportType, PatternType } from '@/domain/models/index.js';

/**
 * Represents a code unit found during extraction (before domain mapping).
 */
export interface CodeUnitDeclaration {
  readonly name: string;
  readonly unitType: CodeUnitType;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly signature?: string;
  readonly isAsync: boolean;
  readonly isExported: boolean;
  readonly children?: CodeUnitDeclaration[];
  readonly body?: string;
}

/**
 * Represents a file dependency found during extraction.
 */
export interface FileDependencyInfo {
  readonly targetFile: string;
  readonly importType: ImportType;
  readonly importedNames: string[];
}

/**
 * Represents a pattern detected in code.
 */
export interface DetectedPattern {
  readonly patternType: PatternType;
  readonly patternValue: string;
  readonly lineNumber?: number;
  readonly columnAccess?: { read: string[]; write: string[] };
}

/**
 * A single pattern matching rule.
 */
export interface PatternRule {
  readonly pattern: RegExp;
  readonly patternType: PatternType;
  readonly value?: string;
  readonly extractValue?: (match: RegExpMatchArray) => string;
}

/**
 * Complete set of pattern rules for a language.
 */
export interface PatternRuleSet {
  readonly apiEndpoints: PatternRule[];
  readonly apiCalls: PatternRule[];
  readonly databaseReads: PatternRule[];
  readonly databaseWrites: PatternRule[];
  readonly externalServices: PatternRule[];
  readonly envVariables: PatternRule[];
}

/**
 * Complexity-related regex patterns for a language.
 */
export interface LanguageComplexityPatterns {
  readonly conditionals: RegExp[];
  readonly loops: RegExp[];
  readonly errorHandling: RegExp[];
  readonly asyncPatterns: RegExp[];
}
