import { describe, it, expect, beforeEach } from 'vitest';

import { generateManifests } from '@/application/manifest/manifest-generator.js';
import type { ManifestDependencies, ManifestOptions } from '@/application/manifest/manifest-generator.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryFileDependencyRepository,
  InMemoryEnvVariableRepository,
  InMemoryFileSystem,
} from '../../helpers/fakes/index.js';
import {
  createCodeUnit,
  createCodeUnitPattern,
  createFileDependency,
  createEnvVariable,
  CodeUnitType,
  PatternType,
  ImportType,
} from '@/domain/models/index.js';

describe('generateManifests', () => {
  let deps: ManifestDependencies;
  let fileSystem: InMemoryFileSystem;

  beforeEach(() => {
    fileSystem = new InMemoryFileSystem();
    deps = {
      codeUnitRepo: new InMemoryCodeUnitRepository(),
      dependencyRepo: new InMemoryFileDependencyRepository(),
      envVarRepo: new InMemoryEnvVariableRepository(),
      fileSystem,
    };
  });

  it('should generate all 4 manifest files', async () => {
    const options: ManifestOptions = { outputDir: '.heury' };

    await generateManifests(deps, options);

    expect(await fileSystem.exists('.heury/MODULES.md')).toBe(true);
    expect(await fileSystem.exists('.heury/PATTERNS.md')).toBe(true);
    expect(await fileSystem.exists('.heury/DEPENDENCIES.md')).toBe(true);
    expect(await fileSystem.exists('.heury/HOTSPOTS.md')).toBe(true);
  });

  it('should write correct content to output directory', async () => {
    const codeUnitRepo = deps.codeUnitRepo as InMemoryCodeUnitRepository;
    codeUnitRepo.save(
      createCodeUnit({
        filePath: 'src/index.ts',
        name: 'main',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 10,
        isAsync: false,
        isExported: true,
        language: 'typescript',
        complexityScore: 5,
      }),
    );

    await generateManifests(deps, { outputDir: '.heury' });

    const modulesContent = await fileSystem.readFile('.heury/MODULES.md');
    expect(modulesContent).toContain('# Modules');
    expect(modulesContent).toContain('main');
  });

  it('should use default budget of 5000 tokens', async () => {
    // Add enough data to potentially exceed budget
    const codeUnitRepo = deps.codeUnitRepo as InMemoryCodeUnitRepository;
    for (let i = 0; i < 100; i++) {
      codeUnitRepo.save(
        createCodeUnit({
          filePath: `src/modules/module-${i}.ts`,
          name: `function${i}`,
          unitType: CodeUnitType.FUNCTION,
          lineStart: 1,
          lineEnd: 10,
          isAsync: true,
          isExported: true,
          language: 'typescript',
          complexityScore: i,
        }),
      );
    }

    await generateManifests(deps, { outputDir: '.heury' });

    // All files should exist and have content
    const modules = await fileSystem.readFile('.heury/MODULES.md');
    const patterns = await fileSystem.readFile('.heury/PATTERNS.md');
    const dependencies = await fileSystem.readFile('.heury/DEPENDENCIES.md');
    const hotspots = await fileSystem.readFile('.heury/HOTSPOTS.md');

    expect(modules.length).toBeGreaterThan(0);
    expect(patterns.length).toBeGreaterThan(0);
    expect(dependencies.length).toBeGreaterThan(0);
    expect(hotspots.length).toBeGreaterThan(0);
  });

  it('should use custom budget when provided', async () => {
    const codeUnitRepo = deps.codeUnitRepo as InMemoryCodeUnitRepository;
    for (let i = 0; i < 100; i++) {
      codeUnitRepo.save(
        createCodeUnit({
          filePath: `src/modules/module-${i}.ts`,
          name: `function${i}`,
          unitType: CodeUnitType.FUNCTION,
          lineStart: 1,
          lineEnd: 10,
          isAsync: true,
          isExported: true,
          language: 'typescript',
          complexityScore: i,
        }),
      );
    }

    await generateManifests(deps, { outputDir: '.heury', totalTokenBudget: 200 });

    const modules = await fileSystem.readFile('.heury/MODULES.md');
    const hotspots = await fileSystem.readFile('.heury/HOTSPOTS.md');
    // With only 200 tokens total, files should be quite short
    expect(modules.length).toBeLessThan(500);
    expect(hotspots.length).toBeLessThan(500);
  });

  it('should create output directory if needed', async () => {
    await generateManifests(deps, { outputDir: 'output/manifests' });

    expect(await fileSystem.exists('output/manifests/MODULES.md')).toBe(true);
  });
});
