/**
 * Type Field Extractor
 *
 * Extracts field declarations from TypeScript/JavaScript interface bodies,
 * type literal bodies, and class bodies. Works heuristically using regex
 * matching on individual lines.
 *
 * Detects:
 * - Simple fields (name: string)
 * - Optional fields (name?: string)
 * - Readonly fields (readonly name: string)
 * - Visibility modifiers (public, private, protected)
 * - Combined modifiers (private readonly name?: string)
 * - Complex types (arrays, generics, unions, intersections)
 *
 * Skips:
 * - Method signatures (lines with parentheses before colon)
 * - Comment lines (// and /* ... *​/)
 * - Empty lines and brace-only lines
 */

/**
 * Represents a single field extracted from an interface, type, or class body.
 */
export interface ExtractedTypeField {
  readonly name: string;
  readonly fieldType: string;
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
  readonly lineNumber: number;
}

/**
 * Pattern to match field declarations within interface/type/class bodies.
 *
 * Captures:
 * - Group 1: readonly keyword, if present
 * - Group 2: field name
 * - Group 3: question mark (optional marker), if present
 * - Group 4: type annotation
 */
const FIELD_PATTERN =
  /^\s*(?:(?:public|private|protected)\s+)?(?:(readonly)\s+)?(\w+)(\?)?\s*:\s*(.+?)\s*[;,]?\s*$/;

/**
 * Lines matching any of these patterns should be skipped during extraction.
 */
const SKIP_PATTERNS = {
  /** Lines that are only braces (open or close) */
  braces: /^\s*[{}]\s*$/,
  /** Single-line comments */
  singleLineComment: /^\s*\/\//,
  /** Block comment opening, middle, or closing lines */
  blockComment: /^\s*(?:\/\*|\*\/|\*)/,
  /** Empty or whitespace-only lines */
  empty: /^\s*$/,
  /** Method signatures: have parentheses before the colon-type annotation */
  methodSignature: /^\s*(?:(?:public|private|protected|static|async|readonly|override|abstract)\s+)*\w+\s*(?:<[^>]*>)?\s*\(/,
};

/**
 * Check whether a line contains the readonly keyword (possibly after a visibility modifier).
 */
const READONLY_PATTERN = /^\s*(?:(?:public|private|protected)\s+)?readonly\s+/;

/**
 * Extract type field declarations from a body string (interface, type literal, or class body).
 *
 * Processes each line individually, matching field declarations and extracting
 * name, type, optionality, and readonly status. Line numbers are 1-based
 * offsets within the provided body string.
 *
 * @param body - The body content to analyze (without surrounding braces of the declaration)
 * @returns Array of ExtractedTypeField objects
 */
export function extractTypeFields(body: string): ExtractedTypeField[] {
  if (body.length === 0) {
    return [];
  }

  const fields: ExtractedTypeField[] = [];
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Skip lines that are not field declarations
    if (shouldSkipLine(line)) {
      continue;
    }

    const match = FIELD_PATTERN.exec(line);
    if (!match) {
      continue;
    }

    const readonlyKeyword = match[1];
    const name = match[2];
    const questionMark = match[3];
    const fieldType = match[4];

    fields.push({
      name,
      fieldType: fieldType.trim(),
      isOptional: questionMark === '?',
      isReadonly: readonlyKeyword === 'readonly' || READONLY_PATTERN.test(line),
      lineNumber,
    });
  }

  return fields;
}

/**
 * Determine whether a line should be skipped during field extraction.
 *
 * @param line - The line to check
 * @returns true if the line should be skipped
 */
function shouldSkipLine(line: string): boolean {
  return (
    SKIP_PATTERNS.empty.test(line) ||
    SKIP_PATTERNS.braces.test(line) ||
    SKIP_PATTERNS.singleLineComment.test(line) ||
    SKIP_PATTERNS.blockComment.test(line) ||
    SKIP_PATTERNS.methodSignature.test(line)
  );
}
