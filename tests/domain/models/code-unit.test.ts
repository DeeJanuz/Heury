import { describe, it, expect } from 'vitest';
import {
  CodeUnitType,
  createCodeUnit,
  type CodeUnit,
} from '@/domain/models/code-unit.js';
import { PatternType } from '@/domain/models/code-unit-pattern.js';

describe('CodeUnitType enum', () => {
  it('should have all expected unit types', () => {
    expect(CodeUnitType.MODULE).toBe('MODULE');
    expect(CodeUnitType.FUNCTION).toBe('FUNCTION');
    expect(CodeUnitType.ARROW_FUNCTION).toBe('ARROW_FUNCTION');
    expect(CodeUnitType.CLASS).toBe('CLASS');
    expect(CodeUnitType.METHOD).toBe('METHOD');
    expect(CodeUnitType.STRUCT).toBe('STRUCT');
    expect(CodeUnitType.TRAIT).toBe('TRAIT');
    expect(CodeUnitType.INTERFACE).toBe('INTERFACE');
    expect(CodeUnitType.ENUM).toBe('ENUM');
    expect(CodeUnitType.IMPL_BLOCK).toBe('IMPL_BLOCK');
  });

  it('should have exactly 10 members', () => {
    const values = Object.values(CodeUnitType);
    expect(values).toHaveLength(10);
  });
});

describe('createCodeUnit', () => {
  it('should create a code unit with required fields and defaults', () => {
    const unit = createCodeUnit({
      filePath: 'src/index.ts',
      name: 'main',
      unitType: CodeUnitType.FUNCTION,
      lineStart: 1,
      lineEnd: 10,
      isAsync: false,
      isExported: true,
      language: 'typescript',
    });

    expect(unit.filePath).toBe('src/index.ts');
    expect(unit.name).toBe('main');
    expect(unit.unitType).toBe(CodeUnitType.FUNCTION);
    expect(unit.lineStart).toBe(1);
    expect(unit.lineEnd).toBe(10);
    expect(unit.isAsync).toBe(false);
    expect(unit.isExported).toBe(true);
    expect(unit.language).toBe('typescript');
    expect(unit.id).toBeDefined();
    expect(unit.patterns).toEqual([]);
    expect(unit.children).toEqual([]);
    expect(unit.complexity).toEqual({});
    expect(unit.complexityScore).toBe(0);
  });

  it('should use provided id when given', () => {
    const unit = createCodeUnit({
      id: 'custom-id',
      filePath: 'src/index.ts',
      name: 'main',
      unitType: CodeUnitType.FUNCTION,
      lineStart: 1,
      lineEnd: 10,
      isAsync: false,
      isExported: false,
      language: 'typescript',
    });

    expect(unit.id).toBe('custom-id');
  });

  it('should include optional fields when provided', () => {
    const unit = createCodeUnit({
      filePath: 'src/index.ts',
      name: 'helper',
      unitType: CodeUnitType.METHOD,
      lineStart: 5,
      lineEnd: 20,
      isAsync: true,
      isExported: false,
      language: 'typescript',
      parentUnitId: 'parent-123',
      signature: 'helper(x: number): string',
    });

    expect(unit.parentUnitId).toBe('parent-123');
    expect(unit.signature).toBe('helper(x: number): string');
  });

  it('should throw when filePath is empty', () => {
    expect(() =>
      createCodeUnit({
        filePath: '',
        name: 'main',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 10,
        isAsync: false,
        isExported: false,
        language: 'typescript',
      })
    ).toThrow();
  });

  it('should throw when name is empty', () => {
    expect(() =>
      createCodeUnit({
        filePath: 'src/index.ts',
        name: '',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 10,
        isAsync: false,
        isExported: false,
        language: 'typescript',
      })
    ).toThrow();
  });

  it('should throw when lineStart is less than 1', () => {
    expect(() =>
      createCodeUnit({
        filePath: 'src/index.ts',
        name: 'main',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 0,
        lineEnd: 10,
        isAsync: false,
        isExported: false,
        language: 'typescript',
      })
    ).toThrow();
  });

  it('should throw when lineEnd is less than lineStart', () => {
    expect(() =>
      createCodeUnit({
        filePath: 'src/index.ts',
        name: 'main',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 10,
        lineEnd: 5,
        isAsync: false,
        isExported: false,
        language: 'typescript',
      })
    ).toThrow();
  });
});
