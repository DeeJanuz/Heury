import { describe, it, expect, beforeEach } from 'vitest';
import { createGetAnalysisStatsTool } from '@/adapters/mcp/tools/get-analysis-stats.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryFileDependencyRepository,
  InMemoryEnvVariableRepository,
} from '../../../../tests/helpers/fakes/index.js';
import {
  createCodeUnit,
  CodeUnitType,
  createFileDependency,
  ImportType,
  createEnvVariable,
} from '@/domain/models/index.js';

describe('get-analysis-stats tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let dependencyRepo: InMemoryFileDependencyRepository;
  let envVarRepo: InMemoryEnvVariableRepository;
  let handler: ReturnType<typeof createGetAnalysisStatsTool>['handler'];

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    dependencyRepo = new InMemoryFileDependencyRepository();
    envVarRepo = new InMemoryEnvVariableRepository();
    const tool = createGetAnalysisStatsTool({ codeUnitRepo, dependencyRepo, envVarRepo });
    handler = tool.handler;
  });

  it('should return stats from populated repos', async () => {
    codeUnitRepo.save(createCodeUnit({
      filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
    }));
    dependencyRepo.save(createFileDependency({
      sourceFile: 'src/a.ts', targetFile: 'src/b.ts', importType: ImportType.NAMED,
    }));
    envVarRepo.save(createEnvVariable({ name: 'API_KEY', lineNumber: 1 }));

    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.total_code_units).toBe(1);
    expect(parsed.data.total_dependencies).toBe(1);
    expect(parsed.data.total_env_variables).toBe(1);
  });

  it('should return zeros for empty repos', async () => {
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.total_code_units).toBe(0);
    expect(parsed.data.total_dependencies).toBe(0);
    expect(parsed.data.total_files).toBe(0);
  });

  it('should include language breakdown', async () => {
    codeUnitRepo.save(createCodeUnit({
      filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
    }));
    codeUnitRepo.save(createCodeUnit({
      filePath: 'src/b.py', name: 'fn_b', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 5, isAsync: false, isExported: true, language: 'python',
    }));
    codeUnitRepo.save(createCodeUnit({
      filePath: 'src/c.ts', name: 'fnC', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 8, isAsync: false, isExported: true, language: 'typescript',
    }));

    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.languages).toEqual({ typescript: 2, python: 1 });
  });
});
