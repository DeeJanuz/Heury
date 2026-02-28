import { describe, it, expect, beforeEach } from 'vitest';
import { createSearchCodebaseTool } from '@/adapters/mcp/tools/search-codebase.js';
import { InMemoryCodeUnitRepository } from '../../../../tests/helpers/fakes/index.js';
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
});
