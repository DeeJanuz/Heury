/**
 * Call Graph Extractor
 *
 * Extracts function calls from code bodies using heuristic regex matching.
 * Returns structured data about each call including the callee name,
 * line number, and whether the call is async.
 *
 * This is a pure function — no dependencies on repositories or database.
 */

/**
 * Represents a function call extracted from a code body.
 */
export interface ExtractedFunctionCall {
  readonly calleeName: string;
  readonly lineNumber: number;
  readonly isAsync: boolean;
}

/**
 * Keywords that look like function calls but should be skipped.
 */
const SKIP_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'throw',
  'typeof', 'instanceof', 'import', 'require', 'else', 'do',
  'delete', 'void', 'in', 'of', 'case', 'yield',
  'function', 'class', 'super',
]);

/**
 * Patterns that match function calls in code.
 *
 * Order matters: more specific patterns first to avoid partial matches.
 */
const CALL_PATTERNS: RegExp[] = [
  // new Constructor(
  /\bnew\s+([A-Z]\w*)\s*\(/g,
  // await identifier( or await this.method( or await obj.method(
  /\bawait\s+((?:this\.)?[a-zA-Z_$]\w*(?:\.[a-zA-Z_$]\w*)*)\s*\(/g,
  // this.method(
  /\b(this\.[a-zA-Z_$]\w*)\s*\(/g,
  // identifier.method( (but not keywords)
  /\b([a-zA-Z_$]\w*\.[a-zA-Z_$]\w*)\s*\(/g,
  // plain identifier(
  /\b([a-zA-Z_$]\w*)\s*\(/g,
];

/**
 * Extract function calls from a code body string.
 *
 * Processes line by line, skipping comments, and matches function call
 * patterns using regex. Returns deduplicated results with 1-based
 * line numbers relative to the body.
 *
 * @param body - The code body to analyze
 * @returns Array of extracted function calls
 */
export function extractFunctionCalls(body: string): ExtractedFunctionCall[] {
  if (!body.trim()) return [];

  const lines = body.split('\n');
  const results: ExtractedFunctionCall[] = [];
  const seen = new Set<string>();
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNumber = i + 1;

    // Handle block comments
    if (inBlockComment) {
      if (trimmed.includes('*/')) {
        inBlockComment = false;
        // Process remainder after closing comment
        const afterComment = trimmed.slice(trimmed.indexOf('*/') + 2);
        if (afterComment.trim()) {
          extractFromLine(afterComment, lineNumber, results, seen);
        }
      }
      continue;
    }

    // Skip single-line comment lines
    if (trimmed.startsWith('//')) continue;

    // Check for block comment start
    if (trimmed.includes('/*')) {
      if (trimmed.includes('*/')) {
        // Block comment opens and closes on same line — extract around it
        const beforeComment = trimmed.slice(0, trimmed.indexOf('/*'));
        const afterClose = trimmed.slice(trimmed.indexOf('*/') + 2);
        const cleanedLine = beforeComment + ' ' + afterClose;
        extractFromLine(cleanedLine, lineNumber, results, seen);
        continue;
      }
      // Block comment starts but doesn't close — extract before it
      const beforeComment = trimmed.slice(0, trimmed.indexOf('/*'));
      if (beforeComment.trim()) {
        extractFromLine(beforeComment, lineNumber, results, seen);
      }
      inBlockComment = true;
      continue;
    }

    extractFromLine(line, lineNumber, results, seen);
  }

  return results;
}

/**
 * Extract function calls from a single line of code.
 */
function extractFromLine(
  line: string,
  lineNumber: number,
  results: ExtractedFunctionCall[],
  seen: Set<string>,
): void {
  // Match "new Constructor(" calls
  const newPattern = /\bnew\s+([A-Z_$]\w*)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = newPattern.exec(line)) !== null) {
    const calleeName = `new ${match[1]}`;
    addCall(calleeName, lineNumber, false, results, seen);
  }

  // Match "await expr(" calls
  const awaitPattern = /\bawait\s+((?:this\.)?[a-zA-Z_$]\w*(?:\.[a-zA-Z_$]\w*)*)\s*\(/g;
  while ((match = awaitPattern.exec(line)) !== null) {
    const calleeName = match[1];
    if (!shouldSkip(calleeName)) {
      addCall(calleeName, lineNumber, true, results, seen);
    }
  }

  // Match "this.method(" calls
  const thisPattern = /\b(this\.[a-zA-Z_$]\w*)\s*\(/g;
  while ((match = thisPattern.exec(line)) !== null) {
    addCall(match[1], lineNumber, false, results, seen);
  }

  // Match "obj.method(" calls (but not "new X" or "await X" which are handled above)
  const methodPattern = /\b([a-zA-Z_$]\w*\.[a-zA-Z_$]\w*)\s*\(/g;
  while ((match = methodPattern.exec(line)) !== null) {
    const calleeName = match[1];
    const prefix = calleeName.split('.')[0];
    // Skip if the prefix is "this" (already handled) or if it looks like a keyword
    if (prefix === 'this') continue;
    if (!shouldSkip(calleeName) && !shouldSkip(prefix)) {
      addCall(calleeName, lineNumber, false, results, seen);
    }
  }

  // Match plain "identifier(" calls
  const plainPattern = /\b([a-zA-Z_$]\w*)\s*\(/g;
  while ((match = plainPattern.exec(line)) !== null) {
    const calleeName = match[1];
    if (shouldSkip(calleeName)) continue;
    // Skip if this was already captured as part of a method call or constructor
    // Check if preceded by "new " or "."
    const beforeIndex = match.index;
    const before = line.slice(Math.max(0, beforeIndex - 5), beforeIndex);
    if (/new\s+$/.test(before)) continue;
    if (/\.\s*$/.test(before)) continue;
    if (/await\s+$/.test(before)) {
      // This is an await call — add as async
      addCall(calleeName, lineNumber, true, results, seen);
      continue;
    }
    addCall(calleeName, lineNumber, false, results, seen);
  }
}

/**
 * Check if a name should be skipped (keyword or reserved).
 */
function shouldSkip(name: string): boolean {
  return SKIP_KEYWORDS.has(name);
}

/**
 * Add a call to the results if not already seen (dedup by calleeName+lineNumber).
 */
function addCall(
  calleeName: string,
  lineNumber: number,
  isAsync: boolean,
  results: ExtractedFunctionCall[],
  seen: Set<string>,
): void {
  const key = `${calleeName}:${lineNumber}`;
  if (seen.has(key)) {
    // If already seen but now marking as async, update
    if (isAsync) {
      const existing = results.find(
        (r) => r.calleeName === calleeName && r.lineNumber === lineNumber,
      );
      if (existing && !existing.isAsync) {
        // Replace with async version
        const idx = results.indexOf(existing);
        results[idx] = { calleeName, lineNumber, isAsync: true };
      }
    }
    return;
  }
  seen.add(key);
  results.push({ calleeName, lineNumber, isAsync });
}
