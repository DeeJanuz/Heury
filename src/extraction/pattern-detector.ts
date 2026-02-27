/**
 * Pattern Detector Service
 *
 * Detects patterns within code units including:
 * - API endpoints (Express, Next.js route handlers)
 * - API calls (fetch, axios, http clients)
 * - Database operations (Prisma, SQL)
 * - External services (Stripe, OpenAI, etc.)
 * - Environment variables
 */

import { PatternType } from '@/domain/models/index.js';

import type { DetectedPattern, PatternRuleSet, PatternRule } from './types.js';
import {
  SQL_READ_PATTERNS,
  SQL_WRITE_PATTERNS,
  EXTERNAL_SERVICE_PATTERNS,
  type SharedPatternRule,
} from './shared/pattern-rules-shared.js';
import { extractColumnAccess, type ColumnAccess } from './column-extractor.js';

/**
 * Get line number from character index in content.
 */
function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

/**
 * Derive API path from Next.js App Router file path.
 *
 * Converts file paths like:
 * - app/api/users/route.ts -> /api/users
 * - app/api/users/[id]/route.ts -> /api/users/[id]
 * - app/api/auth/[...all]/route.ts -> /api/auth/*
 *
 * @param filePath - The file path of the route handler
 * @returns The derived API path, or undefined if not a valid route file
 */
export function deriveNextJsApiPath(filePath: string): string | undefined {
  const normalizedPath = filePath.replace(/\\/g, '/');

  const appApiMatch = normalizedPath.match(/app\/api\/(.+?)\/route\.[jt]sx?$/);
  if (!appApiMatch) return undefined;

  const pathSegments = appApiMatch[1];
  const apiPath = '/api/' + pathSegments.replace(/\[\.\.\.[\w]+\]/g, '*');

  return apiPath;
}

/**
 * Extract @Route/@Controller prefix from NestJS/TSOA decorators.
 *
 * @param content - The full code block being analyzed
 * @returns The normalized prefix string, or undefined if none found
 */
export function extractControllerPrefix(content: string): string | undefined {
  if (!content) return undefined;
  const match = content.match(/@(?:Route|Controller)\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/);
  if (!match) return undefined;
  const prefix = match[1];
  return prefix.startsWith('/') ? prefix : `/${prefix}`;
}

/**
 * Filter patterns by a single type.
 */
export function filterPatternsByType(
  patterns: DetectedPattern[],
  type: PatternType,
): DetectedPattern[] {
  return patterns.filter((p) => p.patternType === type);
}

/**
 * Group patterns by type.
 */
export function groupPatternsByType(
  patterns: DetectedPattern[],
): Map<PatternType, DetectedPattern[]> {
  const grouped = new Map<PatternType, DetectedPattern[]>();

  for (const pattern of patterns) {
    const existing = grouped.get(pattern.patternType) || [];
    existing.push(pattern);
    grouped.set(pattern.patternType, existing);
  }

  return grouped;
}

/**
 * Detect patterns within code content.
 *
 * @param content - The code string to analyze
 * @param patternRules - Language-specific pattern rules
 * @param filePath - Optional file path for context (e.g., Next.js route derivation)
 * @returns Array of DetectedPattern objects
 */
export function detectPatterns(
  content: string,
  patternRules: PatternRuleSet,
  filePath?: string,
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const seenPatterns = new Set<string>();

  function addPattern(
    type: PatternType,
    value: string,
    lineNumber: number | undefined,
    columnAccess?: ColumnAccess,
  ): void {
    const key = `${type}:${value}`;
    if (seenPatterns.has(key)) return;
    seenPatterns.add(key);

    patterns.push({
      patternType: type,
      patternValue: value,
      lineNumber,
      columnAccess: columnAccess ? { read: columnAccess.read || [], write: columnAccess.write || [] } : undefined,
    });
  }

  // Run language-specific pattern rules
  const ruleCategories: [string, PatternRule[]][] = [
    ['apiEndpoints', patternRules.apiEndpoints],
    ['apiCalls', patternRules.apiCalls],
    ['databaseReads', patternRules.databaseReads],
    ['databaseWrites', patternRules.databaseWrites],
    ['externalServices', patternRules.externalServices],
    ['envVariables', patternRules.envVariables],
  ];

  for (const [, rules] of ruleCategories) {
    for (const rule of rules) {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      let match;

      while ((match = regex.exec(content)) !== null) {
        const value = rule.extractValue ? rule.extractValue(match) : match[0];
        const lineNumber = getLineNumber(content, match.index);

        let columnAccess: ColumnAccess | undefined;
        if (
          rule.patternType === PatternType.DATABASE_READ ||
          rule.patternType === PatternType.DATABASE_WRITE
        ) {
          // Try to extract column access from the surrounding code
          const windowStart = Math.max(0, match.index - 10);
          const windowEnd = Math.min(content.length, match.index + 500);
          const codeWindow = content.slice(windowStart, windowEnd);
          columnAccess = extractColumnAccess(codeWindow, rule.patternType) ?? undefined;
        }

        addPattern(rule.patternType, value, lineNumber, columnAccess);
      }
    }
  }

  // Run shared SQL patterns
  runSharedPatterns(content, SQL_READ_PATTERNS, seenPatterns, addPattern);
  runSharedPatterns(content, SQL_WRITE_PATTERNS, seenPatterns, addPattern);

  // Run shared external service patterns
  runSharedPatterns(content, EXTERNAL_SERVICE_PATTERNS, seenPatterns, addPattern);

  // Post-process: for Next.js routes, enhance API endpoint values with file path
  if (filePath) {
    const apiPath = deriveNextJsApiPath(filePath);
    if (apiPath) {
      for (const pattern of patterns) {
        if (
          pattern.patternType === PatternType.API_ENDPOINT &&
          /^(GET|POST|PUT|PATCH|DELETE)$/.test(pattern.patternValue)
        ) {
          // Mutate to add the derived path
          (pattern as { patternValue: string }).patternValue = `${pattern.patternValue} ${apiPath}`;
        }
      }
    }
  }

  return patterns;
}

function runSharedPatterns(
  content: string,
  sharedRules: SharedPatternRule[],
  seenPatterns: Set<string>,
  addPattern: (type: PatternType, value: string, lineNumber: number | undefined, columnAccess?: ColumnAccess) => void,
): void {
  for (const rule of sharedRules) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match;

    while ((match = regex.exec(content)) !== null) {
      const tableName = match[1] || '';
      const value = rule.value ? `${rule.value} ${tableName}`.trim() : match[0];

      const key = `${rule.patternType}:${value}`;
      if (seenPatterns.has(key)) continue;

      const lineNumber = getLineNumber(content, match.index);

      let columnAccess: ColumnAccess | undefined;
      if (
        rule.patternType === PatternType.DATABASE_READ ||
        rule.patternType === PatternType.DATABASE_WRITE
      ) {
        const windowStart = Math.max(0, match.index - 10);
        const windowEnd = Math.min(content.length, match.index + 500);
        const codeWindow = content.slice(windowStart, windowEnd);
        columnAccess = extractColumnAccess(codeWindow, rule.patternType) ?? undefined;
      }

      addPattern(rule.patternType, value, lineNumber, columnAccess);
    }
  }
}
