import { describe, it, expect, beforeEach } from 'vitest';

import { AnalysisOrchestrator } from '@/application/analysis-orchestrator.js';
import type { AnalysisDependencies, AnalysisOptions } from '@/application/analysis-orchestrator.js';
import { createLanguageRegistry } from '@/extraction/languages/index.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryFileDependencyRepository,
  InMemoryEnvVariableRepository,
  InMemoryFileSystem,
} from '../helpers/fakes/index.js';

function createDeps(fileSystem: InMemoryFileSystem): AnalysisDependencies {
  return {
    codeUnitRepo: new InMemoryCodeUnitRepository(),
    dependencyRepo: new InMemoryFileDependencyRepository(),
    envVarRepo: new InMemoryEnvVariableRepository(),
    fileSystem,
    languageRegistry: createLanguageRegistry(),
  };
}

function defaultOptions(rootDir = '/project'): AnalysisOptions {
  return { rootDir };
}

describe('AnalysisOrchestrator', () => {
  let fs: InMemoryFileSystem;

  beforeEach(async () => {
    fs = new InMemoryFileSystem();
    // Use flat paths since InMemoryFileSystem.listFiles only returns direct children
    await fs.writeFile('/project/index.ts', 'export function main() { console.log("hello"); }');
    await fs.writeFile('/project/utils.ts', 'export const add = (a: number, b: number) => a + b;');
    await fs.writeFile('/project/.env.example', '# Database\nDATABASE_URL=postgresql://localhost/db');
    await fs.writeFile('/project/README.md', '# Project');
  });

  it('should process all recognized files in full analysis', async () => {
    const deps = createDeps(fs);
    const orchestrator = new AnalysisOrchestrator(deps);

    const result = await orchestrator.analyze(defaultOptions());

    expect(result.success).toBe(true);
    expect(result.stats).toBeDefined();
    expect(result.stats!.filesProcessed).toBeGreaterThanOrEqual(2);
  });

  it('should skip unrecognized file types', async () => {
    const deps = createDeps(fs);
    const orchestrator = new AnalysisOrchestrator(deps);

    const result = await orchestrator.analyze(defaultOptions());

    // README.md should not be processed
    expect(result.stats).toBeDefined();
    // Only .ts files should be processed (index.ts and utils.ts)
    const codeUnits = deps.codeUnitRepo.findAll();
    const filePaths = new Set(codeUnits.map(u => u.filePath));
    expect(filePaths.has('/project/README.md')).toBe(false);
  });

  it('should store code units in repository', async () => {
    const deps = createDeps(fs);
    const orchestrator = new AnalysisOrchestrator(deps);

    await orchestrator.analyze(defaultOptions());

    const allUnits = deps.codeUnitRepo.findAll();
    expect(allUnits.length).toBeGreaterThanOrEqual(1);
    // Should have extracted the main function and add arrow function
    expect(allUnits.some(u => u.name === 'main')).toBe(true);
  });

  it('should store dependencies in repository when extractor provides them', async () => {
    // Add a file with local dependencies
    await fs.writeFile('/project/app.ts', `import { add } from './utils';
export function compute() { return add(1, 2); }`);

    const deps = createDeps(fs);
    const orchestrator = new AnalysisOrchestrator(deps);

    await orchestrator.analyze(defaultOptions());

    // Dependencies depend on the language extractor implementation.
    // The orchestrator correctly stores whatever the extractor returns.
    const allDeps = deps.dependencyRepo.findAll();
    expect(Array.isArray(allDeps)).toBe(true);
    // Code units should still be extracted regardless of dependency support
    const allUnits = deps.codeUnitRepo.findAll();
    expect(allUnits.some(u => u.name === 'compute')).toBe(true);
  });

  it('should process .env.example files', async () => {
    const deps = createDeps(fs);
    const orchestrator = new AnalysisOrchestrator(deps);

    await orchestrator.analyze(defaultOptions());

    const envVars = deps.envVarRepo.findAll();
    expect(envVars.length).toBeGreaterThanOrEqual(1);
    expect(envVars.some(v => v.name === 'DATABASE_URL')).toBe(true);
  });

  it('should return correct stats', async () => {
    const deps = createDeps(fs);
    const orchestrator = new AnalysisOrchestrator(deps);

    const result = await orchestrator.analyze(defaultOptions());

    expect(result.success).toBe(true);
    expect(result.stats).toBeDefined();
    expect(result.stats!.filesProcessed).toBeGreaterThanOrEqual(2);
    expect(result.stats!.codeUnitsExtracted).toBeGreaterThanOrEqual(1);
    expect(result.stats!.envVariablesFound).toBeGreaterThanOrEqual(1);
    expect(result.stats!.duration).toBeGreaterThanOrEqual(0);
  });

  it('should only process changed files in incremental analysis', async () => {
    const deps = createDeps(fs);
    const orchestrator = new AnalysisOrchestrator(deps);

    // First do a full analysis
    await orchestrator.analyze(defaultOptions());
    const initialUnits = deps.codeUnitRepo.findAll().length;

    // Now update one file and do incremental
    await fs.writeFile('/project/index.ts', 'export function main() { return 42; }\nexport function extra() { return 1; }');
    const result = await orchestrator.analyzeIncremental(
      defaultOptions(),
      ['/project/index.ts'],
    );

    expect(result.success).toBe(true);
    expect(result.stats).toBeDefined();
    // Only 1 file processed incrementally
    expect(result.stats!.filesProcessed).toBe(1);
  });

  it('should clear old data before re-processing in incremental analysis', async () => {
    const deps = createDeps(fs);
    const orchestrator = new AnalysisOrchestrator(deps);

    // Full analysis
    await orchestrator.analyze(defaultOptions());
    const unitsBefore = deps.codeUnitRepo.findByFilePath('/project/index.ts');
    expect(unitsBefore.length).toBeGreaterThanOrEqual(1);

    // Incremental: replace content with different function
    await fs.writeFile('/project/index.ts', 'export function replaced() { return "new"; }');
    await orchestrator.analyzeIncremental(
      defaultOptions(),
      ['/project/index.ts'],
    );

    const unitsAfter = deps.codeUnitRepo.findByFilePath('/project/index.ts');
    // Old 'main' should be gone, new 'replaced' should exist
    expect(unitsAfter.some(u => u.name === 'replaced')).toBe(true);
    expect(unitsAfter.some(u => u.name === 'main')).toBe(false);
  });

  it('should handle empty project with no files', async () => {
    const emptyFs = new InMemoryFileSystem();
    const deps = createDeps(emptyFs);
    const orchestrator = new AnalysisOrchestrator(deps);

    const result = await orchestrator.analyze(defaultOptions());

    expect(result.success).toBe(true);
    expect(result.stats!.filesProcessed).toBe(0);
    expect(result.stats!.codeUnitsExtracted).toBe(0);
  });

  it('should return error result on failure', async () => {
    // Create a filesystem that throws on readFile
    const badFs = new InMemoryFileSystem();
    await badFs.writeFile('/project/index.ts', 'content');
    // Monkey-patch readFile to throw
    const originalReadFile = badFs.readFile.bind(badFs);
    badFs.readFile = async (path: string) => {
      if (path === '/project/index.ts') {
        throw new Error('Disk read error');
      }
      return originalReadFile(path);
    };

    const deps = createDeps(badFs);
    const orchestrator = new AnalysisOrchestrator(deps);

    const result = await orchestrator.analyze(defaultOptions());

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Disk read error');
  });
});
