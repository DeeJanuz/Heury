import { describe, it, expect } from 'vitest';
import { extractGuards } from '@/extraction/guard-extractor.js';

describe('extractGuards', () => {
  describe('early returns', () => {
    it('should extract early return with if condition on same line', () => {
      const body = 'if (items.length === 0) return;';
      const guards = extractGuards(body);
      expect(guards).toHaveLength(1);
      expect(guards[0].guardType).toBe('early-return');
      expect(guards[0].condition).toBe('items.length === 0');
      expect(guards[0].lineNumber).toBe(1);
    });

    it('should extract early return with value on same line', () => {
      const body = 'if (x < 0) return null;';
      const guards = extractGuards(body);
      expect(guards).toHaveLength(1);
      expect(guards[0].guardType).toBe('early-return');
      expect(guards[0].condition).toBe('x < 0');
      expect(guards[0].lineNumber).toBe(1);
    });

    it('should extract early return with complex condition', () => {
      const body = 'if (arr.length === 0) return [];';
      const guards = extractGuards(body);
      expect(guards).toHaveLength(1);
      expect(guards[0].guardType).toBe('early-return');
      expect(guards[0].condition).toBe('arr.length === 0');
    });

    it('should extract multiple early returns', () => {
      const body = [
        'if (!a) return;',
        'if (!b) return;',
        'doWork();',
      ].join('\n');
      const guards = extractGuards(body);
      expect(guards).toHaveLength(2);
      expect(guards[0].lineNumber).toBe(1);
      expect(guards[1].lineNumber).toBe(2);
    });
  });

  describe('throw statements', () => {
    it('should extract throw new Error', () => {
      const body = "throw new Error('something went wrong');";
      const guards = extractGuards(body);
      expect(guards).toHaveLength(1);
      expect(guards[0].guardType).toBe('throw');
      expect(guards[0].errorType).toBe('Error');
      expect(guards[0].lineNumber).toBe(1);
    });

    it('should extract throw new TypeError', () => {
      const body = "throw new TypeError('invalid type');";
      const guards = extractGuards(body);
      expect(guards).toHaveLength(1);
      expect(guards[0].guardType).toBe('throw');
      expect(guards[0].errorType).toBe('TypeError');
    });

    it('should extract throw new CustomError', () => {
      const body = "throw new ValidationError('field is required');";
      const guards = extractGuards(body);
      expect(guards).toHaveLength(1);
      expect(guards[0].guardType).toBe('throw');
      expect(guards[0].errorType).toBe('ValidationError');
    });

    it('should extract throw without new keyword with undefined errorType', () => {
      const body = 'throw createError(404);';
      const guards = extractGuards(body);
      expect(guards).toHaveLength(1);
      expect(guards[0].guardType).toBe('throw');
      expect(guards[0].errorType).toBeUndefined();
    });

    it('should extract throw of a string literal with undefined errorType', () => {
      const body = "throw 'unexpected';";
      const guards = extractGuards(body);
      expect(guards).toHaveLength(1);
      expect(guards[0].guardType).toBe('throw');
      expect(guards[0].errorType).toBeUndefined();
    });
  });

  describe('type guards', () => {
    it('should extract typeof check', () => {
      const body = "if (typeof x === 'string') return x.trim();";
      const guards = extractGuards(body);
      const typeGuard = guards.find(g => g.guardType === 'type-guard');
      expect(typeGuard).toBeDefined();
      expect(typeGuard!.condition).toBe("typeof x === 'string'");
      expect(typeGuard!.lineNumber).toBe(1);
    });

    it('should extract instanceof check', () => {
      const body = 'if (err instanceof TypeError) return;';
      const guards = extractGuards(body);
      const typeGuard = guards.find(g => g.guardType === 'type-guard');
      expect(typeGuard).toBeDefined();
      expect(typeGuard!.condition).toBe('err instanceof TypeError');
    });

    it('should extract null check', () => {
      const body = 'if (x === null) return;';
      const guards = extractGuards(body);
      const typeGuard = guards.find(g => g.guardType === 'type-guard');
      expect(typeGuard).toBeDefined();
      expect(typeGuard!.condition).toBe('x === null');
    });

    it('should extract undefined check', () => {
      const body = 'if (x === undefined) return;';
      const guards = extractGuards(body);
      const typeGuard = guards.find(g => g.guardType === 'type-guard');
      expect(typeGuard).toBeDefined();
      expect(typeGuard!.condition).toBe('x === undefined');
    });

    it('should extract negation null check pattern', () => {
      const body = 'if (!x) return;';
      const guards = extractGuards(body);
      const typeGuard = guards.find(g => g.guardType === 'type-guard');
      expect(typeGuard).toBeDefined();
      expect(typeGuard!.condition).toBe('!x');
    });

    it('should extract typeof with double equals', () => {
      const body = "if (typeof val == 'number') return val;";
      const guards = extractGuards(body);
      const typeGuard = guards.find(g => g.guardType === 'type-guard');
      expect(typeGuard).toBeDefined();
      expect(typeGuard!.condition).toBe("typeof val == 'number'");
    });
  });

  describe('assertions', () => {
    it('should extract assert() call', () => {
      const body = 'assert(condition);';
      const guards = extractGuards(body);
      expect(guards).toHaveLength(1);
      expect(guards[0].guardType).toBe('assertion');
      expect(guards[0].lineNumber).toBe(1);
    });

    it('should extract console.assert() call', () => {
      const body = "console.assert(x > 0, 'x must be positive');";
      const guards = extractGuards(body);
      expect(guards).toHaveLength(1);
      expect(guards[0].guardType).toBe('assertion');
    });

    it('should skip expect() calls (test assertions)', () => {
      const body = "expect(result).toBe(42);";
      const guards = extractGuards(body);
      expect(guards).toHaveLength(0);
    });

    it('should skip expect() even among other guards', () => {
      const body = [
        'assert(valid);',
        'expect(result).toBe(42);',
        "throw new Error('fail');",
      ].join('\n');
      const guards = extractGuards(body);
      expect(guards).toHaveLength(2);
      expect(guards[0].guardType).toBe('assertion');
      expect(guards[1].guardType).toBe('throw');
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty input', () => {
      const guards = extractGuards('');
      expect(guards).toHaveLength(0);
    });

    it('should skip comment lines with guard-like patterns', () => {
      const body = [
        '// if (!x) return;',
        '/* throw new Error("not real"); */',
        'doWork();',
      ].join('\n');
      const guards = extractGuards(body);
      expect(guards).toHaveLength(0);
    });

    it('should skip single-line comment at start of line', () => {
      const body = '// throw new Error("commented out");';
      const guards = extractGuards(body);
      expect(guards).toHaveLength(0);
    });

    it('should not skip guard on line with trailing comment', () => {
      const body = 'if (!x) return; // guard clause';
      const guards = extractGuards(body);
      expect(guards).toHaveLength(1);
    });
  });

  describe('line numbers', () => {
    it('should report correct 1-based line numbers', () => {
      const body = [
        'const a = 1;',
        'if (!a) return;',
        'const b = 2;',
        "throw new Error('fail');",
      ].join('\n');
      const guards = extractGuards(body);
      expect(guards).toHaveLength(2);
      expect(guards[0].lineNumber).toBe(2);
      expect(guards[1].lineNumber).toBe(4);
    });

    it('should handle line numbers with blank lines', () => {
      const body = [
        '',
        '',
        'if (!x) return;',
        '',
        "throw new Error('oops');",
      ].join('\n');
      const guards = extractGuards(body);
      expect(guards).toHaveLength(2);
      expect(guards[0].lineNumber).toBe(3);
      expect(guards[1].lineNumber).toBe(5);
    });
  });

  describe('mixed patterns', () => {
    it('should extract all guard types from a realistic function body', () => {
      const body = [
        'assert(config);',
        "if (typeof input !== 'string') return;",
        'if (!input) return null;',
        'if (input.length === 0) return [];',
        "throw new ValidationError('bad input');",
      ].join('\n');
      const guards = extractGuards(body);
      expect(guards).toHaveLength(5);

      expect(guards[0].guardType).toBe('assertion');
      expect(guards[0].lineNumber).toBe(1);

      expect(guards[1].guardType).toBe('type-guard');
      expect(guards[1].lineNumber).toBe(2);

      expect(guards[2].guardType).toBe('type-guard');
      expect(guards[2].lineNumber).toBe(3);

      expect(guards[3].guardType).toBe('early-return');
      expect(guards[3].lineNumber).toBe(4);

      expect(guards[4].guardType).toBe('throw');
      expect(guards[4].errorType).toBe('ValidationError');
      expect(guards[4].lineNumber).toBe(5);
    });

    it('should handle type-guard with early-return on same line', () => {
      const body = 'if (x === null) return;';
      const guards = extractGuards(body);
      // Should be classified as type-guard (more specific) not early-return
      expect(guards).toHaveLength(1);
      expect(guards[0].guardType).toBe('type-guard');
    });

    it('should handle typeof guard with early-return on same line', () => {
      const body = "if (typeof x === 'string') return x;";
      const guards = extractGuards(body);
      // Type-guard takes precedence
      expect(guards).toHaveLength(1);
      expect(guards[0].guardType).toBe('type-guard');
    });
  });
});
