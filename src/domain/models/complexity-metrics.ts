export interface ComplexityMetrics {
  readonly conditionals: number;
  readonly loops: number;
  readonly maxNestingDepth: number;
  readonly tryCatchBlocks: number;
  readonly asyncPatterns: number;
  readonly callbackDepth: number;
  readonly parameterCount: number;
  readonly lineCount: number;
}

export function calculateComplexityScore(metrics: ComplexityMetrics): number {
  return Math.round(
    metrics.conditionals * 2 +
    metrics.loops * 3 +
    Math.pow(metrics.maxNestingDepth, 1.5) * 3 +
    metrics.tryCatchBlocks * 2 +
    metrics.asyncPatterns * 1.5 +
    metrics.callbackDepth * 3 +
    Math.max(0, metrics.parameterCount - 3) * 2 +
    Math.floor(metrics.lineCount / 30)
  );
}

export function getComplexityLevel(score: number): 'simple' | 'moderate' | 'complex' {
  if (score <= 15) return 'simple';
  if (score <= 35) return 'moderate';
  return 'complex';
}

export function createEmptyMetrics(): ComplexityMetrics {
  return {
    conditionals: 0,
    loops: 0,
    maxNestingDepth: 0,
    tryCatchBlocks: 0,
    asyncPatterns: 0,
    callbackDepth: 0,
    parameterCount: 0,
    lineCount: 0,
  };
}
