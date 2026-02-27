import { describe, it, expect, beforeEach } from 'vitest';
import { createGetApiEndpointsTool } from '@/adapters/mcp/tools/get-api-endpoints.js';
import { InMemoryCodeUnitRepository } from '../../../../tests/helpers/fakes/index.js';
import { createCodeUnit, CodeUnitType, createCodeUnitPattern, PatternType } from '@/domain/models/index.js';

describe('get-api-endpoints tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let handler: ReturnType<typeof createGetApiEndpointsTool>['handler'];

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    const tool = createGetApiEndpointsTool({ codeUnitRepo });
    handler = tool.handler;

    codeUnitRepo.save(createCodeUnit({
      id: 'unit-1',
      filePath: 'src/routes/auth.ts', name: 'loginHandler', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 20, isAsync: true, isExported: true, language: 'typescript',
      patterns: [
        createCodeUnitPattern({ codeUnitId: 'unit-1', patternType: PatternType.API_ENDPOINT, patternValue: 'POST /api/login' }),
      ],
    }));
    codeUnitRepo.save(createCodeUnit({
      id: 'unit-2',
      filePath: 'src/routes/users.ts', name: 'getUsers', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 15, isAsync: true, isExported: true, language: 'typescript',
      patterns: [
        createCodeUnitPattern({ codeUnitId: 'unit-2', patternType: PatternType.API_ENDPOINT, patternValue: 'GET /api/users' }),
      ],
    }));
    codeUnitRepo.save(createCodeUnit({
      id: 'unit-3',
      filePath: 'src/utils/helper.ts', name: 'formatDate', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 5, isAsync: false, isExported: true, language: 'typescript',
      patterns: [
        createCodeUnitPattern({ codeUnitId: 'unit-3', patternType: PatternType.ENV_VARIABLE, patternValue: 'DATE_FORMAT' }),
      ],
    }));
  });

  it('should return only API endpoint patterns', async () => {
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(2);
    expect(parsed.data.every((e: { patternType: string }) => e.patternType === 'API_ENDPOINT')).toBe(true);
  });

  it('should filter by HTTP method', async () => {
    const result = await handler({ method: 'GET' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].patternValue).toContain('GET');
  });

  it('should return empty for no endpoints', async () => {
    codeUnitRepo.clear();
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(0);
  });
});
