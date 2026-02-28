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

  it('should include hub files section before source file sections (high score)', () => {
    repo.saveBatch([
      createFileDependency({
        sourceFile: 'src/a.ts',
        targetFile: 'src/shared.ts',
        importType: ImportType.NAMED,
      }),
      createFileDependency({
        sourceFile: 'src/b.ts',
        targetFile: 'src/shared.ts',
        importType: ImportType.NAMED,
      }),
    ]);

    const result = generateDependenciesManifest(repo, 5000);

    const hubIndex = result.indexOf('## Hub Files');
    const aIndex = result.indexOf('src/a.ts');
    // Hub section must appear before any source file dependency listing
    expect(hubIndex).toBeGreaterThan(-1);
    expect(hubIndex).toBeLessThan(aIndex);
  });

  it('should rank source files with more imports higher', () => {
    // orchestrator imports 3 things, simple imports 1 thing
    repo.saveBatch([
      createFileDependency({
        sourceFile: 'src/simple.ts',
        targetFile: 'src/dep-a.ts',
        importType: ImportType.NAMED,
      }),
      createFileDependency({
        sourceFile: 'src/orchestrator.ts',
        targetFile: 'src/dep-a.ts',
        importType: ImportType.NAMED,
      }),
      createFileDependency({
        sourceFile: 'src/orchestrator.ts',
        targetFile: 'src/dep-b.ts',
        importType: ImportType.NAMED,
      }),
      createFileDependency({
        sourceFile: 'src/orchestrator.ts',
        targetFile: 'src/dep-c.ts',
        importType: ImportType.NAMED,
      }),
    ]);

    const result = generateDependenciesManifest(repo, 5000);

    // orchestrator (3 imports) should appear before simple (1 import) in output
    expect(result.indexOf('src/orchestrator.ts')).toBeLessThan(
      result.indexOf('src/simple.ts'),
    );
  });

  it('should not produce partial sections — each source file listing is complete or omitted', () => {
    // Create a source file with multiple targets
    repo.saveBatch([
      createFileDependency({
        sourceFile: 'src/big-file.ts',
        targetFile: 'src/target-1.ts',
        importType: ImportType.NAMED,
      }),
      createFileDependency({
        sourceFile: 'src/big-file.ts',
        targetFile: 'src/target-2.ts',
        importType: ImportType.NAMED,
      }),
      createFileDependency({
        sourceFile: 'src/big-file.ts',
        targetFile: 'src/target-3.ts',
        importType: ImportType.NAMED,
      }),
    ]);

    const result = generateDependenciesManifest(repo, 5000);

    // If big-file.ts appears, all its targets must appear too
    if (result.includes('src/big-file.ts')) {
      expect(result).toContain('src/target-1.ts');
      expect(result).toContain('src/target-2.ts');
      expect(result).toContain('src/target-3.ts');
    }
  });

  it('should show omission summary when sections do not fit', () => {
    // Create many source files to exceed a small token budget
    for (let i = 0; i < 30; i++) {
      repo.save(
        createFileDependency({
          sourceFile: `src/modules/module-${i}.ts`,
          targetFile: `src/shared/shared-${i}.ts`,
          importType: ImportType.NAMED,
        }),
      );
    }

    // Very tight budget — can't fit all 30 source file sections
    const result = generateDependenciesManifest(repo, 30);

    expect(result).toMatch(/\d+ more files available via MCP tools/);
  });

  it('should return just the header for empty dependencies', () => {
    const result = generateDependenciesManifest(repo, 5000);

    expect(result).toBe('# Dependencies\n');
  });

  describe('circular dependencies', () => {
    it('should show circular deps section when cycles exist', () => {
      // A -> B -> A (2-file cycle)
      repo.saveBatch([
        createFileDependency({
          sourceFile: 'src/a.ts',
          targetFile: 'src/b.ts',
          importType: ImportType.NAMED,
        }),
        createFileDependency({
          sourceFile: 'src/b.ts',
          targetFile: 'src/a.ts',
          importType: ImportType.NAMED,
        }),
      ]);

      const result = generateDependenciesManifest(repo, 5000);

      expect(result).toContain('## Circular Dependencies');
    });

    it('should show correct file path chain for a cycle', () => {
      // A -> B -> A
      repo.saveBatch([
        createFileDependency({
          sourceFile: 'src/a.ts',
          targetFile: 'src/b.ts',
          importType: ImportType.NAMED,
        }),
        createFileDependency({
          sourceFile: 'src/b.ts',
          targetFile: 'src/a.ts',
          importType: ImportType.NAMED,
        }),
      ]);

      const result = generateDependenciesManifest(repo, 5000);

      // The cycle chain should show: src/a.ts -> src/b.ts -> src/a.ts
      // (detectCircularDeps sorts alphabetically, so a.ts is start)
      expect(result).toMatch(/src\/a\.ts.*→.*src\/b\.ts.*→.*src\/a\.ts/);
    });

    it('should not show circular deps section when no cycles found', () => {
      // A -> B -> C (no cycle)
      repo.saveBatch([
        createFileDependency({
          sourceFile: 'src/a.ts',
          targetFile: 'src/b.ts',
          importType: ImportType.NAMED,
        }),
        createFileDependency({
          sourceFile: 'src/b.ts',
          targetFile: 'src/c.ts',
          importType: ImportType.NAMED,
        }),
      ]);

      const result = generateDependenciesManifest(repo, 5000);

      expect(result).not.toContain('Circular Dependencies');
    });

    it('should respect token budget for circular deps section', () => {
      // Create a cycle plus many other deps to fill the budget
      repo.saveBatch([
        createFileDependency({
          sourceFile: 'src/a.ts',
          targetFile: 'src/b.ts',
          importType: ImportType.NAMED,
        }),
        createFileDependency({
          sourceFile: 'src/b.ts',
          targetFile: 'src/a.ts',
          importType: ImportType.NAMED,
        }),
      ]);

      // Add many more deps to fill the budget
      for (let i = 0; i < 50; i++) {
        repo.save(
          createFileDependency({
            sourceFile: `src/modules/module-${i}.ts`,
            targetFile: `src/shared/shared-${i}.ts`,
            importType: ImportType.NAMED,
          }),
        );
      }

      // Very tight budget — circular deps section shouldn't blow past it
      const result = generateDependenciesManifest(repo, 30);

      expect(result.length).toBeLessThan(300);
    });

    it('should sort cycles by length (shortest first)', () => {
      // 2-file cycle: x -> y -> x
      // 3-file cycle: a -> b -> c -> a
      repo.saveBatch([
        createFileDependency({
          sourceFile: 'src/x.ts',
          targetFile: 'src/y.ts',
          importType: ImportType.NAMED,
        }),
        createFileDependency({
          sourceFile: 'src/y.ts',
          targetFile: 'src/x.ts',
          importType: ImportType.NAMED,
        }),
        createFileDependency({
          sourceFile: 'src/a.ts',
          targetFile: 'src/b.ts',
          importType: ImportType.NAMED,
        }),
        createFileDependency({
          sourceFile: 'src/b.ts',
          targetFile: 'src/c.ts',
          importType: ImportType.NAMED,
        }),
        createFileDependency({
          sourceFile: 'src/c.ts',
          targetFile: 'src/a.ts',
          importType: ImportType.NAMED,
        }),
      ]);

      const result = generateDependenciesManifest(repo, 5000);

      // 2-file cycle should appear before 3-file cycle
      const twoFileCycleIndex = result.indexOf('2 files');
      const threeFileCycleIndex = result.indexOf('3 files');
      expect(twoFileCycleIndex).toBeGreaterThan(-1);
      expect(threeFileCycleIndex).toBeGreaterThan(-1);
      expect(twoFileCycleIndex).toBeLessThan(threeFileCycleIndex);
    });

    it('should display multiple cycles with numbered headings', () => {
      // Two separate cycles
      repo.saveBatch([
        createFileDependency({
          sourceFile: 'src/x.ts',
          targetFile: 'src/y.ts',
          importType: ImportType.NAMED,
        }),
        createFileDependency({
          sourceFile: 'src/y.ts',
          targetFile: 'src/x.ts',
          importType: ImportType.NAMED,
        }),
        createFileDependency({
          sourceFile: 'src/a.ts',
          targetFile: 'src/b.ts',
          importType: ImportType.NAMED,
        }),
        createFileDependency({
          sourceFile: 'src/b.ts',
          targetFile: 'src/c.ts',
          importType: ImportType.NAMED,
        }),
        createFileDependency({
          sourceFile: 'src/c.ts',
          targetFile: 'src/a.ts',
          importType: ImportType.NAMED,
        }),
      ]);

      const result = generateDependenciesManifest(repo, 5000);

      expect(result).toContain('### Cycle 1');
      expect(result).toContain('### Cycle 2');
    });
  });
});
