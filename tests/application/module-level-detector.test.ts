import { describe, it, expect } from 'vitest';

import { detectModuleLevelPatterns } from '@/application/module-level-detector.js';
import { JavaScriptTypeScriptExtractor } from '@/extraction/languages/javascript-typescript.js';
import { PatternType } from '@/domain/models/index.js';

const jsExtractor = new JavaScriptTypeScriptExtractor();
const jsRules = jsExtractor.getPatternRules();

describe('detectModuleLevelPatterns', () => {
  it('should detect patterns at file scope', () => {
    const content = `import express from 'express';
const app = express();
app.get('/users', handler);
app.post('/items', createItem);
`;
    // No code units - all patterns are module-level
    const patterns = detectModuleLevelPatterns(content, [], jsRules);
    const endpoints = patterns.filter(p => p.patternType === PatternType.API_ENDPOINT);
    expect(endpoints.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter out patterns inside code unit line ranges', () => {
    const content = `import express from 'express';
app.get('/module-level', handler);
function setupRoutes() {
  app.get('/inside-function', handler);
  app.post('/also-inside', handler);
}
app.get('/another-module-level', handler);
`;
    // Function is on lines 3-6
    const codeUnitRanges = [{ lineStart: 3, lineEnd: 6 }];
    const patterns = detectModuleLevelPatterns(content, codeUnitRanges, jsRules);
    const endpoints = patterns.filter(p => p.patternType === PatternType.API_ENDPOINT);
    // Only module-level patterns should remain (lines 2 and 7)
    const values = endpoints.map(p => p.patternValue);
    expect(values.some(v => v.includes('/module-level'))).toBe(true);
    expect(values.some(v => v.includes('/another-module-level'))).toBe(true);
    // The inside-function patterns should be filtered out
    expect(values.some(v => v.includes('/inside-function'))).toBe(false);
    expect(values.some(v => v.includes('/also-inside'))).toBe(false);
  });

  it('should return empty for file with all code in functions', () => {
    // Content where the only pattern is inside a code unit range
    const content = `function handler() {
  app.get('/users', doStuff);
}
`;
    const codeUnitRanges = [{ lineStart: 1, lineEnd: 3 }];
    const patterns = detectModuleLevelPatterns(content, codeUnitRanges, jsRules);
    const endpoints = patterns.filter(p => p.patternType === PatternType.API_ENDPOINT);
    expect(endpoints).toHaveLength(0);
  });

  it('should work with no code units (all patterns are module-level)', () => {
    const content = `const db = prisma.user.findMany();
fetch('https://api.example.com/data');
`;
    const patterns = detectModuleLevelPatterns(content, [], jsRules);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('should work with empty content', () => {
    const patterns = detectModuleLevelPatterns('', [], jsRules);
    expect(patterns).toHaveLength(0);
  });
});
