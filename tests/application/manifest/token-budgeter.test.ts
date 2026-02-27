import { describe, it, expect } from 'vitest';

import {
  estimateTokens,
  allocateBudget,
  truncateToTokenBudget,
} from '@/application/manifest/token-budgeter.js';

describe('token-budgeter', () => {
  describe('estimateTokens', () => {
    it('should return approximately text.length / 4', () => {
      const text = 'a'.repeat(400);
      expect(estimateTokens(text)).toBe(100);
    });

    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('allocateBudget', () => {
    it('should split 30/30/20/20 for default total', () => {
      const budget = allocateBudget(5000);
      expect(budget.modules).toBe(1500);
      expect(budget.patterns).toBe(1500);
      expect(budget.dependencies).toBe(1000);
      expect(budget.hotspots).toBe(1000);
    });

    it('should work with custom total budget', () => {
      const budget = allocateBudget(10000);
      expect(budget.modules).toBe(3000);
      expect(budget.patterns).toBe(3000);
      expect(budget.dependencies).toBe(2000);
      expect(budget.hotspots).toBe(2000);
    });

    it('should floor fractional token counts', () => {
      const budget = allocateBudget(100);
      expect(budget.modules).toBe(30);
      expect(budget.patterns).toBe(30);
      expect(budget.dependencies).toBe(20);
      expect(budget.hotspots).toBe(20);
    });
  });

  describe('truncateToTokenBudget', () => {
    it('should preserve content that fits within budget', () => {
      const text = 'short text';
      expect(truncateToTokenBudget(text, 1000)).toBe(text);
    });

    it('should truncate content that exceeds budget', () => {
      const text = 'a'.repeat(800); // ~200 tokens
      const result = truncateToTokenBudget(text, 50); // 50 tokens = ~200 chars
      expect(estimateTokens(result)).toBeLessThanOrEqual(50);
      expect(result.length).toBeLessThan(text.length);
    });

    it('should truncate at line boundaries when possible', () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
      const text = lines.join('\n');
      const result = truncateToTokenBudget(text, 10); // very small budget
      // Result should end with a complete line (no partial lines)
      const resultLines = result.split('\n');
      expect(resultLines[resultLines.length - 1]).toMatch(/^line \d+$/);
    });
  });
});
