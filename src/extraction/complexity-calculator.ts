/**
 * Complexity Calculator Service
 *
 * Calculates complexity metrics for code blocks including:
 * - Conditional complexity (if, else, switch, case, ternary)
 * - Loop complexity (for, while, forEach, map, etc.)
 * - Nesting depth
 * - Error handling (try/catch)
 * - Async patterns (async, await, Promise, .then/.catch)
 * - Parameter count
 * - Line count
 */

import type { ComplexityMetrics } from '@/domain/models/index.js';
import type { LanguageComplexityPatterns } from './types.js';

/**
 * Count occurrences of a pattern in code.
 */
function countPattern(code: string, pattern: RegExp): number {
  const freshRegex = new RegExp(pattern.source, pattern.flags);
  const matches = code.match(freshRegex);
  return matches ? matches.length : 0;
}

/**
 * Count conditional statements using language-specific patterns.
 */
export function countConditionals(code: string, patterns: LanguageComplexityPatterns): number {
  let count = 0;
  for (const pattern of patterns.conditionals) {
    count += countPattern(code, pattern);
  }
  return count;
}

/**
 * Count loop statements using language-specific patterns.
 */
export function countLoops(code: string, patterns: LanguageComplexityPatterns): number {
  let count = 0;
  for (const pattern of patterns.loops) {
    count += countPattern(code, pattern);
  }
  return count;
}

/**
 * Calculate maximum nesting depth by tracking braces.
 * Skips strings and comments.
 */
export function calculateMaxNestingDepth(code: string): number {
  let maxDepth = 0;
  let currentDepth = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inLineComment = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const prevChar = i > 0 ? code[i - 1] : '';
    const nextChar = i < code.length - 1 ? code[i + 1] : '';

    // Handle line comments
    if (!inString && !inComment && char === '/' && nextChar === '/') {
      inLineComment = true;
      continue;
    }
    if (inLineComment && char === '\n') {
      inLineComment = false;
      continue;
    }
    if (inLineComment) continue;

    // Handle block comments
    if (!inString && !inComment && char === '/' && nextChar === '*') {
      inComment = true;
      continue;
    }
    if (inComment && char === '*' && nextChar === '/') {
      inComment = false;
      i++;
      continue;
    }
    if (inComment) continue;

    // Handle strings
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
      continue;
    }
    if (inString && char === stringChar && prevChar !== '\\') {
      inString = false;
      continue;
    }
    if (inString) continue;

    // Count braces
    if (char === '{') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === '}') {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }

  return maxDepth;
}

/**
 * Count try/catch blocks using language-specific patterns.
 */
export function countTryCatchBlocks(code: string, patterns: LanguageComplexityPatterns): number {
  let count = 0;
  for (const pattern of patterns.errorHandling) {
    count += countPattern(code, pattern);
  }
  return count;
}

/**
 * Count async patterns using language-specific patterns.
 */
export function countAsyncPatterns(code: string, patterns: LanguageComplexityPatterns): number {
  let count = 0;
  for (const pattern of patterns.asyncPatterns) {
    count += countPattern(code, pattern);
  }
  return count;
}

/**
 * Calculate callback chain depth (.then/.catch chains).
 */
export function calculateCallbackDepth(code: string): number {
  let maxChainLength = 0;
  let currentChainLength = 0;
  const lines = code.split('\n');

  for (const line of lines) {
    const thenCount = (line.match(/\.then\s*\(/g) || []).length;
    const catchCount = (line.match(/\.catch\s*\(/g) || []).length;

    if (thenCount > 0 || catchCount > 0) {
      currentChainLength += thenCount + catchCount;
      maxChainLength = Math.max(maxChainLength, currentChainLength);
    } else if (line.trim() !== '' && !line.includes('//')) {
      currentChainLength = 0;
    }
  }

  return maxChainLength;
}

/**
 * Calculate parameter count from a function signature string.
 *
 * @param signature - Function signature like "(a: string, b: number)"
 * @returns Number of parameters
 */
export function calculateParameterCount(signature?: string): number {
  if (!signature) return 0;

  const params = signature.replace(/^\(|\)$/g, '').trim();
  if (!params) return 0;

  let depth = 0;
  let paramCount = 0;
  let hasContent = false;

  for (const char of params) {
    if (char === '{' || char === '[' || char === '<' || char === '(') {
      depth++;
      hasContent = true;
    } else if (char === '}' || char === ']' || char === '>' || char === ')') {
      depth--;
    } else if (char === ',' && depth === 0) {
      paramCount++;
    } else if (char !== ' ' && char !== ':') {
      hasContent = true;
    }
  }

  if (hasContent) {
    paramCount++;
  }

  return paramCount;
}

/**
 * Calculate all complexity metrics for a code block.
 *
 * @param code - The code string to analyze
 * @param patterns - Language-specific complexity patterns
 * @param signature - Optional function signature for parameter counting
 * @returns ComplexityMetrics object
 */
export function calculateComplexity(
  code: string,
  patterns: LanguageComplexityPatterns,
  signature?: string,
): ComplexityMetrics {
  return {
    conditionals: countConditionals(code, patterns),
    loops: countLoops(code, patterns),
    maxNestingDepth: calculateMaxNestingDepth(code),
    tryCatchBlocks: countTryCatchBlocks(code, patterns),
    asyncPatterns: countAsyncPatterns(code, patterns),
    callbackDepth: calculateCallbackDepth(code),
    parameterCount: calculateParameterCount(signature),
    lineCount: code.split('\n').length,
  };
}
