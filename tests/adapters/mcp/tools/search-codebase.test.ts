import { describe, it, expect, beforeEach } from 'vitest';
import { createSearchCodebaseTool } from '@/adapters/mcp/tools/search-codebase.js';
import { InMemoryCodeUnitRepository, InMemoryFileSystem } from '../../../../tests/helpers/fakes/index.js';
import { createCodeUnit, CodeUnitType, createCodeUnitPattern, PatternType } from '@/domain/models/index.js';

describe('search-codebase tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let handler: ReturnType<typeof createSearchCodebaseTool>['handler'];

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    const tool = createSearchCodebaseTool({ codeUnitRepo });
    handler = tool.handler;

    const unit1 = createCodeUnit({
      id: 'unit-1',
      filePath: 'src/auth/login.ts', name: 'handleLogin', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 20, isAsync: true, isExported: true, language: 'typescript',
      patterns: [
        createCodeUnitPattern({ codeUnitId: 'unit-1', patternType: PatternType.API_ENDPOINT, patternValue: 'POST /api/login' }),
      ],
    });
    const unit2 = createCodeUnit({
      id: 'unit-2',
      filePath: 'src/user/profile.ts', name: 'getProfile', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 15, isAsync: true, isExported: true, language: 'typescript',
    });
    codeUnitRepo.save(unit1);
    codeUnitRepo.save(unit2);
  });

  it('should search by name substring', async () => {
    const result = await handler({ query: 'login' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe('handleLogin');
  });

  it('should search by file path', async () => {
    const result = await handler({ query: 'profile', type: 'file' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].filePath).toContain('profile');
  });

  it('should include signature in search results when present', async () => {
    codeUnitRepo.save(createCodeUnit({
      id: 'unit-3',
      filePath: 'src/utils/helper.ts', name: 'helperFn', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
      signature: 'function helperFn(a: string, b: number): boolean',
    }));

    const result = await handler({ query: 'helper' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].signature).toBe('function helperFn(a: string, b: number): boolean');
  });

  it('should omit signature in search results when not present', async () => {
    const result = await handler({ query: 'login' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]).not.toHaveProperty('signature');
  });

  it('should return empty with context for no matches', async () => {
    const result = await handler({ query: 'nonexistent' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(0);
    expect(parsed.meta.context).toBeDefined();
    expect(parsed.meta.context.reason).toBe('no_matches');
  });

  describe('include_source', () => {
    let fileSystem: InMemoryFileSystem;

    beforeEach(async () => {
      fileSystem = new InMemoryFileSystem();
      await fileSystem.writeFile('src/auth/login.ts', 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\nline11\nline12\nline13\nline14\nline15\nline16\nline17\nline18\nline19\nline20');
      await fileSystem.writeFile('src/user/profile.ts', 'profile line1\nprofile line2\nprofile line3\nprofile line4\nprofile line5\nprofile line6\nprofile line7\nprofile line8\nprofile line9\nprofile line10\nprofile line11\nprofile line12\nprofile line13\nprofile line14\nprofile line15');

      const tool = createSearchCodebaseTool({ codeUnitRepo, fileSystem });
      handler = tool.handler;
    });

    it('should include source when include_source is true', async () => {
      const result = await handler({ query: 'login', include_source: true });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].source).toBeDefined();
      expect(parsed.data[0].source).toContain('line1');
    });

    it('should not include source when include_source is false', async () => {
      const result = await handler({ query: 'login', include_source: false });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0]).not.toHaveProperty('source');
    });

    it('should not include source when include_source is omitted', async () => {
      const result = await handler({ query: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0]).not.toHaveProperty('source');
    });

    it('should include source for multiple results', async () => {
      const result = await handler({ query: '', type: 'code_unit', include_source: true });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.length).toBeGreaterThanOrEqual(2);
      for (const item of parsed.data) {
        expect(item).toHaveProperty('source');
      }
    });

    it('should return null source when file is not found', async () => {
      codeUnitRepo.save(createCodeUnit({
        id: 'unit-missing',
        filePath: 'src/missing/file.ts', name: 'missingFn', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 5, isAsync: false, isExported: true, language: 'typescript',
      }));

      const result = await handler({ query: 'missingFn', include_source: true });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].source).toBeNull();
    });
  });
});
