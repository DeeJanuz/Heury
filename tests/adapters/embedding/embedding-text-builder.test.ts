import { describe, it, expect } from 'vitest';
import { buildEmbeddingText } from '@/adapters/embedding/embedding-text-builder.js';
import {
  createCodeUnit,
  CodeUnitType,
  PatternType,
  createCodeUnitPattern,
} from '@/domain/models/index.js';

function makeUnit(overrides: Partial<Parameters<typeof createCodeUnit>[0]> = {}) {
  const defaults = {
    id: 'unit-1',
    filePath: 'src/routes/users.ts',
    name: 'getUsers',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 10,
    lineEnd: 30,
    isAsync: true,
    isExported: true,
    language: 'typescript',
    complexityScore: 22,
    patterns: [] as ReturnType<typeof createCodeUnitPattern>[],
    children: [],
  };
  return createCodeUnit({ ...defaults, ...overrides });
}

describe('buildEmbeddingText', () => {
  it('includes function name and file path', () => {
    const unit = makeUnit();
    const text = buildEmbeddingText(unit);
    expect(text).toContain('getUsers');
    expect(text).toContain('src/routes/users.ts');
  });

  it('includes async and exported flags', () => {
    const unit = makeUnit({ isAsync: true, isExported: true });
    const text = buildEmbeddingText(unit);
    expect(text).toContain('async');
    expect(text).toContain('exported');
  });

  it('includes pattern summaries', () => {
    const unit = makeUnit({
      patterns: [
        createCodeUnitPattern({
          codeUnitId: 'unit-1',
          patternType: PatternType.API_ENDPOINT,
          patternValue: '/api/users',
        }),
        createCodeUnitPattern({
          codeUnitId: 'unit-1',
          patternType: PatternType.DATABASE_READ,
          patternValue: 'prisma.user.findMany',
        }),
      ],
    });
    const text = buildEmbeddingText(unit);
    expect(text).toContain('API_ENDPOINT');
    expect(text).toContain('/api/users');
    expect(text).toContain('DATABASE_READ');
    expect(text).toContain('prisma.user.findMany');
  });

  it('includes complexity level', () => {
    const unit = makeUnit({ complexityScore: 22 });
    const text = buildEmbeddingText(unit);
    expect(text).toContain('moderate');
  });

  it('handles unit with no patterns', () => {
    const unit = makeUnit({ patterns: [] });
    const text = buildEmbeddingText(unit);
    expect(text).not.toContain('Patterns:');
    expect(text).toContain('getUsers');
  });

  it('includes summary when provided', () => {
    const unit = makeUnit();
    const text = buildEmbeddingText(unit, 'Retrieves all users from the database');
    expect(text).toContain('Summary: Retrieves all users from the database');
  });

  it('does not include summary line when summary is undefined', () => {
    const unit = makeUnit();
    const text = buildEmbeddingText(unit);
    expect(text).not.toContain('Summary:');
  });

  it('does not include summary line when summary is empty string', () => {
    const unit = makeUnit();
    const text = buildEmbeddingText(unit, '');
    expect(text).not.toContain('Summary:');
  });
});
