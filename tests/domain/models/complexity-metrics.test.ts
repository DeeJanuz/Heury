import { describe, it, expect } from 'vitest';
import {
  calculateComplexityScore,
  getComplexityLevel,
  createEmptyMetrics,
  type ComplexityMetrics,
} from '@/domain/models/complexity-metrics.js';

describe('createEmptyMetrics', () => {
  it('should return all-zero metrics', () => {
    const metrics = createEmptyMetrics();
    expect(metrics.conditionals).toBe(0);
    expect(metrics.loops).toBe(0);
    expect(metrics.maxNestingDepth).toBe(0);
    expect(metrics.tryCatchBlocks).toBe(0);
    expect(metrics.asyncPatterns).toBe(0);
    expect(metrics.callbackDepth).toBe(0);
    expect(metrics.parameterCount).toBe(0);
    expect(metrics.lineCount).toBe(0);
  });
});

describe('calculateComplexityScore', () => {
  it('should return 0 for empty metrics', () => {
    const score = calculateComplexityScore(createEmptyMetrics());
    expect(score).toBe(0);
  });

  it('should calculate score with known inputs', () => {
    const metrics: ComplexityMetrics = {
      conditionals: 3,      // 3 * 2 = 6
      loops: 2,             // 2 * 3 = 6
      maxNestingDepth: 2,   // 2^1.5 * 3 = ~8.49
      tryCatchBlocks: 1,    // 1 * 2 = 2
      asyncPatterns: 2,     // 2 * 1.5 = 3
      callbackDepth: 0,     // 0 * 3 = 0
      parameterCount: 5,    // max(0, 5-3) * 2 = 4
      lineCount: 60,        // floor(60/30) = 2
    };

    const score = calculateComplexityScore(metrics);
    // 6 + 6 + 8.49 + 2 + 3 + 0 + 4 + 2 = 31.49 -> round = 31
    expect(score).toBe(31);
  });

  it('should not penalize parameterCount of 3 or less', () => {
    const metrics: ComplexityMetrics = {
      ...createEmptyMetrics(),
      parameterCount: 3,
    };

    const score = calculateComplexityScore(metrics);
    expect(score).toBe(0);
  });

  it('should handle high nesting depth with exponential scaling', () => {
    const metrics: ComplexityMetrics = {
      ...createEmptyMetrics(),
      maxNestingDepth: 4, // 4^1.5 * 3 = 8 * 3 = 24
    };

    const score = calculateComplexityScore(metrics);
    expect(score).toBe(24);
  });
});

describe('getComplexityLevel', () => {
  it('should return simple for score 0', () => {
    expect(getComplexityLevel(0)).toBe('simple');
  });

  it('should return simple for score 15', () => {
    expect(getComplexityLevel(15)).toBe('simple');
  });

  it('should return moderate for score 16', () => {
    expect(getComplexityLevel(16)).toBe('moderate');
  });

  it('should return moderate for score 35', () => {
    expect(getComplexityLevel(35)).toBe('moderate');
  });

  it('should return complex for score 36', () => {
    expect(getComplexityLevel(36)).toBe('complex');
  });

  it('should return complex for high scores', () => {
    expect(getComplexityLevel(100)).toBe('complex');
  });
});
