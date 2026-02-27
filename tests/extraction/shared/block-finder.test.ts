import { describe, it, expect } from 'vitest';
import {
  findBlockEnd,
  findIndentationBlockEnd,
  getLineNumber,
  isInsideStringOrComment,
  JS_COMMENT_SYNTAX,
  type CommentSyntax,
} from '@/extraction/shared/block-finder.js';

describe('findBlockEnd', () => {
  it('should find the closing brace of a simple block', () => {
    const code = 'function foo() {\n  return 1;\n}';
    const startIndex = code.indexOf('{');
    const result = findBlockEnd(code, startIndex);
    expect(result).toBe(3);
  });

  it('should handle nested braces correctly', () => {
    const code = 'function foo() {\n  if (true) {\n    return 1;\n  }\n}';
    const startIndex = code.indexOf('{');
    const result = findBlockEnd(code, startIndex);
    expect(result).toBe(5);
  });

  it('should handle deeply nested braces', () => {
    const code = [
      'function foo() {',
      '  if (true) {',
      '    for (let i = 0; i < 10; i++) {',
      '      console.log(i);',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const startIndex = code.indexOf('{');
    const result = findBlockEnd(code, startIndex);
    expect(result).toBe(7);
  });

  it('should return estimated line when no matching brace found', () => {
    const code = 'function foo() {\n  return 1;\n';
    const startIndex = code.indexOf('{');
    const result = findBlockEnd(code, startIndex);
    // Should return lineNumber + 10 as fallback
    expect(result).toBeGreaterThan(2);
  });

  it('should handle single-line blocks', () => {
    const code = 'function foo() { return 1; }';
    const startIndex = code.indexOf('{');
    const result = findBlockEnd(code, startIndex);
    expect(result).toBe(1);
  });

  it('should handle braces starting from a middle line', () => {
    const code = 'const a = 1;\nconst b = 2;\nfunction foo() {\n  return 1;\n}';
    const startIndex = code.indexOf('{');
    const result = findBlockEnd(code, startIndex);
    expect(result).toBe(5);
  });
});

describe('getLineNumber', () => {
  it('should return 1 for the first character', () => {
    const code = 'hello\nworld';
    expect(getLineNumber(code, 0)).toBe(1);
  });

  it('should return 2 for a character on the second line', () => {
    const code = 'hello\nworld';
    const index = code.indexOf('world');
    expect(getLineNumber(code, index)).toBe(2);
  });

  it('should return correct line for multi-line content', () => {
    const code = 'line 1\nline 2\nline 3\nline 4';
    const index = code.indexOf('line 4');
    expect(getLineNumber(code, index)).toBe(4);
  });

  it('should return 1 for empty content at index 0', () => {
    expect(getLineNumber('', 0)).toBe(1);
  });
});

describe('isInsideStringOrComment', () => {
  it('should return true when position is inside a single-line comment', () => {
    const code = 'const x = 1; // this is { a comment';
    const braceIndex = code.indexOf('{');
    expect(isInsideStringOrComment(code, braceIndex)).toBe(true);
  });

  it('should return false when position is before a comment on the same line', () => {
    const code = 'const x = { value: 1 }; // comment';
    const braceIndex = code.indexOf('{');
    expect(isInsideStringOrComment(code, braceIndex)).toBe(false);
  });

  it('should return true when position is inside a multi-line comment', () => {
    const code = '/* this is\na { multi-line\ncomment */\nconst x = 1;';
    const braceIndex = code.indexOf('{');
    expect(isInsideStringOrComment(code, braceIndex)).toBe(true);
  });

  it('should return false when position is after a closed multi-line comment', () => {
    const code = '/* comment */\nconst x = { value: 1 };';
    const braceIndex = code.indexOf('{');
    expect(isInsideStringOrComment(code, braceIndex)).toBe(false);
  });

  it('should support custom comment syntax (Python)', () => {
    const pythonCommentSyntax: CommentSyntax = {
      lineComment: '#',
      blockCommentStart: '"""',
      blockCommentEnd: '"""',
    };
    const code = 'x = 1  # this is { a comment';
    const braceIndex = code.indexOf('{');
    expect(isInsideStringOrComment(code, braceIndex, pythonCommentSyntax)).toBe(true);
  });

  it('should return false for code outside any comment', () => {
    const code = 'const obj = { key: "value" };';
    const braceIndex = code.indexOf('{');
    expect(isInsideStringOrComment(code, braceIndex)).toBe(false);
  });
});

describe('findIndentationBlockEnd', () => {
  it('should find the end of a Python-style indented block', () => {
    const code = [
      'def foo():',
      '    x = 1',
      '    y = 2',
      '    return x + y',
      '',
      'def bar():',
    ].join('\n');
    const startIndex = 0;
    const result = findIndentationBlockEnd(code, startIndex);
    expect(result).toBe(4); // last line of the block
  });

  it('should handle block that extends to end of file', () => {
    const code = [
      'def foo():',
      '    x = 1',
      '    return x',
    ].join('\n');
    const startIndex = 0;
    const result = findIndentationBlockEnd(code, startIndex);
    expect(result).toBe(3);
  });

  it('should skip empty lines and comments', () => {
    const code = [
      'def foo():',
      '    x = 1',
      '',
      '    # a comment',
      '    return x',
      '',
      'def bar():',
    ].join('\n');
    const startIndex = 0;
    const result = findIndentationBlockEnd(code, startIndex);
    expect(result).toBe(5);
  });

  it('should handle nested indentation blocks', () => {
    const code = [
      'def foo():',
      '    if True:',
      '        x = 1',
      '    return x',
      '',
      'def bar():',
    ].join('\n');
    const startIndex = 0;
    const result = findIndentationBlockEnd(code, startIndex);
    expect(result).toBe(4);
  });
});
