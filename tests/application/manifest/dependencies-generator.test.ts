import { describe, it, expect, beforeEach } from 'vitest';

import { generateDependenciesManifest } from '@/application/manifest/dependencies-generator.js';
import { InMemoryFileDependencyRepository } from '../../helpers/fakes/index.js';
import { createFileDependency, ImportType } from '@/domain/models/index.js';

describe('generateDependenciesManifest', () => {
  let repo: InMemoryFileDependencyRepository;

  beforeEach(() => {
    repo = new InMemoryFileDependencyRepository();
  });

  it('should show hub files sorted by import count descending', () => {
    // prisma.ts is imported by 3 files, utils.ts by 2
    repo.saveBatch([
      createFileDependency({
        sourceFile: 'src/routes/users.ts',
        targetFile: 'src/db/prisma.ts',
        importType: ImportType.NAMED,
      }),
      createFileDependency({
        sourceFile: 'src/services/user.ts',
        targetFile: 'src/db/prisma.ts',
        importType: ImportType.NAMED,
      }),
      createFileDependency({
        sourceFile: 'src/services/auth.ts',
        targetFile: 'src/db/prisma.ts',
        importType: ImportType.NAMED,
      }),
      createFileDependency({
        sourceFile: 'src/routes/users.ts',
        targetFile: 'src/lib/utils.ts',
        importType: ImportType.NAMED,
      }),
      createFileDependency({
        sourceFile: 'src/services/user.ts',
        targetFile: 'src/lib/utils.ts',
        importType: ImportType.NAMED,
      }),
    ]);

    const result = generateDependenciesManifest(repo, 5000);

    expect(result).toContain('# Dependencies');
    expect(result).toContain('Hub Files');
    expect(result).toContain('src/db/prisma.ts');
    expect(result).toContain('imported by 3 files');
    expect(result).toContain('src/lib/utils.ts');
    expect(result).toContain('imported by 2 files');
    // prisma should come before utils (higher count)
    expect(result.indexOf('prisma.ts')).toBeLessThan(result.indexOf('utils.ts'));
  });

  it('should show dependency graph per file', () => {
    repo.saveBatch([
      createFileDependency({
        sourceFile: 'src/routes/users.ts',
        targetFile: 'src/services/user.ts',
        importType: ImportType.NAMED,
      }),
      createFileDependency({
        sourceFile: 'src/routes/users.ts',
        targetFile: 'src/db/prisma.ts',
        importType: ImportType.NAMED,
      }),
    ]);

    const result = generateDependenciesManifest(repo, 5000);

    expect(result).toContain('Dependency Graph');
    expect(result).toContain('src/routes/users.ts');
    expect(result).toMatch(/→.*src\/services\/user\.ts/);
    expect(result).toMatch(/→.*src\/db\/prisma\.ts/);
  });

  it('should handle no dependencies', () => {
    const result = generateDependenciesManifest(repo, 5000);

    expect(result).toContain('# Dependencies');
  });

  it('should respect token budget', () => {
    for (let i = 0; i < 50; i++) {
      repo.save(
        createFileDependency({
          sourceFile: `src/modules/module-${i}.ts`,
          targetFile: `src/shared/shared-${i}.ts`,
          importType: ImportType.NAMED,
        }),
      );
    }

    const result = generateDependenciesManifest(repo, 50);
    expect(result.length).toBeLessThan(300);
  });

  it('should sort source files alphabetically in dependency graph', () => {
    repo.saveBatch([
      createFileDependency({
        sourceFile: 'src/z-module.ts',
        targetFile: 'src/shared.ts',
        importType: ImportType.NAMED,
      }),
      createFileDependency({
        sourceFile: 'src/a-module.ts',
        targetFile: 'src/shared.ts',
        importType: ImportType.NAMED,
      }),
    ]);

    const result = generateDependenciesManifest(repo, 5000);

    expect(result.indexOf('src/a-module.ts')).toBeLessThan(
      result.indexOf('src/z-module.ts'),
    );
  });
});
