import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enrichCodeUnits,
  type EnrichmentResult,
} from '@/application/enrichment-processor.js';
import type { ILlmProvider } from '@/domain/ports/llm-provider.js';
import type { ICodeUnitRepository, IUnitSummaryRepository } from '@/domain/ports/index.js';
import {
  createCodeUnit,
  CodeUnitType,
  type CodeUnit,
  type UnitSummary,
} from '@/domain/models/index.js';

function makeUnit(overrides: Partial<Parameters<typeof createCodeUnit>[0]> = {}): CodeUnit {
  return createCodeUnit({
    id: 'unit-1',
    filePath: 'src/utils/helper.ts',
    name: 'doSomething',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 10,
    isAsync: false,
    isExported: true,
    language: 'typescript',
    ...overrides,
  });
}

function makeFakeLlmProvider(response?: string): ILlmProvider {
  return {
    providerModel: 'test/fake-model',
    generateSummary: vi.fn().mockResolvedValue(
      response ??
        JSON.stringify({
          summary: 'Test summary',
          keyBehaviors: ['behavior 1'],
          sideEffects: ['side effect 1'],
        }),
    ),
  };
}

function makeFakeCodeUnitRepo(units: CodeUnit[]): ICodeUnitRepository {
  return {
    findAll: vi.fn().mockReturnValue(units),
    save: vi.fn(),
    saveBatch: vi.fn(),
    findById: vi.fn(),
    findByFilePath: vi.fn(),
    findByType: vi.fn(),
    findByLanguage: vi.fn(),
    deleteByFilePath: vi.fn(),
    clear: vi.fn(),
  };
}

function makeFakeUnitSummaryRepo(
  existingSummaries: Map<string, UnitSummary> = new Map(),
): IUnitSummaryRepository {
  return {
    findByCodeUnitId: vi.fn().mockImplementation((id: string) => existingSummaries.get(id)),
    save: vi.fn(),
    saveBatch: vi.fn(),
    findAll: vi.fn().mockReturnValue([...existingSummaries.values()]),
    deleteByCodeUnitId: vi.fn(),
    clear: vi.fn(),
  };
}

