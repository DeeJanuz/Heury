import { describe, it, expect, beforeEach } from 'vitest';
import { createGetCodeUnitsTool } from '@/adapters/mcp/tools/get-code-units.js';
import { InMemoryCodeUnitRepository } from '../../../../tests/helpers/fakes/index.js';
import { createCodeUnit, CodeUnitType } from '@/domain/models/index.js';

describe('get-code-units tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let handler: ReturnType<typeof createGetCodeUnitsTool>['handler'];

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    const tool = createGetCodeUnitsTool({ codeUnitRepo });
    handler = tool.handler;

    codeUnitRepo.save(createCodeUnit({
      filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
      complexityScore: 5,
    }));
    codeUnitRepo.save(createCodeUnit({
      filePath: 'src/b.ts', name: 'ClassB', unitType: CodeUnitType.CLASS,
      lineStart: 1, lineEnd: 50, isAsync: false, isExported: false, language: 'typescript',
      complexityScore: 20,
    }));
    codeUnitRepo.save(createCodeUnit({
      filePath: 'src/c.py', name: 'fn_c', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 5, isAsync: true, isExported: true, language: 'python',
      complexityScore: 2,
    }));
  });

  it('should return all code units', async () => {
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(3);
    expect(parsed.meta.result_count).toBe(3);
  });

  it('should filter by file_path', async () => {
    const result = await handler({ file_path: 'src/a.ts' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe('fnA');
  });

  it('should filter by unit_type', async () => {
    const result = await handler({ unit_type: 'CLASS' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe('ClassB');
  });

  it('should return compact vs full format', async () => {
    const compactResult = await handler({ format: 'compact' });
    const fullResult = await handler({ format: 'full' });

    const compact = JSON.parse(compactResult.content[0].text);
    const full = JSON.parse(fullResult.content[0].text);

    // Compact should have fewer fields than full
    const compactKeys = Object.keys(compact.data[0]);
    const fullKeys = Object.keys(full.data[0]);
    expect(compactKeys.length).toBeLessThan(fullKeys.length);
  });
});
