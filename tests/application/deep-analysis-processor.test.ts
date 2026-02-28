import { describe, it, expect, beforeEach } from 'vitest';

import { processDeepAnalysis, type DeepAnalysisDependencies } from '@/application/deep-analysis-processor.js';
import type { FileProcessingResult } from '@/application/file-processor.js';
import { createCodeUnit, CodeUnitType, createFileDependency, PatternType, createCodeUnitPattern } from '@/domain/models/index.js';
import {
  InMemoryFunctionCallRepository,
  InMemoryTypeFieldRepository,
  InMemoryEventFlowRepository,
  InMemorySchemaModelRepository,
  InMemoryGuardClauseRepository,
  InMemoryFileDependencyRepository,
  InMemoryFileClusterRepository,
  InMemoryCodeUnitRepository,
  InMemoryPatternTemplateRepository,
} from '../helpers/fakes/index.js';

function createDeps(): DeepAnalysisDependencies & {
  functionCallRepo: InMemoryFunctionCallRepository;
  typeFieldRepo: InMemoryTypeFieldRepository;
  eventFlowRepo: InMemoryEventFlowRepository;
  schemaModelRepo: InMemorySchemaModelRepository;
  guardClauseRepo: InMemoryGuardClauseRepository;
} {
  return {
    functionCallRepo: new InMemoryFunctionCallRepository(),
    typeFieldRepo: new InMemoryTypeFieldRepository(),
    eventFlowRepo: new InMemoryEventFlowRepository(),
    schemaModelRepo: new InMemorySchemaModelRepository(),
    guardClauseRepo: new InMemoryGuardClauseRepository(),
  };
}

/**
 * Helper to create a code unit with a given type and ID.
 */
function makeUnit(
  overrides: Partial<Parameters<typeof createCodeUnit>[0]> & { unitType: CodeUnitType },
) {
  return createCodeUnit({
    id: overrides.id ?? 'unit-1',
    filePath: overrides.filePath ?? 'src/test.ts',
    name: overrides.name ?? 'testUnit',
    unitType: overrides.unitType,
    lineStart: overrides.lineStart ?? 1,
    lineEnd: overrides.lineEnd ?? 10,
    isAsync: overrides.isAsync ?? false,
    isExported: overrides.isExported ?? true,
    language: overrides.language ?? 'typescript',
    children: overrides.children ?? [],
  });
}

/**
 * Build a minimal FileProcessingResult for testing.
 */
function makeFileResult(
  filePath: string,
  codeUnits: ReturnType<typeof createCodeUnit>[],
  bodiesByUnitId: Map<string, string>,
): FileProcessingResult {
  return {
    filePath,
    codeUnits,
    dependencies: [],
    moduleLevelPatterns: [],
    bodiesByUnitId,
  };
}

