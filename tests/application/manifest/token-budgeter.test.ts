import { describe, it, expect } from 'vitest';

import {
  estimateTokens,
  allocateBudget,
  truncateToTokenBudget,
  fitSections,
} from '@/application/manifest/token-budgeter.js';
import type { Section } from '@/application/manifest/token-budgeter.js';

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

  describe('fitSections', () => {
    const header = '# Modules';

    it('should return header plus all sections when everything fits', () => {
      const sections: Section[] = [
        { content: 'Section A', score: 5 },
        { content: 'Section B', score: 3 },
      ];
      const result = fitSections(header, sections, 1000);
      expect(result).toContain(header);
      expect(result).toContain('Section A');
      expect(result).toContain('Section B');
      expect(result).not.toContain('more files available via MCP tools');
    });

    it('should omit low-scored sections that exceed budget and show omission count', () => {
      const sections: Section[] = [
        { content: 'a'.repeat(40), score: 10 },  // 10 tokens
        { content: 'b'.repeat(40), score: 5 },   // 10 tokens
        { content: 'c'.repeat(40), score: 1 },   // 10 tokens
      ];
      // header "# Modules" = 9 chars ~2 tokens
      // budget enough for header + 2 sections but not 3
      const headerTokens = estimateTokens(header);
      const sectionTokens = 10;
      const omissionLine = '\n_1 more files available via MCP tools_';
      const omissionTokens = estimateTokens(omissionLine);
      const budget = headerTokens + sectionTokens * 2 + omissionTokens;

      const result = fitSections(header, sections, budget);
      expect(result).toContain(header);
      expect(result).toContain('a'.repeat(40));
      expect(result).toContain('b'.repeat(40));
      expect(result).not.toContain('c'.repeat(40));
      expect(result).toContain('1 more files available via MCP tools');
    });

    it('should return just the header when sections array is empty', () => {
      const result = fitSections(header, [], 1000);
      expect(result).toBe(header);
    });

    it('should sort sections by score descending', () => {
      const sections: Section[] = [
        { content: 'Low', score: 1 },
        { content: 'High', score: 10 },
        { content: 'Mid', score: 5 },
      ];
      const result = fitSections(header, sections, 1000);
      const highIdx = result.indexOf('High');
      const midIdx = result.indexOf('Mid');
      const lowIdx = result.indexOf('Low');
      expect(highIdx).toBeLessThan(midIdx);
      expect(midIdx).toBeLessThan(lowIdx);
    });

    it('should use stable sort for equal-scored sections (preserve insertion order)', () => {
      const sections: Section[] = [
        { content: 'First', score: 5 },
        { content: 'Second', score: 5 },
        { content: 'Third', score: 5 },
      ];
      const result = fitSections(header, sections, 1000);
      const firstIdx = result.indexOf('First');
      const secondIdx = result.indexOf('Second');
      const thirdIdx = result.indexOf('Third');
      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(thirdIdx);
    });

    it('should bin-pack: skip large section and include smaller ones that fit', () => {
      const sections: Section[] = [
        { content: 'a'.repeat(80), score: 10 },   // 20 tokens - fits
        { content: 'b'.repeat(200), score: 8 },   // 50 tokens - too big
        { content: 'c'.repeat(40), score: 6 },    // 10 tokens - fits
      ];
      // Budget for header + ~35 tokens of content + omission line
      const headerTokens = estimateTokens(header);
      const omissionLine = '\n_1 more files available via MCP tools_';
      const omissionTokens = estimateTokens(omissionLine);
      const budget = headerTokens + 20 + 10 + omissionTokens;

      const result = fitSections(header, sections, budget);
      expect(result).toContain('a'.repeat(80));
      expect(result).not.toContain('b'.repeat(200));
      expect(result).toContain('c'.repeat(40));
      expect(result).toContain('1 more files available via MCP tools');
    });

    it('should return truncated header when header alone exceeds budget', () => {
      const longHeader = 'x'.repeat(400); // 100 tokens
      const sections: Section[] = [
        { content: 'Section A', score: 5 },
      ];
      const result = fitSections(longHeader, sections, 10); // 10 tokens = 40 chars
      expect(result.length).toBeLessThanOrEqual(40);
    });

    it('should show correct count of omitted sections', () => {
      const sections: Section[] = [
        { content: 'a'.repeat(40), score: 10 },
        { content: 'b'.repeat(40), score: 8 },
        { content: 'c'.repeat(40), score: 6 },
        { content: 'd'.repeat(40), score: 4 },
        { content: 'e'.repeat(40), score: 2 },
      ];
      // Budget for header + 1 section + omission
      const headerTokens = estimateTokens(header);
      const omissionLine = '\n_4 more files available via MCP tools_';
      const omissionTokens = estimateTokens(omissionLine);
      const budget = headerTokens + 10 + omissionTokens;

      const result = fitSections(header, sections, budget);
      expect(result).toContain('4 more files available via MCP tools');
    });
  });
});
