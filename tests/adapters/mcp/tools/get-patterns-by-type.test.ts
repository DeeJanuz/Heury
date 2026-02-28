import { describe, it, expect, beforeEach } from 'vitest';
import { createGetPatternsByTypeTool } from '@/adapters/mcp/tools/get-patterns-by-type.js';
import { InMemoryCodeUnitRepository } from '../../../../tests/helpers/fakes/index.js';
import { createCodeUnit, CodeUnitType, createCodeUnitPattern, PatternType } from '@/domain/models/index.js';

describe('get-patterns-by-type tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let handler: ReturnType<typeof createGetPatternsByTypeTool>['handler'];
  let definition: ReturnType<typeof createGetPatternsByTypeTool>['definition'];

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    const tool = createGetPatternsByTypeTool({ codeUnitRepo });
    handler = tool.handler;
    definition = tool.definition;

    codeUnitRepo.save(createCodeUnit({
      id: 'unit-1',
      filePath: 'src/routes/auth.ts', name: 'loginHandler', unitType: CodeUnitType.FUNCTION,
      lineStart: 10, lineEnd: 30, isAsync: true, isExported: true, language: 'typescript',
      patterns: [
        createCodeUnitPattern({ codeUnitId: 'unit-1', patternType: PatternType.API_ENDPOINT, patternValue: 'POST /api/login', lineNumber: 12 }),
        createCodeUnitPattern({ codeUnitId: 'unit-1', patternType: PatternType.DATABASE_READ, patternValue: 'SELECT users', lineNumber: 18 }),
      ],
    }));
    codeUnitRepo.save(createCodeUnit({
      id: 'unit-2',
      filePath: 'src/routes/users.ts', name: 'getUsers', unitType: CodeUnitType.FUNCTION,
      lineStart: 1, lineEnd: 15, isAsync: true, isExported: true, language: 'typescript',
      patterns: [
        createCodeUnitPattern({ codeUnitId: 'unit-2', patternType: PatternType.API_ENDPOINT, patternValue: 'GET /api/users', lineNumber: 3 }),
        createCodeUnitPattern({
          codeUnitId: 'unit-2',
          patternType: PatternType.DATABASE_READ,
          patternValue: 'SELECT users',
          lineNumber: 8,
          columnAccess: { read: ['id', 'name', 'email'], write: [] },
        }),
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

  describe('definition', () => {
    it('should have the correct tool name', () => {
      expect(definition.name).toBe('get-patterns-by-type');
    });

    it('should require pattern_type in the input schema', () => {
      const schema = definition.inputSchema as { required?: string[] };
      expect(schema.required).toContain('pattern_type');
    });
  });

  describe('handler', () => {
    it('should return error when pattern_type is not provided', async () => {
      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('pattern_type');
    });

    it('should return all patterns matching the requested type', async () => {
      const result = await handler({ pattern_type: 'DATABASE_READ' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(2);
      expect(parsed.data.every((p: { patternType: string }) => p.patternType === 'DATABASE_READ')).toBe(true);
    });

    it('should include code unit context in each result', async () => {
      const result = await handler({ pattern_type: 'API_ENDPOINT' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(2);
      const loginEndpoint = parsed.data.find((p: { codeUnitName: string }) => p.codeUnitName === 'loginHandler');
      expect(loginEndpoint).toBeDefined();
      expect(loginEndpoint.patternType).toBe('API_ENDPOINT');
      expect(loginEndpoint.patternValue).toBe('POST /api/login');
      expect(loginEndpoint.filePath).toBe('src/routes/auth.ts');
      expect(loginEndpoint.lineNumber).toBe(12);
    });

    it('should include columnAccess when present on the pattern', async () => {
      const result = await handler({ pattern_type: 'DATABASE_READ' });
      const parsed = JSON.parse(result.content[0].text);

      const withColumnAccess = parsed.data.find(
        (p: { codeUnitName: string }) => p.codeUnitName === 'getUsers',
      );
      expect(withColumnAccess).toBeDefined();
      expect(withColumnAccess.columnAccess).toEqual({ read: ['id', 'name', 'email'], write: [] });
    });

    it('should omit columnAccess when not present on the pattern', async () => {
      const result = await handler({ pattern_type: 'API_ENDPOINT' });
      const parsed = JSON.parse(result.content[0].text);

      // API_ENDPOINT patterns don't have columnAccess
      for (const item of parsed.data) {
        expect(item.columnAccess).toBeUndefined();
      }
    });

    it('should filter by file_path when provided', async () => {
      const result = await handler({ pattern_type: 'API_ENDPOINT', file_path: 'src/routes/auth.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].codeUnitName).toBe('loginHandler');
    });

    it('should return empty results when file_path matches no units', async () => {
      const result = await handler({ pattern_type: 'API_ENDPOINT', file_path: 'src/nonexistent.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(0);
    });

    it('should apply default limit of 100', async () => {
      const result = await handler({ pattern_type: 'API_ENDPOINT' });
      const parsed = JSON.parse(result.content[0].text);

      // With only 2 results, hasMore should be false
      expect(parsed.meta.has_more).toBe(false);
      expect(parsed.meta.total_count).toBe(2);
    });

    it('should apply custom limit when provided', async () => {
      const result = await handler({ pattern_type: 'API_ENDPOINT', limit: 1 });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.meta.total_count).toBe(2);
      expect(parsed.meta.has_more).toBe(true);
    });

    it('should return empty array when no patterns match the type', async () => {
      const result = await handler({ pattern_type: 'DATABASE_WRITE' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(0);
      expect(parsed.meta.result_count).toBe(0);
    });

    it('should return empty when repository is empty', async () => {
      codeUnitRepo.clear();
      const result = await handler({ pattern_type: 'API_ENDPOINT' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(0);
    });

    it('should use lineNumber from pattern, not lineStart from unit', async () => {
      const result = await handler({ pattern_type: 'DATABASE_READ' });
      const parsed = JSON.parse(result.content[0].text);

      const authDbRead = parsed.data.find(
        (p: { codeUnitName: string }) => p.codeUnitName === 'loginHandler',
      );
      // Pattern lineNumber is 18, unit lineStart is 10
      expect(authDbRead.lineNumber).toBe(18);
    });
  });
});
