import { describe, it, expect } from 'vitest';
import {
  ImportType,
  createFileDependency,
  type FileDependency,
} from '@/domain/models/file-dependency.js';

describe('ImportType enum', () => {
  it('should have all expected import types', () => {
    expect(ImportType.NAMED).toBe('NAMED');
    expect(ImportType.DEFAULT).toBe('DEFAULT');
    expect(ImportType.NAMESPACE).toBe('NAMESPACE');
    expect(ImportType.DYNAMIC).toBe('DYNAMIC');
    expect(ImportType.PACKAGE).toBe('PACKAGE');
    expect(ImportType.MODULE).toBe('MODULE');
    expect(ImportType.WILDCARD).toBe('WILDCARD');
  });

  it('should have exactly 7 members', () => {
    const values = Object.values(ImportType);
    expect(values).toHaveLength(7);
  });
});

describe('createFileDependency', () => {
  it('should create a dependency with required fields and defaults', () => {
    const dep = createFileDependency({
      sourceFile: 'src/app.ts',
      targetFile: 'src/utils.ts',
      importType: ImportType.NAMED,
    });

    expect(dep.sourceFile).toBe('src/app.ts');
    expect(dep.targetFile).toBe('src/utils.ts');
    expect(dep.importType).toBe(ImportType.NAMED);
    expect(dep.id).toBeDefined();
    expect(dep.importedNames).toEqual([]);
  });

  it('should use provided id and importedNames', () => {
    const dep = createFileDependency({
      id: 'dep-1',
      sourceFile: 'src/app.ts',
      targetFile: 'src/utils.ts',
      importType: ImportType.NAMED,
      importedNames: ['foo', 'bar'],
    });

    expect(dep.id).toBe('dep-1');
    expect(dep.importedNames).toEqual(['foo', 'bar']);
  });

  it('should throw when sourceFile is empty', () => {
    expect(() =>
      createFileDependency({
        sourceFile: '',
        targetFile: 'src/utils.ts',
        importType: ImportType.NAMED,
      })
    ).toThrow();
  });

  it('should throw when targetFile is empty', () => {
    expect(() =>
      createFileDependency({
        sourceFile: 'src/app.ts',
        targetFile: '',
        importType: ImportType.NAMED,
      })
    ).toThrow();
  });
});
