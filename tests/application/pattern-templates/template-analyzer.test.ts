import { describe, it, expect } from 'vitest';

import { detectPatternTemplates } from '@/application/pattern-templates/template-analyzer.js';
import type { PatternTemplate } from '@/application/pattern-templates/template-analyzer.js';
import {
  createCodeUnit,
  createCodeUnitPattern,
  CodeUnitType,
  PatternType,
} from '@/domain/models/index.js';
import type { CodeUnit } from '@/domain/models/index.js';

function makeUnit(overrides: Partial<Parameters<typeof createCodeUnit>[0]> & { id: string; name: string; filePath: string }): CodeUnit {
  return createCodeUnit({
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 10,
    isAsync: false,
    isExported: false,
    language: 'typescript',
    complexityScore: 5,
    ...overrides,
  });
}

function makePattern(codeUnitId: string, patternType: PatternType, patternValue = 'value') {
  return createCodeUnitPattern({ codeUnitId, patternType, patternValue });
}

describe('detectPatternTemplates', () => {
  it('should return empty array for empty input', () => {
    const result = detectPatternTemplates([]);
    expect(result).toEqual([]);
  });

  it('should return empty array when units have no patterns', () => {
    const units = [
      makeUnit({ id: 'u1', name: 'fn1', filePath: 'a.ts' }),
      makeUnit({ id: 'u2', name: 'fn2', filePath: 'b.ts' }),
      makeUnit({ id: 'u3', name: 'fn3', filePath: 'c.ts' }),
    ];
    const result = detectPatternTemplates(units);
    expect(result).toEqual([]);
  });

  it('should return empty array when pattern combos have fewer than 3 members', () => {
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        patterns: [makePattern('u1', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        patterns: [makePattern('u2', PatternType.API_ENDPOINT)],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result).toEqual([]);
  });

  it('should detect a convention when 3+ units share the same pattern combo', () => {
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        patterns: [makePattern('u1', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        patterns: [makePattern('u2', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'c.ts',
        patterns: [makePattern('u3', PatternType.API_ENDPOINT)],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result).toHaveLength(1);
    expect(result[0].patternTypes).toEqual(['API_ENDPOINT']);
  });

  it('should select unit with lower complexity as template', () => {
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        complexityScore: 10,
        patterns: [makePattern('u1', PatternType.DATABASE_WRITE)],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        complexityScore: 2,
        patterns: [makePattern('u2', PatternType.DATABASE_WRITE)],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'c.ts',
        complexityScore: 8,
        patterns: [makePattern('u3', PatternType.DATABASE_WRITE)],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result).toHaveLength(1);
    expect(result[0].templateUnitId).toBe('u2');
    expect(result[0].templateFilePath).toBe('b.ts');
  });

  it('should prefer exported unit as template', () => {
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        complexityScore: 5,
        isExported: false,
        patterns: [makePattern('u1', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        complexityScore: 5,
        isExported: true,
        patterns: [makePattern('u2', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'c.ts',
        complexityScore: 5,
        isExported: false,
        patterns: [makePattern('u3', PatternType.API_ENDPOINT)],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result[0].templateUnitId).toBe('u2');
  });

  it('should prefer unit with signature as template', () => {
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        complexityScore: 5,
        patterns: [makePattern('u1', PatternType.DATABASE_READ)],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        complexityScore: 5,
        signature: 'fn2(x: string): void',
        patterns: [makePattern('u2', PatternType.DATABASE_READ)],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'c.ts',
        complexityScore: 5,
        patterns: [makePattern('u3', PatternType.DATABASE_READ)],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result[0].templateUnitId).toBe('u2');
  });

  it('should correctly identify followers excluding the template unit', () => {
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        complexityScore: 1,
        patterns: [makePattern('u1', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        complexityScore: 5,
        patterns: [makePattern('u2', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'c.ts',
        complexityScore: 9,
        patterns: [makePattern('u3', PatternType.API_ENDPOINT)],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result[0].templateUnitId).toBe('u1');
    expect(result[0].followers).toEqual([
      { filePath: 'b.ts', unitName: 'fn2' },
      { filePath: 'c.ts', unitName: 'fn3' },
    ]);
  });

  it('should have followerCount matching followers length', () => {
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        patterns: [makePattern('u1', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        patterns: [makePattern('u2', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'c.ts',
        patterns: [makePattern('u3', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u4',
        name: 'fn4',
        filePath: 'd.ts',
        patterns: [makePattern('u4', PatternType.API_ENDPOINT)],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result[0].followerCount).toBe(result[0].followers.length);
    expect(result[0].followerCount).toBe(3);
  });

  it('should derive name from pattern types', () => {
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        patterns: [
          makePattern('u1', PatternType.API_ENDPOINT),
          makePattern('u1', PatternType.DATABASE_WRITE),
        ],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        patterns: [
          makePattern('u2', PatternType.API_ENDPOINT),
          makePattern('u2', PatternType.DATABASE_WRITE),
        ],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'c.ts',
        patterns: [
          makePattern('u3', PatternType.API_ENDPOINT),
          makePattern('u3', PatternType.DATABASE_WRITE),
        ],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result[0].name).toContain('Api Endpoint');
    expect(result[0].name).toContain('Database Write');
  });

  it('should include count in description', () => {
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        patterns: [makePattern('u1', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        patterns: [makePattern('u2', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'c.ts',
        patterns: [makePattern('u3', PatternType.API_ENDPOINT)],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result[0].description).toContain('3');
  });

  it('should detect multiple conventions for different combos', () => {
    const units = [
      // Group A: API_ENDPOINT (3 members)
      makeUnit({
        id: 'a1',
        name: 'apiA',
        filePath: 'a1.ts',
        patterns: [makePattern('a1', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'a2',
        name: 'apiB',
        filePath: 'a2.ts',
        patterns: [makePattern('a2', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'a3',
        name: 'apiC',
        filePath: 'a3.ts',
        patterns: [makePattern('a3', PatternType.API_ENDPOINT)],
      }),
      // Group B: DATABASE_WRITE (4 members)
      makeUnit({
        id: 'b1',
        name: 'dbA',
        filePath: 'b1.ts',
        patterns: [makePattern('b1', PatternType.DATABASE_WRITE)],
      }),
      makeUnit({
        id: 'b2',
        name: 'dbB',
        filePath: 'b2.ts',
        patterns: [makePattern('b2', PatternType.DATABASE_WRITE)],
      }),
      makeUnit({
        id: 'b3',
        name: 'dbC',
        filePath: 'b3.ts',
        patterns: [makePattern('b3', PatternType.DATABASE_WRITE)],
      }),
      makeUnit({
        id: 'b4',
        name: 'dbD',
        filePath: 'b4.ts',
        patterns: [makePattern('b4', PatternType.DATABASE_WRITE)],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result).toHaveLength(2);
  });

  it('should sort results by followerCount descending', () => {
    const units = [
      // Group A: API_ENDPOINT (3 members -> 2 followers)
      makeUnit({
        id: 'a1',
        name: 'apiA',
        filePath: 'a1.ts',
        patterns: [makePattern('a1', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'a2',
        name: 'apiB',
        filePath: 'a2.ts',
        patterns: [makePattern('a2', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'a3',
        name: 'apiC',
        filePath: 'a3.ts',
        patterns: [makePattern('a3', PatternType.API_ENDPOINT)],
      }),
      // Group B: DATABASE_WRITE (5 members -> 4 followers)
      makeUnit({
        id: 'b1',
        name: 'dbA',
        filePath: 'b1.ts',
        patterns: [makePattern('b1', PatternType.DATABASE_WRITE)],
      }),
      makeUnit({
        id: 'b2',
        name: 'dbB',
        filePath: 'b2.ts',
        patterns: [makePattern('b2', PatternType.DATABASE_WRITE)],
      }),
      makeUnit({
        id: 'b3',
        name: 'dbC',
        filePath: 'b3.ts',
        patterns: [makePattern('b3', PatternType.DATABASE_WRITE)],
      }),
      makeUnit({
        id: 'b4',
        name: 'dbD',
        filePath: 'b4.ts',
        patterns: [makePattern('b4', PatternType.DATABASE_WRITE)],
      }),
      makeUnit({
        id: 'b5',
        name: 'dbE',
        filePath: 'b5.ts',
        patterns: [makePattern('b5', PatternType.DATABASE_WRITE)],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result[0].followerCount).toBeGreaterThan(result[1].followerCount);
    expect(result[0].patternTypes).toEqual(['DATABASE_WRITE']);
    expect(result[1].patternTypes).toEqual(['API_ENDPOINT']);
  });

  it('should detect single-pattern conventions with 3+ members', () => {
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        patterns: [makePattern('u1', PatternType.EXTERNAL_SERVICE)],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        patterns: [makePattern('u2', PatternType.EXTERNAL_SERVICE)],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'c.ts',
        patterns: [makePattern('u3', PatternType.EXTERNAL_SERVICE)],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result).toHaveLength(1);
    expect(result[0].patternTypes).toEqual(['EXTERNAL_SERVICE']);
  });

  it('should produce deterministic output with stable sort by file path', () => {
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'z.ts',
        complexityScore: 5,
        patterns: [makePattern('u1', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'a.ts',
        complexityScore: 5,
        patterns: [makePattern('u2', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'm.ts',
        complexityScore: 5,
        patterns: [makePattern('u3', PatternType.API_ENDPOINT)],
      }),
    ];

    // Run multiple times to verify determinism
    const result1 = detectPatternTemplates(units);
    const result2 = detectPatternTemplates(units);
    expect(result1[0].templateUnitId).toBe(result2[0].templateUnitId);
    // With equal scores, alphabetical file path wins: a.ts
    expect(result1[0].templateFilePath).toBe('a.ts');
  });

  it('should generate conventions array from pattern types', () => {
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        patterns: [
          makePattern('u1', PatternType.API_ENDPOINT),
          makePattern('u1', PatternType.DATABASE_WRITE),
        ],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        patterns: [
          makePattern('u2', PatternType.API_ENDPOINT),
          makePattern('u2', PatternType.DATABASE_WRITE),
        ],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'c.ts',
        patterns: [
          makePattern('u3', PatternType.API_ENDPOINT),
          makePattern('u3', PatternType.DATABASE_WRITE),
        ],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result[0].conventions.length).toBeGreaterThanOrEqual(1);
    expect(result[0].conventions.every((c) => typeof c === 'string')).toBe(true);
  });

  it('should have a valid id on each template', () => {
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        patterns: [makePattern('u1', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        patterns: [makePattern('u2', PatternType.API_ENDPOINT)],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'c.ts',
        patterns: [makePattern('u3', PatternType.API_ENDPOINT)],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result[0].id).toBeDefined();
    expect(typeof result[0].id).toBe('string');
    expect(result[0].id.length).toBeGreaterThan(0);
  });

  it('should handle multi-pattern combo grouping with sorted keys', () => {
    // Same patterns in different order should group together
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        patterns: [
          makePattern('u1', PatternType.DATABASE_WRITE),
          makePattern('u1', PatternType.API_ENDPOINT),
        ],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        patterns: [
          makePattern('u2', PatternType.API_ENDPOINT),
          makePattern('u2', PatternType.DATABASE_WRITE),
        ],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'c.ts',
        patterns: [
          makePattern('u3', PatternType.DATABASE_WRITE),
          makePattern('u3', PatternType.API_ENDPOINT),
        ],
      }),
    ];
    const result = detectPatternTemplates(units);
    // Should be grouped into one convention despite different ordering
    expect(result).toHaveLength(1);
    expect(result[0].patternTypes).toEqual(['API_ENDPOINT', 'DATABASE_WRITE']);
  });

  it('should prefer unit with more patterns as template when other scores tie', () => {
    // This tests the scoring: having more patterns scores better
    // All units have the same pattern *types* combo, but u2 has an extra pattern instance
    // Actually, "more patterns" in the spec means more pattern count — but the grouping is by unique pattern types.
    // The spec says "Having more patterns scores better (more representative)"
    // Since all units in a group share the same pattern types, this means units with more pattern instances score better.
    const units = [
      makeUnit({
        id: 'u1',
        name: 'fn1',
        filePath: 'a.ts',
        complexityScore: 5,
        patterns: [makePattern('u1', PatternType.API_ENDPOINT, 'GET /a')],
      }),
      makeUnit({
        id: 'u2',
        name: 'fn2',
        filePath: 'b.ts',
        complexityScore: 5,
        patterns: [
          makePattern('u2', PatternType.API_ENDPOINT, 'GET /b'),
          makePattern('u2', PatternType.API_ENDPOINT, 'POST /b'),
        ],
      }),
      makeUnit({
        id: 'u3',
        name: 'fn3',
        filePath: 'c.ts',
        complexityScore: 5,
        patterns: [makePattern('u3', PatternType.API_ENDPOINT, 'GET /c')],
      }),
    ];
    const result = detectPatternTemplates(units);
    expect(result[0].templateUnitId).toBe('u2');
  });
});
