import { describe, it, expect } from 'vitest';
import { ImportType } from '@/domain/models/index.js';
import { extractDependencies } from '@/extraction/dependency-extractor.js';

describe('extractDependencies', () => {
  it('should extract named imports', () => {
    const content = "import { foo, bar } from './utils';";
    const deps = extractDependencies(content, 'src/index.ts');
    expect(deps).toHaveLength(1);
    expect(deps[0].importType).toBe(ImportType.NAMED);
    expect(deps[0].importedNames).toEqual(['foo', 'bar']);
    expect(deps[0].targetFile).toBe('src/utils');
  });

  it('should extract default imports', () => {
    const content = "import MyModule from './my-module';";
    const deps = extractDependencies(content, 'src/index.ts');
    expect(deps).toHaveLength(1);
    expect(deps[0].importType).toBe(ImportType.DEFAULT);
    expect(deps[0].importedNames).toEqual(['MyModule']);
  });

  it('should extract namespace imports', () => {
    const content = "import * as Utils from './utils';";
    const deps = extractDependencies(content, 'src/index.ts');
    expect(deps).toHaveLength(1);
    expect(deps[0].importType).toBe(ImportType.NAMESPACE);
    expect(deps[0].importedNames).toEqual(['Utils']);
  });

  it('should extract dynamic imports', () => {
    const content = "const mod = await import('./lazy-module');";
    const deps = extractDependencies(content, 'src/index.ts');
    expect(deps).toHaveLength(1);
    expect(deps[0].importType).toBe(ImportType.DYNAMIC);
  });

  it('should extract CommonJS require', () => {
    const content = "const fs = require('./file-system');";
    const deps = extractDependencies(content, 'src/index.ts');
    expect(deps).toHaveLength(1);
    expect(deps[0].importType).toBe(ImportType.DEFAULT);
    expect(deps[0].importedNames).toEqual(['fs']);
  });

  it('should extract re-exports', () => {
    const content = "export { foo, bar } from './utils';";
    const deps = extractDependencies(content, 'src/index.ts');
    expect(deps).toHaveLength(1);
    expect(deps[0].importType).toBe(ImportType.NAMED);
  });

  it('should skip external packages', () => {
    const content = "import express from 'express';\nimport { readFile } from 'fs';";
    const deps = extractDependencies(content, 'src/index.ts');
    expect(deps).toHaveLength(0);
  });

  it('should resolve relative paths correctly', () => {
    const content = "import { helper } from '../utils/helper';";
    const deps = extractDependencies(content, 'src/services/user.ts');
    expect(deps).toHaveLength(1);
    expect(deps[0].targetFile).toBe('src/utils/helper');
  });

  it('should deduplicate by target file and import type', () => {
    const content = "import { foo } from './utils';\nimport { bar } from './utils';";
    const deps = extractDependencies(content, 'src/index.ts');
    // Both are NAMED from same target, so first one wins
    expect(deps).toHaveLength(1);
  });

  it('should handle mixed import styles in one file', () => {
    const content = [
      "import { foo } from './a';",
      "import Bar from './b';",
      "import * as C from './c';",
      "const d = require('./d');",
      "const e = await import('./e');",
      "export { f } from './f';",
      "import express from 'express';",
    ].join('\n');
    const deps = extractDependencies(content, 'src/index.ts');
    // 6 local deps, 1 external skipped
    expect(deps).toHaveLength(6);
  });

  it('should handle aliased named imports', () => {
    const content = "import { foo as myFoo, bar as myBar } from './utils';";
    const deps = extractDependencies(content, 'src/index.ts');
    expect(deps).toHaveLength(1);
    expect(deps[0].importedNames).toEqual(['foo', 'bar']);
  });
});
