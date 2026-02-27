import { describe, it, expect } from 'vitest';
import {
  PatternType,
  createCodeUnitPattern,
  type CodeUnitPattern,
} from '@/domain/models/code-unit-pattern.js';

describe('PatternType enum', () => {
  it('should have all expected pattern types', () => {
    expect(PatternType.API_ENDPOINT).toBe('API_ENDPOINT');
    expect(PatternType.API_CALL).toBe('API_CALL');
    expect(PatternType.DATABASE_READ).toBe('DATABASE_READ');
    expect(PatternType.DATABASE_WRITE).toBe('DATABASE_WRITE');
    expect(PatternType.EXTERNAL_SERVICE).toBe('EXTERNAL_SERVICE');
    expect(PatternType.ENV_VARIABLE).toBe('ENV_VARIABLE');
    expect(PatternType.IMPORT).toBe('IMPORT');
    expect(PatternType.EXPORT).toBe('EXPORT');
  });

  it('should have exactly 8 members', () => {
    const values = Object.values(PatternType);
    expect(values).toHaveLength(8);
  });
});

describe('createCodeUnitPattern', () => {
  it('should create a pattern with all required fields', () => {
    const pattern = createCodeUnitPattern({
      codeUnitId: 'unit-123',
      patternType: PatternType.API_ENDPOINT,
      patternValue: 'GET /api/users',
    });

    expect(pattern.codeUnitId).toBe('unit-123');
    expect(pattern.patternType).toBe(PatternType.API_ENDPOINT);
    expect(pattern.patternValue).toBe('GET /api/users');
    expect(pattern.id).toBeDefined();
    expect(typeof pattern.id).toBe('string');
  });

  it('should use provided id when given', () => {
    const pattern = createCodeUnitPattern({
      id: 'my-id',
      codeUnitId: 'unit-123',
      patternType: PatternType.IMPORT,
      patternValue: 'lodash',
    });

    expect(pattern.id).toBe('my-id');
  });

  it('should include optional fields when provided', () => {
    const pattern = createCodeUnitPattern({
      codeUnitId: 'unit-123',
      patternType: PatternType.DATABASE_READ,
      patternValue: 'SELECT * FROM users',
      lineNumber: 42,
      columnAccess: { read: ['name', 'email'], write: [] },
    });

    expect(pattern.lineNumber).toBe(42);
    expect(pattern.columnAccess).toEqual({ read: ['name', 'email'], write: [] });
  });

  it('should throw when codeUnitId is empty', () => {
    expect(() =>
      createCodeUnitPattern({
        codeUnitId: '',
        patternType: PatternType.IMPORT,
        patternValue: 'lodash',
      })
    ).toThrow();
  });

  it('should throw when patternValue is empty', () => {
    expect(() =>
      createCodeUnitPattern({
        codeUnitId: 'unit-123',
        patternType: PatternType.IMPORT,
        patternValue: '',
      })
    ).toThrow();
  });
});
