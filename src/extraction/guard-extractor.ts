/**
 * Guard Extractor
 *
 * Extracts guard clauses from function/method bodies.
 * Works heuristically with regex patterns for speed.
 *
 * Detects:
 * - Early return guards (if (...) return)
 * - Throw statements (throw new Error, throw expr)
 * - Type guard patterns (typeof, instanceof, null/undefined checks)
 * - Assertion calls (assert(), console.assert())
 *
 * Skips:
 * - expect() calls (test assertions, not code guards)
 * - Patterns inside comments
 */

/**
 * Represents a guard clause extracted from a function body.
 */
export interface ExtractedGuard {
  readonly guardType: 'early-return' | 'throw' | 'type-guard' | 'assertion';
  readonly condition?: string;
  readonly errorType?: string;
  readonly lineNumber: number;
}

/**
 * Checks whether a line is a comment (single-line // or block comment).
 * Returns true only when the entire meaningful content is commented out.
 */
function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//')) return true;
  if (trimmed.startsWith('/*') && trimmed.includes('*/')) return true;
  return false;
}

/**
 * Type-guard condition patterns.
 * Order matters: more specific patterns should come first.
 */
const TYPE_GUARD_PATTERNS: readonly RegExp[] = [
  /typeof\s+\w+\s*[!=]==?\s*'[^']+'/,
  /typeof\s+\w+\s*[!=]==?\s*"[^"]+"/,
  /\w+(?:\.\w+)*\s+instanceof\s+\w+/,
  /\w+(?:\.\w+)*\s*[!=]==?\s*null/,
  /\w+(?:\.\w+)*\s*[!=]==?\s*undefined/,
  /!\w+(?:\.\w+)*/,
];

/**
 * Extract guard clauses from a function body string.
 *
 * @param body - The function body content (without surrounding braces)
 * @returns Array of ExtractedGuard objects sorted by line number
 */
export function extractGuards(body: string): ExtractedGuard[] {
  if (!body.trim()) return [];

  const guards: ExtractedGuard[] = [];
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    if (isCommentLine(line)) continue;

    // Check assertions first (assert(), console.assert())
    if (extractAssertion(line, lineNumber, guards)) continue;

    // Check for if-condition lines (may contain type-guard or early-return)
    if (extractIfGuard(line, lineNumber, guards)) continue;

    // Check for standalone throw statements
    extractThrow(line, lineNumber, guards);
  }

  return guards;
}

/**
 * Extract assertion patterns: assert(...) and console.assert(...)
 * Skips expect(...) calls (test assertions).
 *
 * @returns true if an assertion was found on this line
 */
function extractAssertion(line: string, lineNumber: number, guards: ExtractedGuard[]): boolean {
  const trimmed = line.trimStart();

  // Skip expect() - these are test assertions, not code guards
  if (/\bexpect\s*\(/.test(trimmed)) return false;

  if (/\bassert\s*\(/.test(trimmed) || /\bconsole\.assert\s*\(/.test(trimmed)) {
    guards.push({
      guardType: 'assertion',
      lineNumber,
    });
    return true;
  }

  return false;
}

/**
 * Extract guards from if-condition lines (type-guard or early-return patterns).
 *
 * Type-guard patterns take precedence over early-return when both could match,
 * because a type-guard classification is more specific.
 *
 * @returns true if a guard was found on this line
 */
function extractIfGuard(line: string, lineNumber: number, guards: ExtractedGuard[]): boolean {
  // Match if (...) return pattern on the same line
  const ifReturnMatch = line.match(/\bif\s*\((.+?)\)\s*return\b/);
  if (!ifReturnMatch) return false;

  const condition = ifReturnMatch[1].trim();

  // Check if the condition is a type-guard pattern
  if (isTypeGuardCondition(condition)) {
    guards.push({
      guardType: 'type-guard',
      condition,
      lineNumber,
    });
    return true;
  }

  // Otherwise it's an early-return guard
  guards.push({
    guardType: 'early-return',
    condition,
    lineNumber,
  });
  return true;
}

/**
 * Check whether a condition string matches a type-guard pattern.
 */
function isTypeGuardCondition(condition: string): boolean {
  return TYPE_GUARD_PATTERNS.some(pattern => pattern.test(condition));
}

/**
 * Extract standalone throw statements.
 *
 * @returns true if a throw was found on this line
 */
function extractThrow(line: string, lineNumber: number, guards: ExtractedGuard[]): boolean {
  const trimmed = line.trimStart();

  if (!/\bthrow\b/.test(trimmed)) return false;

  // Match: throw new ClassName(...)
  const throwNewMatch = trimmed.match(/\bthrow\s+new\s+(\w+)\s*\(/);
  if (throwNewMatch) {
    guards.push({
      guardType: 'throw',
      errorType: throwNewMatch[1],
      lineNumber,
    });
    return true;
  }

  // Match: throw expr (without new keyword)
  if (/\bthrow\s+/.test(trimmed)) {
    guards.push({
      guardType: 'throw',
      errorType: undefined,
      lineNumber,
    });
    return true;
  }

  return false;
}
