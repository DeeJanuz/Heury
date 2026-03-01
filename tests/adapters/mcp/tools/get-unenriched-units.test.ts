import { describe, it, expect, beforeEach } from 'vitest';
import { createGetUnenrichedUnitsTool } from '@/adapters/mcp/tools/get-unenriched-units.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryUnitSummaryRepository,
} from '../../../../tests/helpers/fakes/index.js';
import { createCodeUnit, CodeUnitType, createUnitSummary } from '@/domain/models/index.js';

describe('get-unenriched-units tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let unitSummaryRepo: InMemoryUnitSummaryRepository;
  let handler: ReturnType<typeof createGetUnenrichedUnitsTool>['handler'];
  let definition: ReturnType<typeof createGetUnenrichedUnitsTool>['definition'];

  const exportedUnit = createCodeUnit({
    id: 'unit-a',
    filePath: 'src/services/auth.ts',
    name: 'authenticate',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 10,
    lineEnd: 50,
    isAsync: true,
    isExported: true,
    language: 'typescript',
  });

  const exportedUnitB = createCodeUnit({
    id: 'unit-b',
    filePath: 'src/services/auth.ts',
    name: 'validateToken',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 55,
    lineEnd: 80,
    isAsync: false,
    isExported: true,
    language: 'typescript',
  });

  const unexportedUnit = createCodeUnit({
    id: 'unit-c',
    filePath: 'src/utils/helper.ts',
    name: 'internalHelper',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 10,
    isAsync: false,
    isExported: false,
    language: 'typescript',
  });

  const exportedUnitOtherFile = createCodeUnit({
    id: 'unit-d',
    filePath: 'src/controllers/user.ts',
    name: 'UserController',
    unitType: CodeUnitType.CLASS,
    lineStart: 1,
    lineEnd: 100,
    isAsync: false,
    isExported: true,
    language: 'typescript',
  });

  const summaryA = createUnitSummary({
    id: 'sum-a',
    codeUnitId: 'unit-a',
    summary: 'Authenticates a user',
    keyBehaviors: ['validates credentials'],
    sideEffects: [],
    providerModel: 'mcp-client',
    generatedAt: '2025-01-01T00:00:00Z',
  });

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    unitSummaryRepo = new InMemoryUnitSummaryRepository();
    const tool = createGetUnenrichedUnitsTool({ codeUnitRepo, unitSummaryRepo });
    handler = tool.handler;
    definition = tool.definition;

    codeUnitRepo.save(exportedUnit);
    codeUnitRepo.save(exportedUnitB);
    codeUnitRepo.save(unexportedUnit);
    codeUnitRepo.save(exportedUnitOtherFile);
  });

  it('should have correct tool definition', () => {
    expect(definition.name).toBe('get-unenriched-units');
    expect(definition.description).toContain('summar');
    expect(definition.inputSchema).toHaveProperty('properties');
    expect(definition.inputSchema.properties).toHaveProperty('file_path');
    expect(definition.inputSchema.properties).toHaveProperty('limit');
  });

  it('should return only exported units without summaries', async () => {
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    // 3 exported, 0 have summaries
    expect(parsed.data).toHaveLength(3);
    expect(parsed.meta.total_count).toBe(3);
  });

  it('should exclude units that have summaries', async () => {
    unitSummaryRepo.save(summaryA);

    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    // 3 exported, 1 has summary => 2 unenriched
    expect(parsed.data).toHaveLength(2);
    const ids = parsed.data.map((d: { id: string }) => d.id);
    expect(ids).not.toContain('unit-a');
    expect(ids).toContain('unit-b');
    expect(ids).toContain('unit-d');
  });

  it('should exclude non-exported units', async () => {
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    const ids = parsed.data.map((d: { id: string }) => d.id);
    expect(ids).not.toContain('unit-c');
  });

  it('should filter by file_path', async () => {
    const result = await handler({ file_path: 'src/services/auth.ts' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(2);
    const names = parsed.data.map((d: { name: string }) => d.name);
    expect(names).toContain('authenticate');
    expect(names).toContain('validateToken');
  });

  it('should respect limit parameter', async () => {
    const result = await handler({ limit: 1 });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.meta.total_count).toBe(3);
    expect(parsed.meta.has_more).toBe(true);
  });

  it('should return totalCount and hasMore metadata', async () => {
    const result = await handler({ limit: 2 });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.meta.total_count).toBe(3);
    expect(parsed.meta.has_more).toBe(true);
  });

  it('should return hasMore false when all results fit', async () => {
    const result = await handler({ limit: 50 });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.meta.has_more).toBe(false);
  });

  it('should return empty array when all units have summaries', async () => {
    unitSummaryRepo.save(summaryA);
    unitSummaryRepo.save(createUnitSummary({
      codeUnitId: 'unit-b',
      summary: 'Validates a token',
      providerModel: 'mcp-client',
      generatedAt: '2025-01-01T00:00:00Z',
    }));
    unitSummaryRepo.save(createUnitSummary({
      codeUnitId: 'unit-d',
      summary: 'User controller',
      providerModel: 'mcp-client',
      generatedAt: '2025-01-01T00:00:00Z',
    }));

    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(0);
    expect(parsed.meta.total_count).toBe(0);
  });

  it('should return expected fields for each unit', async () => {
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    const unit = parsed.data.find((d: { id: string }) => d.id === 'unit-a');
    expect(unit).toBeDefined();
    expect(unit.name).toBe('authenticate');
    expect(unit.unitType).toBe('FUNCTION');
    expect(unit.filePath).toBe('src/services/auth.ts');
    expect(unit.lineStart).toBe(10);
    expect(unit.lineEnd).toBe(50);
  });
});