describe('enrichCodeUnits', () => {
  let llmProvider: ILlmProvider;
  let codeUnitRepo: ICodeUnitRepository;
  let summaryRepo: IUnitSummaryRepository;

  beforeEach(() => {
    llmProvider = makeFakeLlmProvider();
    vi.clearAllMocks();
  });

  describe('unit filtering', () => {
    it('should only process exported code units', async () => {
      const exportedUnit = makeUnit({ id: 'exported-1', isExported: true, name: 'publicFn' });
      const privateUnit = makeUnit({ id: 'private-1', isExported: false, name: 'privateFn' });
      codeUnitRepo = makeFakeCodeUnitRepo([exportedUnit, privateUnit]);
      summaryRepo = makeFakeUnitSummaryRepo();

      const result = await enrichCodeUnits(codeUnitRepo, summaryRepo, llmProvider);

      expect(result.unitsProcessed).toBe(1);
      expect(result.unitsSkipped).toBe(0);
      expect(llmProvider.generateSummary).toHaveBeenCalledTimes(1);
    });

    it('should skip units that already have summaries', async () => {
      const unit = makeUnit({ id: 'unit-1' });
      codeUnitRepo = makeFakeCodeUnitRepo([unit]);
      const existingSummary: UnitSummary = {
        id: 'summary-1',
        codeUnitId: 'unit-1',
        summary: 'Existing summary',
        keyBehaviors: [],
        sideEffects: [],
        providerModel: 'test/old-model',
        generatedAt: '2025-01-01T00:00:00Z',
      };
      summaryRepo = makeFakeUnitSummaryRepo(new Map([['unit-1', existingSummary]]));

      const result = await enrichCodeUnits(codeUnitRepo, summaryRepo, llmProvider);

      expect(result.unitsProcessed).toBe(0);
      expect(result.unitsSkipped).toBe(1);
      expect(llmProvider.generateSummary).not.toHaveBeenCalled();
    });

    it('should re-enrich existing summaries when force is true', async () => {
      const unit = makeUnit({ id: 'unit-1' });
      codeUnitRepo = makeFakeCodeUnitRepo([unit]);
      const existingSummary: UnitSummary = {
        id: 'summary-1',
        codeUnitId: 'unit-1',
        summary: 'Old summary',
        keyBehaviors: [],
        sideEffects: [],
        providerModel: 'test/old-model',
        generatedAt: '2025-01-01T00:00:00Z',
      };
      summaryRepo = makeFakeUnitSummaryRepo(new Map([['unit-1', existingSummary]]));

      const result = await enrichCodeUnits(codeUnitRepo, summaryRepo, llmProvider, { force: true });

      expect(result.unitsProcessed).toBe(1);
      expect(result.unitsSkipped).toBe(0);
      expect(llmProvider.generateSummary).toHaveBeenCalledTimes(1);
    });
  });

  describe('summary generation', () => {
    it('should save generated summary to repository', async () => {
      const unit = makeUnit({ id: 'unit-1' });
      codeUnitRepo = makeFakeCodeUnitRepo([unit]);
      summaryRepo = makeFakeUnitSummaryRepo();

      await enrichCodeUnits(codeUnitRepo, summaryRepo, llmProvider);

      expect(summaryRepo.save).toHaveBeenCalledTimes(1);
      const savedSummary = (summaryRepo.save as ReturnType<typeof vi.fn>).mock.calls[0][0] as UnitSummary;
      expect(savedSummary.codeUnitId).toBe('unit-1');
      expect(savedSummary.summary).toBe('Test summary');
      expect(savedSummary.keyBehaviors).toEqual(['behavior 1']);
      expect(savedSummary.sideEffects).toEqual(['side effect 1']);
      expect(savedSummary.providerModel).toBe('test/fake-model');
    });

    it('should build prompt with code unit details', async () => {
      const unit = makeUnit({
        id: 'unit-1',
        name: 'processData',
        unitType: CodeUnitType.FUNCTION,
        filePath: 'src/data.ts',
        signature: '(input: string) => boolean',
        isExported: true,
        isAsync: true,
      });
      codeUnitRepo = makeFakeCodeUnitRepo([unit]);
      summaryRepo = makeFakeUnitSummaryRepo();

      await enrichCodeUnits(codeUnitRepo, summaryRepo, llmProvider);

      const prompt = (llmProvider.generateSummary as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(prompt).toContain('processData');
      expect(prompt).toContain('FUNCTION');
      expect(prompt).toContain('src/data.ts');
      expect(prompt).toContain('(input: string) => boolean');
      expect(prompt).toContain('true'); // isAsync
    });
  });

  describe('response parsing', () => {
    it('should parse valid JSON response', async () => {
      const jsonResponse = JSON.stringify({
        summary: 'Parses user input',
        keyBehaviors: ['validates format', 'trims whitespace'],
        sideEffects: ['logs to console'],
      });
      llmProvider = makeFakeLlmProvider(jsonResponse);
      codeUnitRepo = makeFakeCodeUnitRepo([makeUnit()]);
      summaryRepo = makeFakeUnitSummaryRepo();

      await enrichCodeUnits(codeUnitRepo, summaryRepo, llmProvider);

      const saved = (summaryRepo.save as ReturnType<typeof vi.fn>).mock.calls[0][0] as UnitSummary;
      expect(saved.summary).toBe('Parses user input');
      expect(saved.keyBehaviors).toEqual(['validates format', 'trims whitespace']);
      expect(saved.sideEffects).toEqual(['logs to console']);
    });

    it('should parse JSON from markdown code block', async () => {
      const markdownResponse = '```json\n{"summary": "Markdown summary", "keyBehaviors": ["b1"], "sideEffects": []}\n```';
      llmProvider = makeFakeLlmProvider(markdownResponse);
      codeUnitRepo = makeFakeCodeUnitRepo([makeUnit()]);
      summaryRepo = makeFakeUnitSummaryRepo();

      await enrichCodeUnits(codeUnitRepo, summaryRepo, llmProvider);

      const saved = (summaryRepo.save as ReturnType<typeof vi.fn>).mock.calls[0][0] as UnitSummary;
      expect(saved.summary).toBe('Markdown summary');
      expect(saved.keyBehaviors).toEqual(['b1']);
    });

    it('should use raw text as summary when JSON parsing fails', async () => {
      const plainText = 'This function does something useful.';
      llmProvider = makeFakeLlmProvider(plainText);
      codeUnitRepo = makeFakeCodeUnitRepo([makeUnit()]);
      summaryRepo = makeFakeUnitSummaryRepo();

      await enrichCodeUnits(codeUnitRepo, summaryRepo, llmProvider);

      const saved = (summaryRepo.save as ReturnType<typeof vi.fn>).mock.calls[0][0] as UnitSummary;
      expect(saved.summary).toBe('This function does something useful.');
      expect(saved.keyBehaviors).toEqual([]);
      expect(saved.sideEffects).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should count failed units without stopping processing', async () => {
      const unit1 = makeUnit({ id: 'unit-1', name: 'fn1' });
      const unit2 = makeUnit({ id: 'unit-2', name: 'fn2' });
      const unit3 = makeUnit({ id: 'unit-3', name: 'fn3' });
      codeUnitRepo = makeFakeCodeUnitRepo([unit1, unit2, unit3]);
      summaryRepo = makeFakeUnitSummaryRepo();

      const mockGenerate = vi.fn()
        .mockResolvedValueOnce(JSON.stringify({ summary: 'ok', keyBehaviors: [], sideEffects: [] }))
        .mockRejectedValueOnce(new Error('API timeout'))
        .mockResolvedValueOnce(JSON.stringify({ summary: 'also ok', keyBehaviors: [], sideEffects: [] }));

      llmProvider = {
        providerModel: 'test/fake-model',
        generateSummary: mockGenerate,
      };

      const result = await enrichCodeUnits(codeUnitRepo, summaryRepo, llmProvider);

      expect(result.unitsProcessed).toBe(2);
      expect(result.unitsFailed).toBe(1);
    });

    it('should return zero counts when no units exist', async () => {
      codeUnitRepo = makeFakeCodeUnitRepo([]);
      summaryRepo = makeFakeUnitSummaryRepo();

      const result = await enrichCodeUnits(codeUnitRepo, summaryRepo, llmProvider);

      expect(result.unitsProcessed).toBe(0);
      expect(result.unitsSkipped).toBe(0);
      expect(result.unitsFailed).toBe(0);
    });
  });

  describe('concurrency', () => {
    it('should process units in parallel up to concurrency limit', async () => {
      const units = Array.from({ length: 6 }, (_, i) =>
        makeUnit({ id: `unit-${i}`, name: `fn${i}` }),
      );
      codeUnitRepo = makeFakeCodeUnitRepo(units);
      summaryRepo = makeFakeUnitSummaryRepo();

      const callOrder: number[] = [];
      let activeCount = 0;
      let maxConcurrent = 0;

      const mockGenerate = vi.fn().mockImplementation(async () => {
        activeCount++;
        maxConcurrent = Math.max(maxConcurrent, activeCount);
        callOrder.push(activeCount);
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeCount--;
        return JSON.stringify({ summary: 'ok', keyBehaviors: [], sideEffects: [] });
      });

      llmProvider = {
        providerModel: 'test/fake-model',
        generateSummary: mockGenerate,
      };

      const result = await enrichCodeUnits(codeUnitRepo, summaryRepo, llmProvider, {
        concurrency: 2,
      });

      expect(result.unitsProcessed).toBe(6);
      // Max concurrent calls should not exceed the concurrency limit
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should default concurrency to 3', async () => {
      const units = Array.from({ length: 9 }, (_, i) =>
        makeUnit({ id: `unit-${i}`, name: `fn${i}` }),
      );
      codeUnitRepo = makeFakeCodeUnitRepo(units);
      summaryRepo = makeFakeUnitSummaryRepo();

      let activeCount = 0;
      let maxConcurrent = 0;

      const mockGenerate = vi.fn().mockImplementation(async () => {
        activeCount++;
        maxConcurrent = Math.max(maxConcurrent, activeCount);
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeCount--;
        return JSON.stringify({ summary: 'ok', keyBehaviors: [], sideEffects: [] });
      });

      llmProvider = {
        providerModel: 'test/fake-model',
        generateSummary: mockGenerate,
      };

      await enrichCodeUnits(codeUnitRepo, summaryRepo, llmProvider);

      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(maxConcurrent).toBeGreaterThan(1); // Should actually use concurrency
    });
  });

  describe('result counts', () => {
    it('should return accurate counts for mixed scenario', async () => {
      const exported1 = makeUnit({ id: 'exp-1', name: 'fn1', isExported: true });
      const exported2 = makeUnit({ id: 'exp-2', name: 'fn2', isExported: true });
      const exported3 = makeUnit({ id: 'exp-3', name: 'fn3', isExported: true });
      const private1 = makeUnit({ id: 'priv-1', name: 'privateFn', isExported: false });
      codeUnitRepo = makeFakeCodeUnitRepo([exported1, exported2, exported3, private1]);

      // exp-2 already has a summary
      const existingSummary: UnitSummary = {
        id: 'summary-2',
        codeUnitId: 'exp-2',
        summary: 'Existing',
        keyBehaviors: [],
        sideEffects: [],
        providerModel: 'test/old',
        generatedAt: '2025-01-01T00:00:00Z',
      };
      summaryRepo = makeFakeUnitSummaryRepo(new Map([['exp-2', existingSummary]]));

      // exp-3 will fail
      const mockGenerate = vi.fn()
        .mockResolvedValueOnce(JSON.stringify({ summary: 'ok', keyBehaviors: [], sideEffects: [] }))
        .mockRejectedValueOnce(new Error('fail'));

      llmProvider = {
        providerModel: 'test/fake-model',
        generateSummary: mockGenerate,
      };

      const result = await enrichCodeUnits(codeUnitRepo, summaryRepo, llmProvider);

      expect(result.unitsProcessed).toBe(1);
      expect(result.unitsSkipped).toBe(1);
      expect(result.unitsFailed).toBe(1);
    });
  });
});
