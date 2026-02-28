import { describe, it, expect } from 'vitest';
import { createGuardClause } from '@/domain/models/guard-clause.js';

describe('createGuardClause', () => {
  it('should create a guard clause with required fields and defaults', () => {
    const guard = createGuardClause({
      codeUnitId: 'unit-1',
      guardType: 'early-return',
      condition: 'x === null',
      lineNumber: 5,
    });

    expect(guard.codeUnitId).toBe('unit-1');
    expect(guard.guardType).toBe('early-return');
    expect(guard.condition).toBe('x === null');
    expect(guard.lineNumber).toBe(5);
    expect(guard.id).toBeDefined();
  });

  it('should use provided id when given', () => {
    const guard = createGuardClause({
      id: 'custom-id',
      codeUnitId: 'unit-1',
      guardType: 'throw',
      condition: 'Error',
      lineNumber: 10,
    });

    expect(guard.id).toBe('custom-id');
  });

  it('should throw when codeUnitId is empty', () => {
    expect(() =>
      createGuardClause({
        codeUnitId: '',
        guardType: 'early-return',
        condition: 'x === null',
        lineNumber: 1,
      }),
    ).toThrow('codeUnitId must not be empty');
  });

  it('should throw when guardType is empty', () => {
    expect(() =>
      createGuardClause({
        codeUnitId: 'unit-1',
        guardType: '',
        condition: 'x === null',
        lineNumber: 1,
      }),
    ).toThrow('guardType must not be empty');
  });

  it('should throw when condition is empty', () => {
    expect(() =>
      createGuardClause({
        codeUnitId: 'unit-1',
        guardType: 'early-return',
        condition: '',
        lineNumber: 1,
      }),
    ).toThrow('condition must not be empty');
  });

  it('should throw when lineNumber is less than 1', () => {
    expect(() =>
      createGuardClause({
        codeUnitId: 'unit-1',
        guardType: 'early-return',
        condition: 'x === null',
        lineNumber: 0,
      }),
    ).toThrow('lineNumber must be >= 1');
  });
});
