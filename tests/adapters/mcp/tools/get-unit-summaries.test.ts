import { describe, it, expect, beforeEach } from 'vitest';
import { createGetUnitSummariesTool } from '@/adapters/mcp/tools/get-unit-summaries.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryUnitSummaryRepository,
} from '../../../../tests/helpers/fakes/index.js';
import { createCodeUnit, CodeUnitType, createUnitSummary } from '@/domain/models/index.js';

describe('get-unit-summaries tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let unitSummaryRepo: InMemoryUnitSummaryRepository;
  let handler: ReturnType<typeof createGetUnitSummariesTool>['handler'];
  let definition: ReturnType<typeof createGetUnitSummariesTool>['definition'];

  const unitA = createCodeUnit({
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

  const unitB = createCodeUnit({
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

  const unitC = createCodeUnit({
    id: 'unit-c',
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
    summary: 'Authenticates a user with email and password',
    keyBehaviors: ['validates credentials', 'creates JWT token'],
    sideEffects: ['writes to audit log'],
    providerModel: 'gpt-4',
    generatedAt: '2025-01-01T00:00:00Z',
  });

  const summaryB = createUnitSummary({
    id: 'sum-b',
    codeUnitId: 'unit-b',
    summary: 'Validates a JWT token and returns decoded payload',
    keyBehaviors: ['checks token expiry', 'verifies signature'],
    sideEffects: [],
    providerModel: 'gpt-4',
    generatedAt: '2025-01-01T00:00:00Z',
  });

  const summaryC = createUnitSummary({
    id: 'sum-c',
    codeUnitId: 'unit-c',
    summary: 'Handles user CRUD operations via REST endpoints',
    keyBehaviors: ['creates users', 'updates profiles', 'deletes accounts'],
    sideEffects: ['sends welcome email', 'invalidates cache'],
    providerModel: 'gpt-4',
    generatedAt: '2025-01-01T00:00:00Z',
  });

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    unitSummaryRepo = new InMemoryUnitSummaryRepository();
    const tool = createGetUnitSummariesTool({ codeUnitRepo, unitSummaryRepo });
    handler = tool.handler;
    definition = tool.definition;

    codeUnitRepo.save(unitA);
    codeUnitRepo.save(unitB);
    codeUnitRepo.save(unitC);

    unitSummaryRepo.save(summaryA);
    unitSummaryRepo.save(summaryB);
    unitSummaryRepo.save(summaryC);
  });

  it('should have correct tool definition', () => {
    expect(definition.name).toBe('get-unit-summaries');
    expect(definition.description).toContain('summar');
    expect(definition.inputSchema).toHaveProperty('properties');
    expect(definition.inputSchema.properties).toHaveProperty('unit_id');
    expect(definition.inputSchema.properties).toHaveProperty('file_path');
    expect(definition.inputSchema.properties).toHaveProperty('limit');
  });

  it('should return all summaries when no filters provided', async () => {
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(3);
    expect(parsed.meta.result_count).toBe(3);
  });

  it('should map to correct output format with name, filePath, unitType, summary, keyBehaviors, sideEffects', async () => {
    const result = await handler({ unit_id: 'unit-a' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]).toEqual({
      name: 'authenticate',
      filePath: 'src/services/auth.ts',
      unitType: 'FUNCTION',
      summary: 'Authenticates a user with email and password',
      keyBehaviors: ['validates credentials', 'creates JWT token'],
      sideEffects: ['writes to audit log'],
    });
  });

  it('should filter by unit_id', async () => {
    const result = await handler({ unit_id: 'unit-c' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe('UserController');
    expect(parsed.data[0].unitType).toBe('CLASS');
    expect(parsed.data[0].summary).toBe('Handles user CRUD operations via REST endpoints');
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
    const result = await handler({ limit: 2 });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(2);
    expect(parsed.meta.result_count).toBe(2);
  });

  it('should return empty array when unit_id not found', async () => {
    const result = await handler({ unit_id: 'nonexistent' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(0);
    expect(parsed.meta.result_count).toBe(0);
  });

  it('should return empty array when no summaries exist for file_path', async () => {
    const result = await handler({ file_path: 'src/nonexistent.ts' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(0);
    expect(parsed.meta.result_count).toBe(0);
  });

  it('should return empty array when unit exists but has no summary', async () => {
    const unitD = createCodeUnit({
      id: 'unit-d',
      filePath: 'src/utils/helper.ts',
      name: 'helperFn',
      unitType: CodeUnitType.FUNCTION,
      lineStart: 1,
      lineEnd: 5,
      isAsync: false,
      isExported: true,
      language: 'typescript',
    });
    codeUnitRepo.save(unitD);

    const result = await handler({ unit_id: 'unit-d' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(0);
    expect(parsed.meta.result_count).toBe(0);
  });

  it('should handle empty repositories', async () => {
    codeUnitRepo.clear();
    unitSummaryRepo.clear();

    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(0);
    expect(parsed.meta.result_count).toBe(0);
  });

  it('should omit empty sideEffects array from output', async () => {
    const result = await handler({ unit_id: 'unit-b' });
    const parsed = JSON.parse(result.content[0].text);

    // sideEffects is empty for unit-b, should be stripped by buildToolResponse
    expect(parsed.data[0]).not.toHaveProperty('sideEffects');
    expect(parsed.data[0].keyBehaviors).toEqual(['checks token expiry', 'verifies signature']);
  });

  it('should exclude internal fields like id, codeUnitId, providerModel, generatedAt', async () => {
    const result = await handler({ unit_id: 'unit-a' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data[0]).not.toHaveProperty('id');
    expect(parsed.data[0]).not.toHaveProperty('codeUnitId');
    expect(parsed.data[0]).not.toHaveProperty('providerModel');
    expect(parsed.data[0]).not.toHaveProperty('generatedAt');
  });

  it('should skip summaries whose code unit no longer exists', async () => {
    // Add an orphaned summary (no matching code unit)
    unitSummaryRepo.save(createUnitSummary({
      id: 'sum-orphan',
      codeUnitId: 'deleted-unit',
      summary: 'This unit was deleted',
      keyBehaviors: [],
      sideEffects: [],
      providerModel: 'gpt-4',
      generatedAt: '2025-01-01T00:00:00Z',
    }));

    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    // Should only return 3 (the valid ones), not the orphaned one
    expect(parsed.data).toHaveLength(3);
  });
});
