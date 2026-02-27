import { describe, it, expect } from 'vitest';

import { shouldProcessFile } from '@/application/file-filter.js';
import { createLanguageRegistry } from '@/extraction/languages/index.js';

const registry = createLanguageRegistry();

describe('shouldProcessFile', () => {
  it('should accept files with recognized extensions', () => {
    expect(shouldProcessFile('src/index.ts', registry)).toBe(true);
    expect(shouldProcessFile('main.py', registry)).toBe(true);
    expect(shouldProcessFile('server.go', registry)).toBe(true);
    expect(shouldProcessFile('App.java', registry)).toBe(true);
    expect(shouldProcessFile('lib.rs', registry)).toBe(true);
    expect(shouldProcessFile('Program.cs', registry)).toBe(true);
    expect(shouldProcessFile('app.js', registry)).toBe(true);
    expect(shouldProcessFile('component.tsx', registry)).toBe(true);
  });

  it('should reject files with unknown extensions', () => {
    expect(shouldProcessFile('readme.txt', registry)).toBe(false);
    expect(shouldProcessFile('README.md', registry)).toBe(false);
    expect(shouldProcessFile('package.json', registry)).toBe(false);
    expect(shouldProcessFile('styles.css', registry)).toBe(false);
    expect(shouldProcessFile('image.png', registry)).toBe(false);
  });

  it('should reject .d.ts declaration files', () => {
    expect(shouldProcessFile('src/types.d.ts', registry)).toBe(false);
    expect(shouldProcessFile('global.d.ts', registry)).toBe(false);
  });

  it('should reject files in skip directories', () => {
    expect(shouldProcessFile('node_modules/express/index.js', registry)).toBe(false);
    expect(shouldProcessFile('.git/hooks/pre-commit.py', registry)).toBe(false);
    expect(shouldProcessFile('dist/bundle.js', registry)).toBe(false);
    expect(shouldProcessFile('build/output.js', registry)).toBe(false);
    expect(shouldProcessFile('vendor/lib.go', registry)).toBe(false);
    expect(shouldProcessFile('__pycache__/module.py', registry)).toBe(false);
  });

  it('should reject test files when skipTests is true', () => {
    expect(shouldProcessFile('src/utils.test.ts', registry, { skipTests: true })).toBe(false);
    expect(shouldProcessFile('tests/helper.spec.ts', registry, { skipTests: true })).toBe(false);
    expect(shouldProcessFile('__tests__/app.test.js', registry, { skipTests: true })).toBe(false);
  });

  it('should accept test files when skipTests is false', () => {
    expect(shouldProcessFile('src/utils.test.ts', registry, { skipTests: false })).toBe(true);
    expect(shouldProcessFile('tests/helper.spec.ts', registry, { skipTests: false })).toBe(true);
  });

  it('should respect exclude patterns', () => {
    expect(shouldProcessFile('src/generated/client.ts', registry, {
      exclude: ['**/generated/**'],
    })).toBe(false);
    expect(shouldProcessFile('src/index.ts', registry, {
      exclude: ['**/generated/**'],
    })).toBe(true);
  });

  it('should work with default options (skip tests)', () => {
    // Default skipTests should be false (process all)
    expect(shouldProcessFile('src/index.ts', registry)).toBe(true);
    // Files with no extension
    expect(shouldProcessFile('Makefile', registry)).toBe(false);
  });
});