describe('processDeepAnalysis', () => {
  let deps: ReturnType<typeof createDeps>;

  beforeEach(() => {
    deps = createDeps();
  });

  it('should return zero counts for empty input', () => {
    const result = processDeepAnalysis([], new Map(), deps);

    expect(result.functionCallsExtracted).toBe(0);
    expect(result.typeFieldsExtracted).toBe(0);
    expect(result.eventFlowsExtracted).toBe(0);
    expect(result.schemaModelsExtracted).toBe(0);
    expect(result.guardsExtracted).toBe(0);
  });

  describe('function call extraction', () => {
    it('should extract function calls from FUNCTION units and save them', () => {
      const unit = makeUnit({ id: 'fn-1', unitType: CodeUnitType.FUNCTION, name: 'myFunc' });
      const bodies = new Map([['fn-1', 'const x = helper();\nfoo(1);']]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.functionCallsExtracted).toBeGreaterThanOrEqual(2);
      const calls = deps.functionCallRepo.findAll();
      expect(calls.length).toBeGreaterThanOrEqual(2);
      expect(calls.every(c => c.callerUnitId === 'fn-1')).toBe(true);
      expect(calls.some(c => c.calleeName === 'helper')).toBe(true);
      expect(calls.some(c => c.calleeName === 'foo')).toBe(true);
    });

    it('should extract function calls from ARROW_FUNCTION units', () => {
      const unit = makeUnit({ id: 'arrow-1', unitType: CodeUnitType.ARROW_FUNCTION, name: 'myArrow' });
      const bodies = new Map([['arrow-1', 'return calculate(x);']]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.functionCallsExtracted).toBeGreaterThanOrEqual(1);
      const calls = deps.functionCallRepo.findAll();
      expect(calls.some(c => c.calleeName === 'calculate')).toBe(true);
    });

    it('should extract function calls from METHOD units', () => {
      const unit = makeUnit({ id: 'method-1', unitType: CodeUnitType.METHOD, name: 'doWork' });
      const bodies = new Map([['method-1', 'this.validate();\nprocess(data);']]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.functionCallsExtracted).toBeGreaterThanOrEqual(2);
    });

    it('should NOT extract function calls from CLASS units', () => {
      const unit = makeUnit({ id: 'class-1', unitType: CodeUnitType.CLASS, name: 'MyClass' });
      const bodies = new Map([['class-1', 'constructor() { init(); }']]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.functionCallsExtracted).toBe(0);
    });

    it('should NOT extract function calls from INTERFACE units', () => {
      const unit = makeUnit({ id: 'iface-1', unitType: CodeUnitType.INTERFACE, name: 'IFoo' });
      const bodies = new Map([['iface-1', 'doSomething(): void;']]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.functionCallsExtracted).toBe(0);
    });
  });

  describe('type field extraction', () => {
    it('should extract type fields from INTERFACE units and save them', () => {
      const unit = makeUnit({ id: 'iface-1', unitType: CodeUnitType.INTERFACE, name: 'UserData' });
      const bodies = new Map([['iface-1', '  readonly id: string;\n  name: string;\n  email?: string;']]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.typeFieldsExtracted).toBe(3);
      const fields = deps.typeFieldRepo.findAll();
      expect(fields.length).toBe(3);
      expect(fields.every(f => f.parentUnitId === 'iface-1')).toBe(true);
      expect(fields.some(f => f.name === 'id' && f.isReadonly)).toBe(true);
      expect(fields.some(f => f.name === 'email' && f.isOptional)).toBe(true);
    });

    it('should extract type fields from CLASS units', () => {
      const unit = makeUnit({ id: 'class-1', unitType: CodeUnitType.CLASS, name: 'User' });
      const bodies = new Map([['class-1', '  private name: string;\n  public age: number;']]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.typeFieldsExtracted).toBe(2);
    });

    it('should extract type fields from TYPE_ALIAS units', () => {
      const unit = makeUnit({ id: 'type-1', unitType: CodeUnitType.TYPE_ALIAS, name: 'Config' });
      const bodies = new Map([['type-1', '  host: string;\n  port: number;']]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.typeFieldsExtracted).toBe(2);
    });

    it('should extract type fields from STRUCT units', () => {
      const unit = makeUnit({ id: 'struct-1', unitType: CodeUnitType.STRUCT, name: 'Point' });
      const bodies = new Map([['struct-1', '  x: number;\n  y: number;']]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.typeFieldsExtracted).toBe(2);
    });

    it('should extract type fields from ENUM units', () => {
      const unit = makeUnit({ id: 'enum-1', unitType: CodeUnitType.ENUM, name: 'Status' });
      const bodies = new Map([['enum-1', '  value: string;']]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.typeFieldsExtracted).toBe(1);
    });

    it('should NOT extract type fields from FUNCTION units', () => {
      const unit = makeUnit({ id: 'fn-1', unitType: CodeUnitType.FUNCTION, name: 'myFunc' });
      const bodies = new Map([['fn-1', '  name: string;\n  age: number;']]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.typeFieldsExtracted).toBe(0);
    });
  });

  describe('event flow extraction', () => {
    it('should extract event flows from FUNCTION units and save them', () => {
      const unit = makeUnit({ id: 'fn-1', unitType: CodeUnitType.FUNCTION, name: 'setupEvents' });
      const bodies = new Map([['fn-1', `emitter.emit('data-ready', payload);\nemitter.on('error', handler);`]]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.eventFlowsExtracted).toBe(2);
      const flows = deps.eventFlowRepo.findAll();
      expect(flows.length).toBe(2);
      expect(flows.every(f => f.codeUnitId === 'fn-1')).toBe(true);
      expect(flows.some(f => f.eventName === 'data-ready' && f.direction === 'emit')).toBe(true);
      expect(flows.some(f => f.eventName === 'error' && f.direction === 'subscribe')).toBe(true);
    });

    it('should NOT extract event flows from INTERFACE units', () => {
      const unit = makeUnit({ id: 'iface-1', unitType: CodeUnitType.INTERFACE, name: 'IHandler' });
      const bodies = new Map([['iface-1', `emitter.emit('test');`]]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.eventFlowsExtracted).toBe(0);
    });
  });

  describe('guard extraction', () => {
    it('should count guards from FUNCTION units', () => {
      const unit = makeUnit({ id: 'fn-1', unitType: CodeUnitType.FUNCTION, name: 'validate' });
      const bodies = new Map([['fn-1', `if (!input) return;\nif (typeof x === 'string') return;\nthrow new Error('fail');`]]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.guardsExtracted).toBeGreaterThanOrEqual(2);
    });

    it('should NOT count guards from CLASS units', () => {
      const unit = makeUnit({ id: 'class-1', unitType: CodeUnitType.CLASS, name: 'MyClass' });
      const bodies = new Map([['class-1', `if (!input) return;\nthrow new Error('fail');`]]);
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.guardsExtracted).toBe(0);
    });
  });

  describe('schema model extraction', () => {
    it('should extract Prisma models from file contents and save them', () => {
      const prismaContent = `
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
}
`;
      const fileContents = new Map([['schema.prisma', prismaContent]]);

      const result = processDeepAnalysis([], fileContents, deps);

      expect(result.schemaModelsExtracted).toBe(1);
      const models = deps.schemaModelRepo.findAll();
      expect(models.length).toBe(1);
      expect(models[0].name).toBe('User');
      expect(models[0].framework).toBe('prisma');
      expect(models[0].filePath).toBe('schema.prisma');
      expect(models[0].fields.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract multiple schema models from one file', () => {
      const prismaContent = `
model User {
  id    Int     @id
  email String
}

model Post {
  id    Int     @id
  title String
}
`;
      const fileContents = new Map([['schema.prisma', prismaContent]]);

      const result = processDeepAnalysis([], fileContents, deps);

      expect(result.schemaModelsExtracted).toBe(2);
      const models = deps.schemaModelRepo.findAll();
      expect(models.some(m => m.name === 'User')).toBe(true);
      expect(models.some(m => m.name === 'Post')).toBe(true);
    });

    it('should not extract schema models from non-schema files', () => {
      const tsContent = `export function hello() { return 'world'; }`;
      const fileContents = new Map([['src/hello.ts', tsContent]]);

      const result = processDeepAnalysis([], fileContents, deps);

      expect(result.schemaModelsExtracted).toBe(0);
    });
  });

  describe('children processing', () => {
    it('should process child code units recursively', () => {
      const childMethod = makeUnit({
        id: 'method-1',
        unitType: CodeUnitType.METHOD,
        name: 'doWork',
      });
      const parentClass = makeUnit({
        id: 'class-1',
        unitType: CodeUnitType.CLASS,
        name: 'Worker',
        children: [childMethod],
      });
      const bodies = new Map([
        ['class-1', '  name: string;\n  status: number;'],
        ['method-1', 'helper();\nprocess(data);'],
      ]);
      const fileResult = makeFileResult('src/test.ts', [parentClass], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      // Class should produce type fields
      expect(result.typeFieldsExtracted).toBe(2);
      const fields = deps.typeFieldRepo.findAll();
      expect(fields.every(f => f.parentUnitId === 'class-1')).toBe(true);

      // Method child should produce function calls
      expect(result.functionCallsExtracted).toBeGreaterThanOrEqual(2);
      const calls = deps.functionCallRepo.findAll();
      expect(calls.every(c => c.callerUnitId === 'method-1')).toBe(true);
    });

    it('should process deeply nested children', () => {
      const innerMethod = makeUnit({
        id: 'inner-method',
        unitType: CodeUnitType.METHOD,
        name: 'innerWork',
      });
      const outerMethod = makeUnit({
        id: 'outer-method',
        unitType: CodeUnitType.METHOD,
        name: 'outerWork',
        children: [innerMethod],
      });
      const parentClass = makeUnit({
        id: 'class-1',
        unitType: CodeUnitType.CLASS,
        name: 'Service',
        children: [outerMethod],
      });
      const bodies = new Map([
        ['class-1', '  active: boolean;'],
        ['outer-method', 'callA();'],
        ['inner-method', 'callB();'],
      ]);
      const fileResult = makeFileResult('src/test.ts', [parentClass], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      // Type fields from class
      expect(result.typeFieldsExtracted).toBe(1);

      // Function calls from both methods
      const calls = deps.functionCallRepo.findAll();
      expect(calls.some(c => c.callerUnitId === 'outer-method' && c.calleeName === 'callA')).toBe(true);
      expect(calls.some(c => c.callerUnitId === 'inner-method' && c.calleeName === 'callB')).toBe(true);
    });
  });

  describe('multiple files', () => {
    it('should process multiple file results and aggregate counts', () => {
      const fn1 = makeUnit({ id: 'fn-1', unitType: CodeUnitType.FUNCTION, name: 'func1' });
      const fn2 = makeUnit({ id: 'fn-2', unitType: CodeUnitType.FUNCTION, name: 'func2' });
      const bodies1 = new Map([['fn-1', 'alpha();']]);
      const bodies2 = new Map([['fn-2', 'beta();\ngamma();']]);

      const fileResults = [
        makeFileResult('src/a.ts', [fn1], bodies1),
        makeFileResult('src/b.ts', [fn2], bodies2),
      ];

      const result = processDeepAnalysis(fileResults, new Map(), deps);

      expect(result.functionCallsExtracted).toBeGreaterThanOrEqual(3);
    });
  });

  describe('batch saving', () => {
    it('should save function calls in batch per file', () => {
      const fn = makeUnit({ id: 'fn-1', unitType: CodeUnitType.FUNCTION, name: 'test' });
      const bodies = new Map([['fn-1', 'a();\nb();\nc();']]);
      const fileResult = makeFileResult('src/test.ts', [fn], bodies);

      processDeepAnalysis([fileResult], new Map(), deps);

      const calls = deps.functionCallRepo.findAll();
      expect(calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('units with no body', () => {
    it('should skip units with no body in bodiesByUnitId', () => {
      const unit = makeUnit({ id: 'fn-1', unitType: CodeUnitType.FUNCTION, name: 'noBody' });
      const bodies = new Map<string, string>(); // empty — no body for fn-1
      const fileResult = makeFileResult('src/test.ts', [unit], bodies);

      const result = processDeepAnalysis([fileResult], new Map(), deps);

      expect(result.functionCallsExtracted).toBe(0);
      expect(result.typeFieldsExtracted).toBe(0);
      expect(result.eventFlowsExtracted).toBe(0);
      expect(result.guardsExtracted).toBe(0);
    });
  });

  describe('file clustering', () => {
    it('should compute and save file clusters after deep analysis when repos are provided', () => {
      const dependencyRepo = new InMemoryFileDependencyRepository();
      const fileClusterRepo = new InMemoryFileClusterRepository();

      // Add some file dependencies
      dependencyRepo.save(createFileDependency({
        sourceFile: 'src/a.ts',
        targetFile: 'src/b.ts',
        importType: 'named',
        importedNames: ['foo'],
      }));
      dependencyRepo.save(createFileDependency({
        sourceFile: 'src/b.ts',
        targetFile: 'src/c.ts',
        importType: 'named',
        importedNames: ['bar'],
      }));

      const depsWithClustering: DeepAnalysisDependencies = {
        ...deps,
        dependencyRepo,
        fileClusterRepo,
      };

      const result = processDeepAnalysis([], new Map(), depsWithClustering);

      // Clusters should have been computed and saved
      const clusters = fileClusterRepo.findAll();
      expect(clusters.length).toBeGreaterThanOrEqual(1);
      expect(result.clustersComputed).toBeGreaterThanOrEqual(1);
    });

    it('should not run clustering when fileClusterRepo is not provided', () => {
      const result = processDeepAnalysis([], new Map(), deps);

      // No crash, just zero clusters
      expect(result.clustersComputed).toBe(0);
    });

    it('should clear existing clusters before saving new ones', () => {
      const dependencyRepo = new InMemoryFileDependencyRepository();
      const fileClusterRepo = new InMemoryFileClusterRepository();

      // Pre-populate with old cluster data
      fileClusterRepo.save(
        { id: 'old-cluster', name: 'old', cohesion: 1, internalEdges: 0, externalEdges: 0 },
        [{ clusterId: 'old-cluster', filePath: 'src/old.ts', isEntryPoint: false }],
      );

      dependencyRepo.save(createFileDependency({
        sourceFile: 'src/x.ts',
        targetFile: 'src/y.ts',
        importType: 'named',
        importedNames: ['x'],
      }));

      const depsWithClustering: DeepAnalysisDependencies = {
        ...deps,
        dependencyRepo,
        fileClusterRepo,
      };

      processDeepAnalysis([], new Map(), depsWithClustering);

      const clusters = fileClusterRepo.findAll();
      // Old cluster should be cleared; only new clusters remain
      expect(clusters.some(c => c.cluster.id === 'old-cluster')).toBe(false);
      expect(clusters.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty dependencies gracefully (no clusters)', () => {
      const dependencyRepo = new InMemoryFileDependencyRepository();
      const fileClusterRepo = new InMemoryFileClusterRepository();

      const depsWithClustering: DeepAnalysisDependencies = {
        ...deps,
        dependencyRepo,
        fileClusterRepo,
      };

      const result = processDeepAnalysis([], new Map(), depsWithClustering);

      const clusters = fileClusterRepo.findAll();
      expect(clusters.length).toBe(0);
      expect(result.clustersComputed).toBe(0);
    });
  });

  describe('pattern template detection', () => {
    it('should detect and save pattern templates when repos are provided', () => {
      const codeUnitRepo = new InMemoryCodeUnitRepository();
      const patternTemplateRepo = new InMemoryPatternTemplateRepository();

      // Create 3+ units with the same pattern combo so templates are detected
      const units = ['fn-1', 'fn-2', 'fn-3'].map(id =>
        createCodeUnit({
          id,
          filePath: `src/${id}.ts`,
          name: `handler_${id}`,
          unitType: CodeUnitType.FUNCTION,
          lineStart: 1,
          lineEnd: 10,
          isAsync: false,
          isExported: true,
          language: 'typescript',
          patterns: [
            createCodeUnitPattern({ codeUnitId: id, patternType: PatternType.API_ENDPOINT, patternValue: 'GET /api' }),
            createCodeUnitPattern({ codeUnitId: id, patternType: PatternType.DATABASE_READ, patternValue: 'findMany' }),
          ],
        }),
      );

      // Save units to the repo (as the orchestrator would have done)
      codeUnitRepo.saveBatch(units);

      const depsWithTemplates: DeepAnalysisDependencies = {
        ...deps,
        codeUnitRepo,
        patternTemplateRepo,
      };

      const result = processDeepAnalysis([], new Map(), depsWithTemplates);

      expect(result.templatesDetected).toBeGreaterThanOrEqual(1);
      const templates = patternTemplateRepo.findAll();
      expect(templates.length).toBeGreaterThanOrEqual(1);
      expect(templates[0].template.patternTypes).toContain('API_ENDPOINT');
      expect(templates[0].template.patternTypes).toContain('DATABASE_READ');
    });

    it('should not run template detection when patternTemplateRepo is not provided', () => {
      const result = processDeepAnalysis([], new Map(), deps);

      expect(result.templatesDetected).toBe(0);
    });

    it('should clear existing templates before saving new ones', () => {
      const codeUnitRepo = new InMemoryCodeUnitRepository();
      const patternTemplateRepo = new InMemoryPatternTemplateRepository();

      // Pre-populate with old template
      patternTemplateRepo.save(
        {
          id: 'old-template',
          name: 'Old',
          description: 'Old template',
          patternTypes: ['API_ENDPOINT'],
          templateUnitId: 'old-unit',
          templateFilePath: 'src/old.ts',
          followerCount: 0,
          conventions: ['old convention'],
        },
        [],
      );
      expect(patternTemplateRepo.findAll().length).toBe(1);

      // Create 3 units with same pattern so new templates are detected
      const units = ['fn-1', 'fn-2', 'fn-3'].map(id =>
        createCodeUnit({
          id,
          filePath: `src/${id}.ts`,
          name: `handler_${id}`,
          unitType: CodeUnitType.FUNCTION,
          lineStart: 1,
          lineEnd: 10,
          isAsync: false,
          isExported: true,
          language: 'typescript',
          patterns: [
            createCodeUnitPattern({ codeUnitId: id, patternType: PatternType.DATABASE_WRITE, patternValue: 'create' }),
          ],
        }),
      );
      codeUnitRepo.saveBatch(units);

      const depsWithTemplates: DeepAnalysisDependencies = {
        ...deps,
        codeUnitRepo,
        patternTemplateRepo,
      };

      processDeepAnalysis([], new Map(), depsWithTemplates);

      const templates = patternTemplateRepo.findAll();
      // Old template should be gone
      expect(templates.some(t => t.template.id === 'old-template')).toBe(false);
    });

    it('should return zero templatesDetected when no patterns qualify', () => {
      const codeUnitRepo = new InMemoryCodeUnitRepository();
      const patternTemplateRepo = new InMemoryPatternTemplateRepository();

      // Only 2 units with same pattern — not enough for template (need 3+)
      const units = ['fn-1', 'fn-2'].map(id =>
        createCodeUnit({
          id,
          filePath: `src/${id}.ts`,
          name: `handler_${id}`,
          unitType: CodeUnitType.FUNCTION,
          lineStart: 1,
          lineEnd: 10,
          isAsync: false,
          isExported: true,
          language: 'typescript',
          patterns: [
            createCodeUnitPattern({ codeUnitId: id, patternType: PatternType.API_ENDPOINT, patternValue: 'GET /api' }),
          ],
        }),
      );
      codeUnitRepo.saveBatch(units);

      const depsWithTemplates: DeepAnalysisDependencies = {
        ...deps,
        codeUnitRepo,
        patternTemplateRepo,
      };

      const result = processDeepAnalysis([], new Map(), depsWithTemplates);

      expect(result.templatesDetected).toBe(0);
      expect(patternTemplateRepo.findAll().length).toBe(0);
    });
  });
});
