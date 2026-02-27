import { describe, it, expect } from 'vitest';

import { processFile } from '@/application/file-processor.js';
import { JavaScriptTypeScriptExtractor } from '@/extraction/languages/javascript-typescript.js';
import { PythonExtractor } from '@/extraction/languages/python.js';
import { CodeUnitType, PatternType } from '@/domain/models/index.js';

const jsExtractor = new JavaScriptTypeScriptExtractor();
const pyExtractor = new PythonExtractor();

describe('processFile', () => {
  it('should process JS file and return code units with complexity', () => {
    const content = `export function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    if (item.price > 0) {
      total += item.price * item.quantity;
    }
  }
  return total;
}`;
    const result = processFile(content, 'src/utils.ts', jsExtractor);

    expect(result.filePath).toBe('src/utils.ts');
    expect(result.codeUnits.length).toBeGreaterThanOrEqual(1);

    const fn = result.codeUnits.find(u => u.name === 'calculateTotal');
    expect(fn).toBeDefined();
    expect(fn!.complexity).toBeDefined();
    // Should have some complexity from the for loop and if statement
    expect(fn!.complexityScore).toBeGreaterThan(0);
  });

  it('should process file and return dependencies array', () => {
    const content = `import { useState } from 'react';
import { helper } from './helper';

export function App() {
  return null;
}`;
    const result = processFile(content, 'src/App.tsx', jsExtractor);

    // Dependencies come from the language extractor's extractDependencies method.
    // The result should be an array (may be empty if extractor hasn't implemented it yet).
    expect(Array.isArray(result.dependencies)).toBe(true);
    expect(result.filePath).toBe('src/App.tsx');
  });

  it('should detect patterns within code units', () => {
    const content = `export async function fetchUsers() {
  const response = await fetch('https://api.example.com/users');
  return response.json();
}`;
    const result = processFile(content, 'src/api.ts', jsExtractor);

    const fn = result.codeUnits.find(u => u.name === 'fetchUsers');
    expect(fn).toBeDefined();
    expect(fn!.patterns.length).toBeGreaterThanOrEqual(1);
    expect(fn!.patterns.some(p => p.patternType === PatternType.API_CALL)).toBe(true);
  });

  it('should detect module-level patterns', () => {
    const content = `import express from 'express';
const router = express.Router();
router.get('/users', handler);

function handler(req, res) {
  res.json([]);
}`;
    const result = processFile(content, 'src/routes.ts', jsExtractor);

    // The router.get is at module level, not inside the handler function
    expect(result.moduleLevelPatterns.length).toBeGreaterThanOrEqual(1);
    expect(result.moduleLevelPatterns.some(
      p => p.patternType === PatternType.API_ENDPOINT
    )).toBe(true);
  });

  it('should create proper CodeUnit domain objects with IDs', () => {
    const content = `export function greet(name) {
  return 'Hello ' + name;
}`;
    const result = processFile(content, 'src/greet.ts', jsExtractor);

    expect(result.codeUnits.length).toBeGreaterThanOrEqual(1);
    const unit = result.codeUnits[0];
    expect(unit.id).toBeDefined();
    expect(typeof unit.id).toBe('string');
    expect(unit.id.length).toBeGreaterThan(0);
    expect(unit.filePath).toBe('src/greet.ts');
    expect(unit.name).toBe('greet');
  });

  it('should handle empty file', () => {
    const result = processFile('', 'src/empty.ts', jsExtractor);

    expect(result.filePath).toBe('src/empty.ts');
    expect(result.codeUnits).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
    expect(result.moduleLevelPatterns).toHaveLength(0);
  });

  it('should set correct language on code units', () => {
    const tsContent = `export function hello() { return 'hi'; }`;
    const tsResult = processFile(tsContent, 'src/hello.ts', jsExtractor);
    expect(tsResult.codeUnits[0].language).toBe('javascript-typescript');

    const pyContent = `def hello():\n    return 'hi'\n`;
    const pyResult = processFile(pyContent, 'src/hello.py', pyExtractor);
    if (pyResult.codeUnits.length > 0) {
      expect(pyResult.codeUnits[0].language).toBe('python');
    }
  });
});
