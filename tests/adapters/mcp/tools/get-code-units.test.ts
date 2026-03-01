import { describe, it, expect, beforeEach } from 'vitest';
import { createGetCodeUnitsTool } from '@/adapters/mcp/tools/get-code-units.js';
import { InMemoryCodeUnitRepository, InMemoryFileSystem } from '../../../../tests/helpers/fakes/index.js';
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

  it('should include signature in compact format when present', async () => {
    codeUnitRepo.save(createCodeUnit({
      filePath: 'src/d.ts', name: 'fnD', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 5, isAsync: false, isExported: true, language: 'typescript',
      signature: 'function fnD(x: number): string',
    }));

    const result = await handler({ name: 'fnD', format: 'compact' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].signature).toBe('function fnD(x: number): string');
  });

  it('should omit signature in compact format when not present', async () => {
    const result = await handler({ name: 'fnA', format: 'compact' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]).not.toHaveProperty('signature');
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

  describe('include_source', () => {
    let fileSystem: InMemoryFileSystem;

    beforeEach(async () => {
      fileSystem = new InMemoryFileSystem();
      await fileSystem.writeFile('src/a.ts', 'function fnA() {\n  return 1;\n}\n// line4\n// line5\n// line6\n// line7\n// line8\n// line9\n// line10');
      await fileSystem.writeFile('src/b.ts', Array.from({ length: 50 }, (_, i) => `line${i + 1}`).join('\n'));
      await fileSystem.writeFile('src/c.py', 'def fn_c():\n    pass\n# line3\n# line4\n# line5');

      const tool = createGetCodeUnitsTool({ codeUnitRepo, fileSystem });
      handler = tool.handler;
    });

    it('should include source in compact format when include_source is true', async () => {
      const result = await handler({ name: 'fnA', format: 'compact', include_source: true });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].source).toBeDefined();
      expect(parsed.data[0].source).toContain('function fnA');
    });

    it('should include source in full format when include_source is true', async () => {
      const result = await handler({ name: 'fnA', format: 'full', include_source: true });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].source).toBeDefined();
      expect(parsed.data[0].source).toContain('function fnA');
    });

    it('should not include source when include_source is false', async () => {
      const result = await handler({ name: 'fnA', include_source: false });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0]).not.toHaveProperty('source');
    });

    it('should not include source when include_source is omitted', async () => {
      const result = await handler({ name: 'fnA' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0]).not.toHaveProperty('source');
    });

    it('should only fetch source for the paginated subset', async () => {
      const result = await handler({ limit: 1, offset: 0, include_source: true });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0]).toHaveProperty('source');
    });
  });
});
