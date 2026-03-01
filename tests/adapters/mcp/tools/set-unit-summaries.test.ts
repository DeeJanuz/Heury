import { describe, it, expect, beforeEach } from 'vitest';
import { createSetUnitSummariesTool } from '@/adapters/mcp/tools/set-unit-summaries.js';
import {
  InMemoryUnitSummaryRepository,
} from '../../../../tests/helpers/fakes/index.js';

describe('set-unit-summaries tool', () => {
  let unitSummaryRepo: InMemoryUnitSummaryRepository;
  let handler: ReturnType<typeof createSetUnitSummariesTool>['handler'];
  let definition: ReturnType<typeof createSetUnitSummariesTool>['definition'];

  beforeEach(() => {
    unitSummaryRepo = new InMemoryUnitSummaryRepository();
    const tool = createSetUnitSummariesTool({ unitSummaryRepo });
    handler = tool.handler;
    definition = tool.definition;
  });

  it('should have correct tool definition', () => {
    expect(definition.name).toBe('set-unit-summaries');
    expect(definition.description).toContain('summar');
    expect(definition.inputSchema).toHaveProperty('properties');
    expect(definition.inputSchema.properties).toHaveProperty('summaries');
    expect(definition.inputSchema.required).toContain('summaries');
  });

  it('should save summaries successfully', async () => {
    const result = await handler({
      summaries: [
        {
          code_unit_id: 'unit-1',
          summary: 'Does something useful',
          key_behaviors: ['validates input'],
          side_effects: ['writes to log'],
        },
        {
          code_unit_id: 'unit-2',
          summary: 'Another useful thing',
        },
      ],
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.saved).toBe(2);
    expect(parsed.data.failed).toBe(0);
    expect(parsed.data).not.toHaveProperty('errors');

    // Verify actually saved
    expect(unitSummaryRepo.findByCodeUnitId('unit-1')).toBeDefined();
    expect(unitSummaryRepo.findByCodeUnitId('unit-2')).toBeDefined();
  });

  it('should return failed count when createUnitSummary throws', async () => {
    const result = await handler({
      summaries: [
        {
          code_unit_id: 'unit-1',
          summary: '', // empty summary should cause validation error
        },
      ],
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.saved).toBe(0);
    expect(parsed.data.failed).toBe(1);
    expect(parsed.data.errors).toHaveLength(1);
  });

  it('should return error when summaries is empty array', async () => {
    const result = await handler({ summaries: [] });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('non-empty array');
  });

  it('should return error when summaries is not an array', async () => {
    const result = await handler({ summaries: 'not-an-array' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('non-empty array');
  });

  it('should set providerModel to mcp-client', async () => {
    await handler({
      summaries: [
        {
          code_unit_id: 'unit-1',
          summary: 'A summary',
        },
      ],
    });

    const saved = unitSummaryRepo.findByCodeUnitId('unit-1');
    expect(saved).toBeDefined();
    expect(saved!.providerModel).toBe('mcp-client');
  });

  it('should handle key_behaviors and side_effects correctly', async () => {
    await handler({
      summaries: [
        {
          code_unit_id: 'unit-1',
          summary: 'A summary',
          key_behaviors: ['validates', 'transforms'],
          side_effects: ['writes to db', 'sends email'],
        },
      ],
    });

    const saved = unitSummaryRepo.findByCodeUnitId('unit-1');
    expect(saved).toBeDefined();
    expect(saved!.keyBehaviors).toEqual(['validates', 'transforms']);
    expect(saved!.sideEffects).toEqual(['writes to db', 'sends email']);
  });

  it('should default key_behaviors and side_effects to empty arrays', async () => {
    await handler({
      summaries: [
        {
          code_unit_id: 'unit-1',
          summary: 'A summary',
        },
      ],
    });

    const saved = unitSummaryRepo.findByCodeUnitId('unit-1');
    expect(saved).toBeDefined();
    expect(saved!.keyBehaviors).toEqual([]);
    expect(saved!.sideEffects).toEqual([]);
  });
});
