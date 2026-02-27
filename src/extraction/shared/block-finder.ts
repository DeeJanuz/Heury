/**
 * Shared Block-Finding Utilities
 *
 * Provides reusable utilities for finding code block boundaries.
 * Used by language extractors to determine where functions, classes,
 * and other code blocks start and end.
 */

/**
 * Comment syntax configuration for a language.
 */
export interface CommentSyntax {
  /** Single-line comment prefix (e.g., '//' for JS, '#' for Python) */
  readonly lineComment: string;
  /** Block comment start delimiter (e.g., '/*') */
  readonly blockCommentStart: string;
  /** Block comment end delimiter (e.g., '*​/') */
  readonly blockCommentEnd: string;
}

/**
 * JavaScript/TypeScript comment syntax.
 */
export const JS_COMMENT_SYNTAX: CommentSyntax = {
  lineComment: '//',
  blockCommentStart: '/*',
  blockCommentEnd: '*/',
};

/**
 * Find the end line of a brace-delimited code block starting at a given position
 * by tracking brace depth. Works for brace-based languages (JS, Go, Java, Rust, C#).
 *
 * @param content - Full file content
 * @param startIndex - Character index to start searching from (should be at or before the opening brace)
 * @returns The 1-indexed line number where the block ends
 */
export function findBlockEnd(content: string, startIndex: number): number {
  let depth = 0;
  let foundOpenBrace = false;
  let lineNumber = content.slice(0, startIndex).split('\n').length;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];

    if (char === '\n') {
      lineNumber++;
    } else if (char === '{') {
      depth++;
      foundOpenBrace = true;
    } else if (char === '}') {
      depth--;
      if (foundOpenBrace && depth === 0) {
        return lineNumber;
      }
    }
  }

  // If we couldn't find the end, estimate based on content length
  return lineNumber + 10;
}

/**
 * Get 1-indexed line number from a character index.
 *
 * @param content - Full file content
 * @param index - Character index
 * @returns 1-indexed line number
 */
export function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

/**
 * Check if a character position is inside a string literal or comment.
 *
 * @param content - Full file content
 * @param index - Character index to check
 * @param commentSyntax - Comment syntax for the language (defaults to JS/TS)
 * @returns true if the position is inside a comment
 */
export function isInsideStringOrComment(
  content: string,
  index: number,
  commentSyntax: CommentSyntax = JS_COMMENT_SYNTAX,
): boolean {
  const beforeIndex = content.slice(0, index);

  // Check for single-line comment
  const lastNewline = beforeIndex.lastIndexOf('\n');
  const lineContent = beforeIndex.slice(lastNewline + 1);
  if (lineContent.includes(commentSyntax.lineComment)) {
    const commentStart = lineContent.indexOf(commentSyntax.lineComment);
    const positionInLine = index - lastNewline - 1;
    if (positionInLine > commentStart) {
      return true;
    }
  }

  // Multi-line comment check
  if (commentSyntax.blockCommentStart && commentSyntax.blockCommentEnd) {
    const lastCommentStart = beforeIndex.lastIndexOf(commentSyntax.blockCommentStart);
    const lastCommentEnd = beforeIndex.lastIndexOf(commentSyntax.blockCommentEnd);
    if (lastCommentStart > lastCommentEnd) {
      return true;
    }
  }

  return false;
}

/**
 * Find the end of an indentation-based block (for Python).
 * Returns the 1-indexed line number where the block ends.
 *
 * The block ends when a non-empty, non-comment line has indentation
 * at or below the starting level.
 *
 * @param content - Full file content
 * @param startIndex - Character index of the block's definition line
 * @returns 1-indexed line number of the last line in the block
 */
export function findIndentationBlockEnd(content: string, startIndex: number): number {
  const lines = content.split('\n');
  const startLine = content.slice(0, startIndex).split('\n').length - 1;

  // Get the indentation of the definition line
  const defLine = lines[startLine] || '';
  const defIndent = defLine.match(/^(\s*)/)?.[1].length ?? 0;

  // Look for the first non-empty line with indentation <= defIndent after the def line
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    // Skip empty lines and comment-only lines
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const lineIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (lineIndent <= defIndent) {
      // The block ended at the previous non-empty line
      for (let j = i - 1; j > startLine; j--) {
        if (lines[j].trim() !== '') {
          return j + 1; // 1-indexed
        }
      }
      return startLine + 2; // At minimum, one line after start
    }
  }

  // Block extends to end of file - find last non-empty line
  for (let i = lines.length - 1; i > startLine; i--) {
    if (lines[i].trim() !== '') {
      return i + 1; // 1-indexed
    }
  }
  return lines.length;
}
