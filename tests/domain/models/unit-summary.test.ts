import { describe, it, expect } from 'vitest';
import { createUnitSummary } from '@/domain/models/unit-summary.js';

describe('createUnitSummary', () => {
  it('should create a unit summary with required fields and defaults', () => {
    const summary = createUnitSummary({
      codeUnitId: 'unit-1',
      summary: 'Handles user authentication',
      providerModel: 'gpt-4',
      generatedAt: '2024-01-15T10:00:00Z',
    });

    expect(summary.codeUnitId).toBe('unit-1');
    expect(summary.summary).toBe('Handles user authentication');
    expect(summary.providerModel).toBe('gpt-4');
    expect(summary.generatedAt).toBe('2024-01-15T10:00:00Z');
    expect(summary.keyBehaviors).toEqual([]);
    expect(summary.sideEffects).toEqual([]);
    expect(summary.id).toBeDefined();
  });

  it('should use provided id when given', () => {
    const summary = createUnitSummary({
      id: 'custom-id',
      codeUnitId: 'unit-1',
      summary: 'Test summary',
      providerModel: 'gpt-4',
      generatedAt: '2024-01-15T10:00:00Z',
    });

    expect(summary.id).toBe('custom-id');
  });

  it('should include optional arrays when provided', () => {
    const summary = createUnitSummary({
      codeUnitId: 'unit-1',
      summary: 'Processes orders',
      keyBehaviors: ['validates input', 'sends notification'],
      sideEffects: ['writes to database', 'sends email'],
      providerModel: 'claude-3',
      generatedAt: '2024-01-15T10:00:00Z',
    });

    expect(summary.keyBehaviors).toEqual(['validates input', 'sends notification']);
    expect(summary.sideEffects).toEqual(['writes to database', 'sends email']);
  });

  it('should throw when codeUnitId is empty', () => {
    expect(() =>
      createUnitSummary({
        codeUnitId: '',
        summary: 'Test',
        providerModel: 'gpt-4',
        generatedAt: '2024-01-15T10:00:00Z',
      }),
    ).toThrow('codeUnitId must not be empty');
  });

  it('should throw when summary is empty', () => {
    expect(() =>
      createUnitSummary({
        codeUnitId: 'unit-1',
        summary: '',
        providerModel: 'gpt-4',
        generatedAt: '2024-01-15T10:00:00Z',
      }),
    ).toThrow('summary must not be empty');
  });

  it('should throw when providerModel is empty', () => {
    expect(() =>
      createUnitSummary({
        codeUnitId: 'unit-1',
        summary: 'Test',
        providerModel: '',
        generatedAt: '2024-01-15T10:00:00Z',
      }),
    ).toThrow('providerModel must not be empty');
  });

  it('should throw when generatedAt is empty', () => {
    expect(() =>
      createUnitSummary({
        codeUnitId: 'unit-1',
        summary: 'Test',
        providerModel: 'gpt-4',
        generatedAt: '',
      }),
    ).toThrow('generatedAt must not be empty');
  });
});
