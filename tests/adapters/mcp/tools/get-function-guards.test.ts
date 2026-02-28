import { describe, it, expect, beforeEach } from 'vitest';
import { createGetFunctionGuardsTool } from '@/adapters/mcp/tools/get-function-guards.js';
import {
  InMemoryGuardClauseRepository,
  InMemoryCodeUnitRepository,
} from '../../../../tests/helpers/fakes/index.js';
import { createGuardClause } from '@/domain/models/guard-clause.js';
import { createCodeUnit, CodeUnitType } from '@/domain/models/code-unit.js';

describe('get-function-guards tool', () => {
  let guardClauseRepo: InMemoryGuardClauseRepository;
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let handler: ReturnType<typeof createGetFunctionGuardsTool>['handler'];
  let definition: ReturnType<typeof createGetFunctionGuardsTool>['definition'];

  const unit1 = createCodeUnit({
    id: 'unit-1',
    filePath: 'src/auth/login.ts',
    name: 'login',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 30,
    isAsync: true,
    isExported: true,
    language: 'typescript',
  });

  const unit2 = createCodeUnit({
    id: 'unit-2',
    filePath: 'src/auth/validate.ts',
    name: 'validateToken',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 20,
    isAsync: false,
    isExported: true,
    language: 'typescript',
  });

  const unit3 = createCodeUnit({
    id: 'unit-3',
    filePath: 'src/utils/parse.ts',
    name: 'parseInput',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 15,
    isAsync: false,
    isExported: false,
    language: 'typescript',
  });

  const guard1 = createGuardClause({
    id: 'guard-1',
    codeUnitId: 'unit-1',
    guardType: 'null_check',
    condition: 'if (!user) return',
    lineNumber: 3,
  });

  const guard2 = createGuardClause({
    id: 'guard-2',
    codeUnitId: 'unit-1',
    guardType: 'type_check',
    condition: 'if (typeof token !== "string") throw',
    lineNumber: 5,
  });

  const guard3 = createGuardClause({
    id: 'guard-3',
    codeUnitId: 'unit-2',
    guardType: 'null_check',
    condition: 'if (!token) return null',
    lineNumber: 2,
  });

  const guard4 = createGuardClause({
    id: 'guard-4',
    codeUnitId: 'unit-3',
    guardType: 'validation',
    condition: 'if (input.length === 0) throw new Error("empty")',
    lineNumber: 3,
  });

  beforeEach(() => {
    guardClauseRepo = new InMemoryGuardClauseRepository();
    codeUnitRepo = new InMemoryCodeUnitRepository();

    const tool = createGetFunctionGuardsTool({
      guardClauseRepo,
      codeUnitRepo,
    });
    handler = tool.handler;
    definition = tool.definition;

    codeUnitRepo.save(unit1);
    codeUnitRepo.save(unit2);
    codeUnitRepo.save(unit3);

    guardClauseRepo.save(guard1);
    guardClauseRepo.save(guard2);
    guardClauseRepo.save(guard3);
    guardClauseRepo.save(guard4);
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(definition.name).toBe('get-function-guards');
    });

    it('should have a description mentioning guard clauses', () => {
      expect(definition.description).toContain('guard');
    });

    it('should define optional input properties', () => {
      const props = definition.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty('unit_id');
      expect(props).toHaveProperty('file_path');
      expect(props).toHaveProperty('guard_type');
      expect(props).toHaveProperty('limit');
    });

    it('should not require any input properties', () => {
      expect(definition.inputSchema).not.toHaveProperty('required');
    });
  });

  describe('filter by unit_id', () => {
    it('should return guards for the specified code unit', async () => {
      const result = await handler({ unit_id: 'unit-1' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(2);
      expect(parsed.data[0]).toMatchObject({
        functionName: 'login',
        filePath: 'src/auth/login.ts',
        guardType: 'null_check',
        condition: 'if (!user) return',
        lineNumber: 3,
      });
      expect(parsed.data[1]).toMatchObject({
        functionName: 'login',
        filePath: 'src/auth/login.ts',
        guardType: 'type_check',
        condition: 'if (typeof token !== "string") throw',
        lineNumber: 5,
      });
    });

    it('should return empty array for unknown unit_id', async () => {
      const result = await handler({ unit_id: 'nonexistent' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(0);
      expect(parsed.meta.result_count).toBe(0);
    });
  });

  describe('filter by guard_type', () => {
    it('should return guards matching the specified guard type', async () => {
      const result = await handler({ guard_type: 'null_check' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(2);
      expect(parsed.data.every((g: { guardType: string }) => g.guardType === 'null_check')).toBe(
        true,
      );
    });

    it('should return empty array for unknown guard_type', async () => {
      const result = await handler({ guard_type: 'nonexistent' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(0);
    });
  });

  describe('filter by file_path', () => {
    it('should return guards for code units in the specified file', async () => {
      const result = await handler({ file_path: 'src/auth/login.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(2);
      expect(parsed.data.every((g: { filePath: string }) => g.filePath === 'src/auth/login.ts')).toBe(
        true,
      );
    });

    it('should return empty array for file with no code units', async () => {
      const result = await handler({ file_path: 'src/nonexistent.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(0);
    });
  });

  describe('no filters (findAll)', () => {
    it('should return all guards when no filters provided', async () => {
      const result = await handler({});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(4);
    });

    it('should enrich each guard with functionName and filePath from code unit', async () => {
      const result = await handler({});
      const parsed = JSON.parse(result.content[0].text);

      const guard = parsed.data.find(
        (g: { functionName: string; guardType: string }) =>
          g.functionName === 'parseInput' && g.guardType === 'validation',
      );
      expect(guard).toMatchObject({
        functionName: 'parseInput',
        filePath: 'src/utils/parse.ts',
        guardType: 'validation',
        condition: 'if (input.length === 0) throw new Error("empty")',
        lineNumber: 3,
      });
    });
  });

  describe('limit', () => {
    it('should default to 100 results', async () => {
      // We have 4 guards, all should be returned
      const result = await handler({});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(4);
    });

    it('should respect custom limit', async () => {
      const result = await handler({ limit: 2 });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(2);
      expect(parsed.meta.result_count).toBe(2);
      expect(parsed.meta.total_count).toBe(4);
      expect(parsed.meta.has_more).toBe(true);
    });

    it('should indicate has_more is false when all results fit', async () => {
      const result = await handler({ limit: 10 });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(4);
      expect(parsed.meta.has_more).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty repositories', async () => {
      guardClauseRepo.clear();
      codeUnitRepo.clear();

      const result = await handler({});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(0);
      expect(parsed.meta.result_count).toBe(0);
    });

    it('should skip guards whose code unit is not found', async () => {
      // Add an orphan guard with no matching code unit
      guardClauseRepo.save(
        createGuardClause({
          id: 'orphan-guard',
          codeUnitId: 'deleted-unit',
          guardType: 'null_check',
          condition: 'if (!x) return',
          lineNumber: 1,
        }),
      );

      const result = await handler({});
      const parsed = JSON.parse(result.content[0].text);

      // Should still return the 4 valid guards, skip the orphan
      expect(parsed.data).toHaveLength(4);
      expect(
        parsed.data.every(
          (g: { functionName: string }) => g.functionName !== undefined,
        ),
      ).toBe(true);
    });

    it('should not return isError on successful responses', async () => {
      const result = await handler({});
      expect(result.isError).toBeUndefined();
    });
  });
});
