import { describe, it, expect, beforeEach } from 'vitest';

import { analyzeIncremental } from '@/application/incremental/incremental-analyzer.js';
import type {
  IncrementalAnalysisDependencies,
  IncrementalAnalysisResult,
} from '@/application/incremental/incremental-analyzer.js';
import type { ChangedFile } from '@/application/incremental/git-diff-parser.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryFileDependencyRepository,
  InMemoryEnvVariableRepository,
  InMemoryFileSystem,
  InMemoryGuardClauseRepository,
} from '../../helpers/fakes/index.js';
import { createLanguageRegistry } from '@/extraction/languages/index.js';
import type { LanguageRegistry } from '@/extraction/language-registry.js';

function createDeps(
  fileSystem: InMemoryFileSystem,
): IncrementalAnalysisDependencies & { languageRegistry: LanguageRegistry } {
  return {
    fileSystem,
    codeUnitRepo: new InMemoryCodeUnitRepository(),
    dependencyRepo: new InMemoryFileDependencyRepository(),
    envVarRepo: new InMemoryEnvVariableRepository(),
    languageRegistry: createLanguageRegistry(),
  };
}

function defaultConfig(rootDir = '/project') {
  return { rootDir, include: [] as string[], exclude: [] as string[] };
}

describe('analyzeIncremental', () => {
  let fs: InMemoryFileSystem;

  beforeEach(async () => {
    fs = new InMemoryFileSystem();
  });

  it('should return success with zero counts for empty changed files', async () => {
    const deps = createDeps(fs);
    const result = await analyzeIncremental([], defaultConfig(), deps);

    expect(result.success).toBe(true);
    expect(result.filesAdded).toBe(0);
    expect(result.filesModified).toBe(0);
    expect(result.filesDeleted).toBe(0);
    expect(result.error).toBeUndefined();
  });

  it('should extract and store code units for an added file', async () => {
    await fs.writeFile(
      '/project/src/hello.ts',
      'export function hello() { return "hi"; }',
    );

    const deps = createDeps(fs);
    const changedFiles: ChangedFile[] = [
      { filePath: 'src/hello.ts', changeType: 'added' },
    ];

    const result = await analyzeIncremental(changedFiles, defaultConfig(), deps);

    expect(result.success).toBe(true);
    expect(result.filesAdded).toBe(1);
    expect(result.filesModified).toBe(0);
    expect(result.filesDeleted).toBe(0);

    const units = deps.codeUnitRepo.findByFilePath('src/hello.ts');
    expect(units.length).toBeGreaterThanOrEqual(1);
    expect(units.some(u => u.name === 'hello')).toBe(true);
  });

  it('should delete old data and re-extract for a modified file', async () => {
    // Pre-populate with old data
    const deps = createDeps(fs);

    // First add the file
    await fs.writeFile(
      '/project/src/service.ts',
      'export function oldFn() { return 1; }',
    );
    const addResult = await analyzeIncremental(
      [{ filePath: 'src/service.ts', changeType: 'added' }],
      defaultConfig(),
      deps,
    );
    expect(addResult.success).toBe(true);

    const unitsBefore = deps.codeUnitRepo.findByFilePath('src/service.ts');
    expect(unitsBefore.some(u => u.name === 'oldFn')).toBe(true);

    // Now modify the file
    await fs.writeFile(
      '/project/src/service.ts',
      'export function newFn() { return 2; }',
    );

    const result = await analyzeIncremental(
      [{ filePath: 'src/service.ts', changeType: 'modified' }],
      defaultConfig(),
      deps,
    );

    expect(result.success).toBe(true);
    expect(result.filesModified).toBe(1);

    const unitsAfter = deps.codeUnitRepo.findByFilePath('src/service.ts');
    expect(unitsAfter.some(u => u.name === 'newFn')).toBe(true);
    expect(unitsAfter.some(u => u.name === 'oldFn')).toBe(false);
  });

  it('should delete all data for a deleted file', async () => {
    const deps = createDeps(fs);

    // Pre-populate
    await fs.writeFile(
      '/project/src/doomed.ts',
      'export function doomed() { return 0; }',
    );
    await analyzeIncremental(
      [{ filePath: 'src/doomed.ts', changeType: 'added' }],
      defaultConfig(),
      deps,
    );

    expect(deps.codeUnitRepo.findByFilePath('src/doomed.ts').length).toBeGreaterThanOrEqual(1);

    // Now delete
    const result = await analyzeIncremental(
      [{ filePath: 'src/doomed.ts', changeType: 'deleted' }],
      defaultConfig(),
      deps,
    );

    expect(result.success).toBe(true);
    expect(result.filesDeleted).toBe(1);
    expect(deps.codeUnitRepo.findByFilePath('src/doomed.ts')).toHaveLength(0);
    expect(deps.dependencyRepo.findBySourceFile('src/doomed.ts')).toHaveLength(0);
  });

  it('should delete old path data and extract new path for a renamed file', async () => {
    const deps = createDeps(fs);

    // Pre-populate old path
    await fs.writeFile(
      '/project/src/old-name.ts',
      'export function renamed() { return 1; }',
    );
    await analyzeIncremental(
      [{ filePath: 'src/old-name.ts', changeType: 'added' }],
      defaultConfig(),
      deps,
    );
    expect(deps.codeUnitRepo.findByFilePath('src/old-name.ts').length).toBeGreaterThanOrEqual(1);

    // Set up the new file location
    await fs.writeFile(
      '/project/src/new-name.ts',
      'export function renamed() { return 1; }',
    );

    // Rename
    const result = await analyzeIncremental(
      [{ filePath: 'src/new-name.ts', changeType: 'renamed', oldPath: 'src/old-name.ts' }],
      defaultConfig(),
      deps,
    );

    expect(result.success).toBe(true);
    expect(result.filesAdded).toBe(1); // renamed counts as added

    // Old path data should be cleared
    expect(deps.codeUnitRepo.findByFilePath('src/old-name.ts')).toHaveLength(0);
    expect(deps.dependencyRepo.findBySourceFile('src/old-name.ts')).toHaveLength(0);

    // New path data should exist
    const newUnits = deps.codeUnitRepo.findByFilePath('src/new-name.ts');
    expect(newUnits.length).toBeGreaterThanOrEqual(1);
    expect(newUnits.some(u => u.name === 'renamed')).toBe(true);
  });

  it('should handle mixed changes (added, modified, deleted)', async () => {
    const deps = createDeps(fs);

    // Pre-populate existing files
    await fs.writeFile('/project/src/existing.ts', 'export function existing() {}');
    await fs.writeFile('/project/src/toDelete.ts', 'export function toDelete() {}');
    await analyzeIncremental(
      [
        { filePath: 'src/existing.ts', changeType: 'added' },
        { filePath: 'src/toDelete.ts', changeType: 'added' },
      ],
      defaultConfig(),
      deps,
    );

    // Now: add a new file, modify an existing one, delete another
    await fs.writeFile('/project/src/brand-new.ts', 'export function brandNew() {}');
    await fs.writeFile('/project/src/existing.ts', 'export function modified() {}');

    const result = await analyzeIncremental(
      [
        { filePath: 'src/brand-new.ts', changeType: 'added' },
        { filePath: 'src/existing.ts', changeType: 'modified' },
        { filePath: 'src/toDelete.ts', changeType: 'deleted' },
      ],
      defaultConfig(),
      deps,
    );

    expect(result.success).toBe(true);
    expect(result.filesAdded).toBe(1);
    expect(result.filesModified).toBe(1);
    expect(result.filesDeleted).toBe(1);

    expect(deps.codeUnitRepo.findByFilePath('src/brand-new.ts').length).toBeGreaterThanOrEqual(1);
    expect(deps.codeUnitRepo.findByFilePath('src/existing.ts').some(u => u.name === 'modified')).toBe(true);
    expect(deps.codeUnitRepo.findByFilePath('src/toDelete.ts')).toHaveLength(0);
  });

  it('should skip files excluded by config exclude patterns', async () => {
    await fs.writeFile(
      '/project/src/generated/auto.ts',
      'export function auto() {}',
    );

    const deps = createDeps(fs);
    const config = { rootDir: '/project', include: [], exclude: ['src/generated/**'] };

    const result = await analyzeIncremental(
      [{ filePath: 'src/generated/auto.ts', changeType: 'added' }],
      config,
      deps,
    );

    expect(result.success).toBe(true);
    expect(result.filesAdded).toBe(0);
    expect(deps.codeUnitRepo.findAll()).toHaveLength(0);
  });

  it('should skip files not matching config include patterns', async () => {
    await fs.writeFile('/project/src/other.ts', 'export function other() {}');

    const deps = createDeps(fs);
    const config = { rootDir: '/project', include: ['lib/**'], exclude: [] };

    const result = await analyzeIncremental(
      [{ filePath: 'src/other.ts', changeType: 'added' }],
      config,
      deps,
    );

    expect(result.success).toBe(true);
    expect(result.filesAdded).toBe(0);
    expect(deps.codeUnitRepo.findAll()).toHaveLength(0);
  });

  it('should report extraction errors but continue processing other files', async () => {
    await fs.writeFile('/project/src/good.ts', 'export function good() { return 1; }');
    // bad.ts exists but will throw on read
    await fs.writeFile('/project/src/bad.ts', 'export function bad() {}');

    const deps = createDeps(fs);

    // Monkey-patch readFile to throw for bad.ts
    const origReadFile = fs.readFile.bind(fs);
    fs.readFile = async (path: string) => {
      if (path.includes('bad.ts')) {
        throw new Error('Disk read error');
      }
      return origReadFile(path);
    };

    const result = await analyzeIncremental(
      [
        { filePath: 'src/good.ts', changeType: 'added' },
        { filePath: 'src/bad.ts', changeType: 'added' },
      ],
      defaultConfig(),
      deps,
    );

    expect(result.success).toBe(true);
    // Good file should still be processed
    expect(deps.codeUnitRepo.findByFilePath('src/good.ts').length).toBeGreaterThanOrEqual(1);
    // One file added successfully, one had an error
    expect(result.filesAdded).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it('should return correct counts for all change types', async () => {
    const deps = createDeps(fs);

    // Pre-populate
    await fs.writeFile('/project/src/mod1.ts', 'export function mod1() {}');
    await fs.writeFile('/project/src/mod2.ts', 'export function mod2() {}');
    await fs.writeFile('/project/src/del1.ts', 'export function del1() {}');
    await analyzeIncremental(
      [
        { filePath: 'src/mod1.ts', changeType: 'added' },
        { filePath: 'src/mod2.ts', changeType: 'added' },
        { filePath: 'src/del1.ts', changeType: 'added' },
      ],
      defaultConfig(),
      deps,
    );

    // Now do an incremental with mixed changes
    await fs.writeFile('/project/src/add1.ts', 'export function add1() {}');
    await fs.writeFile('/project/src/add2.ts', 'export function add2() {}');
    await fs.writeFile('/project/src/mod1.ts', 'export function mod1Updated() {}');
    await fs.writeFile('/project/src/mod2.ts', 'export function mod2Updated() {}');

    const result = await analyzeIncremental(
      [
        { filePath: 'src/add1.ts', changeType: 'added' },
        { filePath: 'src/add2.ts', changeType: 'added' },
        { filePath: 'src/mod1.ts', changeType: 'modified' },
        { filePath: 'src/mod2.ts', changeType: 'modified' },
        { filePath: 'src/del1.ts', changeType: 'deleted' },
      ],
      defaultConfig(),
      deps,
    );

    expect(result.success).toBe(true);
    expect(result.filesAdded).toBe(2);
    expect(result.filesModified).toBe(2);
    expect(result.filesDeleted).toBe(1);
  });

  it('should skip files with unrecognized extensions', async () => {
    await fs.writeFile('/project/data.csv', 'a,b,c\n1,2,3');

    const deps = createDeps(fs);

    const result = await analyzeIncremental(
      [{ filePath: 'data.csv', changeType: 'added' }],
      defaultConfig(),
      deps,
    );

    expect(result.success).toBe(true);
    expect(result.filesAdded).toBe(0);
    expect(deps.codeUnitRepo.findAll()).toHaveLength(0);
  });

  it('should delete dependencies for a deleted file', async () => {
    const deps = createDeps(fs);

    await fs.writeFile(
      '/project/src/importer.ts',
      `import { foo } from './foo';\nexport function bar() { return foo(); }`,
    );
    await analyzeIncremental(
      [{ filePath: 'src/importer.ts', changeType: 'added' }],
      defaultConfig(),
      deps,
    );

    const depsBefore = deps.dependencyRepo.findBySourceFile('src/importer.ts');
    expect(depsBefore.length).toBeGreaterThanOrEqual(1);

    // Delete the file
    await analyzeIncremental(
      [{ filePath: 'src/importer.ts', changeType: 'deleted' }],
      defaultConfig(),
      deps,
    );

    expect(deps.dependencyRepo.findBySourceFile('src/importer.ts')).toHaveLength(0);
  });

  it('should delete guard clause data when guard clause repo is provided', async () => {
    const guardClauseRepo = new InMemoryGuardClauseRepository();
    const baseDeps = createDeps(fs);
    const deps = { ...baseDeps, guardClauseRepo };

    // Populate some guard clause data manually
    await fs.writeFile(
      '/project/src/guarded.ts',
      'export function guarded(x: number) { if (!x) return; console.log(x); }',
    );
    await analyzeIncremental(
      [{ filePath: 'src/guarded.ts', changeType: 'added' }],
      defaultConfig(),
      deps,
    );

    // Get the code unit IDs to seed guard clauses
    const units = deps.codeUnitRepo.findByFilePath('src/guarded.ts');
    if (units.length > 0) {
      guardClauseRepo.save({
        id: 'gc-1',
        codeUnitId: units[0].id,
        guardType: 'null-check',
        condition: '!x',
        lineNumber: 1,
        action: 'early-return',
      });
    }

    // Delete the file
    await analyzeIncremental(
      [{ filePath: 'src/guarded.ts', changeType: 'deleted' }],
      defaultConfig(),
      deps,
    );

    // Guard clauses for deleted file's units should be cleared
    if (units.length > 0) {
      expect(guardClauseRepo.findByCodeUnitId(units[0].id)).toHaveLength(0);
    }
    expect(deps.codeUnitRepo.findByFilePath('src/guarded.ts')).toHaveLength(0);
  });

  it('should handle .env.example files by re-extracting env variables', async () => {
    const deps = createDeps(fs);

    await fs.writeFile(
      '/project/.env.example',
      '# Database\nDATABASE_URL=postgresql://localhost/db\nAPI_KEY=secret',
    );

    const result = await analyzeIncremental(
      [{ filePath: '.env.example', changeType: 'modified' }],
      defaultConfig(),
      deps,
    );

    expect(result.success).toBe(true);
    // .env.example is tracked as modified
    expect(result.filesModified).toBe(1);

    const envVars = deps.envVarRepo.findAll();
    expect(envVars.some(v => v.name === 'DATABASE_URL')).toBe(true);
    expect(envVars.some(v => v.name === 'API_KEY')).toBe(true);
  });
});
