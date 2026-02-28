import { describe, it, expect } from 'vitest';
import { buildEmbeddingText } from '@/adapters/embedding/embedding-text-builder.js';
import {
  createCodeUnit,
  CodeUnitType,
  PatternType,
  createCodeUnitPattern,
} from '@/domain/models/index.js';

function makeUnit(overrides: Partial<Parameters<typeof createCodeUnit>[0]> = {}) {
  const defaults = {
    id: 'unit-1',
    filePath: 'src/routes/users.ts',
    name: 'getUsers',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 10,
    lineEnd: 30,
    isAsync: true,
    isExported: true,
    language: 'typescript',
    complexityScore: 22,
    patterns: [] as ReturnType<typeof createCodeUnitPattern>[],
    children: [],
  };
  return createCodeUnit({ ...defaults, ...overrides });
}

describe('buildEmbeddingText', () => {
  describe('backward compatibility (CodeUnit-only calls)', () => {
    it('includes function name and file path', () => {
      const unit = makeUnit();
      const text = buildEmbeddingText(unit);
      expect(text).toContain('getUsers');
      expect(text).toContain('src/routes/users.ts');
    });

    it('includes async and exported flags', () => {
      const unit = makeUnit({ isAsync: true, isExported: true });
      const text = buildEmbeddingText(unit);
      expect(text).toContain('async');
      expect(text).toContain('exported');
    });

    it('includes pattern summaries', () => {
      const unit = makeUnit({
        patterns: [
          createCodeUnitPattern({
            codeUnitId: 'unit-1',
            patternType: PatternType.API_ENDPOINT,
            patternValue: '/api/users',
          }),
          createCodeUnitPattern({
            codeUnitId: 'unit-1',
            patternType: PatternType.DATABASE_READ,
            patternValue: 'prisma.user.findMany',
          }),
        ],
      });
      const text = buildEmbeddingText(unit);
      expect(text).toContain('API_ENDPOINT');
      expect(text).toContain('/api/users');
      expect(text).toContain('DATABASE_READ');
      expect(text).toContain('prisma.user.findMany');
    });

    it('includes complexity level', () => {
      const unit = makeUnit({ complexityScore: 22 });
      const text = buildEmbeddingText(unit);
      expect(text).toContain('moderate');
    });

    it('handles unit with no patterns', () => {
      const unit = makeUnit({ patterns: [] });
      const text = buildEmbeddingText(unit);
      expect(text).not.toContain('Patterns:');
      expect(text).toContain('getUsers');
    });

    it('includes summary when provided as second argument', () => {
      const unit = makeUnit();
      const text = buildEmbeddingText(unit, 'Retrieves all users from the database');
      expect(text).toContain('Summary: Retrieves all users from the database');
    });

    it('does not include summary line when summary is undefined', () => {
      const unit = makeUnit();
      const text = buildEmbeddingText(unit);
      expect(text).not.toContain('Summary:');
    });

    it('does not include summary line when summary is empty string', () => {
      const unit = makeUnit();
      const text = buildEmbeddingText(unit, '');
      expect(text).not.toContain('Summary:');
    });
  });

  describe('enriched context (EmbeddingTextContext)', () => {
    it('includes summary from context when provided', () => {
      const unit = makeUnit();
      const text = buildEmbeddingText({
        unit,
        summary: 'Fetches user records from the database',
      });
      expect(text).toContain('Fetches user records from the database');
      expect(text).toContain('getUsers');
    });

    it('includes callers when provided', () => {
      const unit = makeUnit();
      const text = buildEmbeddingText({
        unit,
        callers: ['handleRequest', 'processUserList'],
      });
      expect(text).toContain('callers: handleRequest, processUserList');
    });

    it('includes callees when provided', () => {
      const unit = makeUnit();
      const text = buildEmbeddingText({
        unit,
        callees: ['findAll', 'mapToDto'],
      });
      expect(text).toContain('callees: findAll, mapToDto');
    });

    it('includes events when provided', () => {
      const unit = makeUnit();
      const text = buildEmbeddingText({
        unit,
        events: ['user.created', 'user.updated'],
      });
      expect(text).toContain('events: user.created, user.updated');
    });

    it('includes cluster name when provided', () => {
      const unit = makeUnit();
      const text = buildEmbeddingText({
        unit,
        clusterName: 'user-management',
      });
      expect(text).toContain('cluster: user-management');
    });

    it('includes all enrichments together in correct order', () => {
      const unit = makeUnit({
        patterns: [
          createCodeUnitPattern({
            codeUnitId: 'unit-1',
            patternType: PatternType.API_ENDPOINT,
            patternValue: '/api/users',
          }),
        ],
      });
      const text = buildEmbeddingText({
        unit,
        summary: 'Fetches user records',
        callers: ['handleRequest'],
        callees: ['findAll'],
        events: ['user.fetched'],
        clusterName: 'user-module',
      });

      const lines = text.split('\n');
      // Verify priority order: name/path, flags, summary, patterns, callers, callees, events, cluster
      const nameLineIdx = lines.findIndex((l) => l.includes('getUsers') && l.includes('src/routes/users.ts'));
      const summaryLineIdx = lines.findIndex((l) => l.includes('Fetches user records'));
      const patternsLineIdx = lines.findIndex((l) => l.includes('Patterns:'));
      const callersLineIdx = lines.findIndex((l) => l.includes('callers:'));
      const calleesLineIdx = lines.findIndex((l) => l.includes('callees:'));
      const eventsLineIdx = lines.findIndex((l) => l.includes('events:'));
      const clusterLineIdx = lines.findIndex((l) => l.includes('cluster:'));

      expect(nameLineIdx).toBeGreaterThanOrEqual(0);
      expect(summaryLineIdx).toBeGreaterThan(nameLineIdx);
      expect(patternsLineIdx).toBeGreaterThan(summaryLineIdx);
      expect(callersLineIdx).toBeGreaterThan(patternsLineIdx);
      expect(calleesLineIdx).toBeGreaterThan(callersLineIdx);
      expect(eventsLineIdx).toBeGreaterThan(calleesLineIdx);
      expect(clusterLineIdx).toBeGreaterThan(eventsLineIdx);
    });

    it('handles empty callers array gracefully', () => {
      const unit = makeUnit();
      const text = buildEmbeddingText({ unit, callers: [] });
      expect(text).not.toContain('callers:');
    });

    it('handles empty callees array gracefully', () => {
      const unit = makeUnit();
      const text = buildEmbeddingText({ unit, callees: [] });
      expect(text).not.toContain('callees:');
    });

    it('handles empty events array gracefully', () => {
      const unit = makeUnit();
      const text = buildEmbeddingText({ unit, events: [] });
      expect(text).not.toContain('events:');
    });

    it('handles undefined enrichment fields gracefully', () => {
      const unit = makeUnit();
      const text = buildEmbeddingText({ unit });
      // Should produce the same output as calling with just the unit
      const plainText = buildEmbeddingText(unit);
      expect(text).toBe(plainText);
    });

    it('truncates summary to approximately 50 words', () => {
      const unit = makeUnit();
      const longSummary = Array(100).fill('word').join(' ');
      const text = buildEmbeddingText({ unit, summary: longSummary });
      const summaryLine = text.split('\n').find((l) => l.startsWith('Summary:'));
      expect(summaryLine).toBeDefined();
      // Count words in the summary line (after "Summary: ")
      const summaryWords = summaryLine!.replace('Summary: ', '').split(/\s+/);
      expect(summaryWords.length).toBeLessThanOrEqual(50);
    });

    it('does not truncate summary that is under 50 words', () => {
      const unit = makeUnit();
      const shortSummary = 'This is a short summary with only a few words';
      const text = buildEmbeddingText({ unit, summary: shortSummary });
      expect(text).toContain(`Summary: ${shortSummary}`);
    });
  });
});
