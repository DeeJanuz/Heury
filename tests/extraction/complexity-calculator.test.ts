import { describe, it, expect } from 'vitest';
import { calculateComplexity } from '@/extraction/complexity-calculator.js';

describe('calculateComplexity', () => {
  const jsPatterns = {
    conditionals: [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\?[^?:]+:/g,
    ],
    loops: [
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bdo\s*\{/g,
      /\.forEach\s*\(/g,
      /\.map\s*\(/g,
      /\.filter\s*\(/g,
      /\.reduce\s*\(/g,
      /\.find\s*\(/g,
      /\.some\s*\(/g,
      /\.every\s*\(/g,
      /\bfor\s*\([^)]*\s+of\s+/g,
      /\bfor\s*\([^)]*\s+in\s+/g,
    ],
    errorHandling: [
      /\btry\s*\{/g,
      /\bcatch\s*\(/g,
      /\bfinally\s*\{/g,
    ],
    asyncPatterns: [
      /\basync\s+/g,
      /\bawait\s+/g,
      /new\s+Promise\s*\(/g,
      /\.then\s*\(/g,
      /\.catch\s*\(/g,
      /Promise\.(all|race|allSettled|any)\s*\(/g,
    ],
  };

  it('should count conditionals (if/else/switch/ternary)', () => {
    const code = `
      if (a) {
      } else if (b) {
      }
      switch (x) {
        case 1:
        case 2:
      }
      const y = a ? b : c;
    `;
    const metrics = calculateComplexity(code, jsPatterns);
    // if(a), if(b) from else-if, else if(b), switch(x), case 1, case 2, ternary = 7
    expect(metrics.conditionals).toBe(7);
  });

  it('should count loops (for/while/forEach/map)', () => {
    const code = `
      for (let i = 0; i < 10; i++) {}
      while (true) {}
      items.forEach((item) => {});
      items.map((item) => item.name);
    `;
    const metrics = calculateComplexity(code, jsPatterns);
    expect(metrics.loops).toBe(4);
  });

  it('should calculate nesting depth', () => {
    const code = `
      function foo() {
        if (x) {
          for (let i = 0; i < 10; i++) {
            if (y) {
              // depth 4
            }
          }
        }
      }
    `;
    const metrics = calculateComplexity(code, jsPatterns);
    expect(metrics.maxNestingDepth).toBe(4);
  });

  it('should count try/catch blocks', () => {
    const code = `
      try {
        doSomething();
      } catch (err) {
        handleError(err);
      }
    `;
    const metrics = calculateComplexity(code, jsPatterns);
    // try + catch = 2
    expect(metrics.tryCatchBlocks).toBe(2);
  });

  it('should count async patterns', () => {
    const code = `
      async function getData() {
        const result = await fetch('/api');
        return result;
      }
    `;
    const metrics = calculateComplexity(code, jsPatterns);
    // async + await = 2
    expect(metrics.asyncPatterns).toBe(2);
  });

  it('should calculate callback depth (.then chains)', () => {
    const code = `
      fetch('/api')
        .then((res) => res.json())
        .then((data) => process(data))
        .catch((err) => handle(err));
    `;
    const metrics = calculateComplexity(code, jsPatterns);
    expect(metrics.callbackDepth).toBeGreaterThanOrEqual(3);
  });

  it('should calculate parameter count from signature', () => {
    const metrics = calculateComplexity('function foo() {}', jsPatterns, '(a: string, b: number, c: boolean)');
    expect(metrics.parameterCount).toBe(3);
  });

  it('should return full metrics from calculateComplexity integration', () => {
    const code = `
      async function process(data, options) {
        if (data.length === 0) {
          return [];
        }
        try {
          for (const item of data) {
            await transform(item);
          }
        } catch (err) {
          console.error(err);
        }
      }
    `;
    const metrics = calculateComplexity(code, jsPatterns, '(data, options)');
    expect(metrics.conditionals).toBeGreaterThanOrEqual(1);
    expect(metrics.loops).toBeGreaterThanOrEqual(1);
    expect(metrics.tryCatchBlocks).toBeGreaterThanOrEqual(2);
    expect(metrics.asyncPatterns).toBeGreaterThanOrEqual(2);
    expect(metrics.parameterCount).toBe(2);
    expect(metrics.lineCount).toBeGreaterThan(0);
  });

  it('should return zeros for empty/simple code', () => {
    const code = 'const x = 1;';
    const metrics = calculateComplexity(code, jsPatterns);
    expect(metrics.conditionals).toBe(0);
    expect(metrics.loops).toBe(0);
    expect(metrics.maxNestingDepth).toBe(0);
    expect(metrics.tryCatchBlocks).toBe(0);
    expect(metrics.asyncPatterns).toBe(0);
    expect(metrics.callbackDepth).toBe(0);
    expect(metrics.parameterCount).toBe(0);
  });
});
