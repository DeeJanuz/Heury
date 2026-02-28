import { describe, it, expect, beforeEach } from 'vitest';
import { createGetModuleOverviewTool } from '@/adapters/mcp/tools/get-module-overview.js';
import { InMemoryCodeUnitRepository } from '../../../../tests/helpers/fakes/index.js';
import { createCodeUnit, CodeUnitType } from '@/domain/models/index.js';

describe('get-module-overview tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let handler: ReturnType<typeof createGetModuleOverviewTool>['handler'];

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    const tool = createGetModuleOverviewTool({ codeUnitRepo });
    handler = tool.handler;

    codeUnitRepo.save(createCodeUnit({
      filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
    }));
    codeUnitRepo.save(createCodeUnit({
      filePath: 'src/a.ts', name: 'fnB', unitType: CodeUnitType.FUNCTION,
      lineStart: 12, lineEnd: 20, isAsync: true, isExported: false, language: 'typescript',
    }));
    codeUnitRepo.save(createCodeUnit({
      filePath: 'src/b.py', name: 'fn_c', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 8, isAsync: false, isExported: true, language: 'python',
    }));
  });

  it('should return file-grouped overview', async () => {
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(2); // 2 files
    const tsFile = parsed.data.find((f: { file_path: string }) => f.file_path === 'src/a.ts');
    expect(tsFile).toBeDefined();
    expect(tsFile.code_units).toHaveLength(2);
  });

  it('should include signature in code unit entries when present', async () => {
    codeUnitRepo.save(createCodeUnit({
      filePath: 'src/a.ts', name: 'fnSig', unitType: CodeUnitType.FUNCTION,
      lineStart: 30, lineEnd: 40, isAsync: false, isExported: true, language: 'typescript',
      signature: 'function fnSig(): void',
    }));

    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    const tsFile = parsed.data.find((f: { file_path: string }) => f.file_path === 'src/a.ts');
    const sigUnit = tsFile.code_units.find((u: { name: string }) => u.name === 'fnSig');
    expect(sigUnit.signature).toBe('function fnSig(): void');
  });

  it('should omit signature in code unit entries when not present', async () => {
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    const tsFile = parsed.data.find((f: { file_path: string }) => f.file_path === 'src/a.ts');
    const unitWithoutSig = tsFile.code_units.find((u: { name: string }) => u.name === 'fnA');
    expect(unitWithoutSig).not.toHaveProperty('signature');
  });

  it('should filter by language', async () => {
    const result = await handler({ language: 'python' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].file_path).toBe('src/b.py');
  });
});
