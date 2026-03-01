import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extractSourceForUnit, extractSourceForUnits } from '@/adapters/mcp/source-extractor.js';
import { InMemoryFileSystem } from '../../helpers/fakes/index.js';

describe('source-extractor', () => {
  let fileSystem: InMemoryFileSystem;

  const sampleFile = [
    'line 1: import something',
    'line 2: const x = 1',
    'line 3: function foo() {',
    'line 4:   return x',
    'line 5: }',
  ].join('\n');

  beforeEach(() => {
    fileSystem = new InMemoryFileSystem();
  });

  describe('extractSourceForUnit', () => {
    it('should extract correct lines from a file', async () => {
      await fileSystem.writeFile('src/app.ts', sampleFile);

      const result = await extractSourceForUnit(fileSystem, {
        filePath: 'src/app.ts',
        lineStart: 2,
        lineEnd: 4,
      });

      expect(result).toBe(
        'line 2: const x = 1\nline 3: function foo() {\nline 4:   return x'
      );
    });

    it('should return null when file does not exist', async () => {
      const result = await extractSourceForUnit(fileSystem, {
        filePath: 'nonexistent.ts',
        lineStart: 1,
        lineEnd: 5,
      });

      expect(result).toBeNull();
    });

    it('should handle lineStart=1 (first line)', async () => {
      await fileSystem.writeFile('src/app.ts', sampleFile);

      const result = await extractSourceForUnit(fileSystem, {
        filePath: 'src/app.ts',
        lineStart: 1,
        lineEnd: 1,
      });

      expect(result).toBe('line 1: import something');
    });

    it('should handle lineEnd equal to last line', async () => {
      await fileSystem.writeFile('src/app.ts', sampleFile);

      const result = await extractSourceForUnit(fileSystem, {
        filePath: 'src/app.ts',
        lineStart: 5,
        lineEnd: 5,
      });

      expect(result).toBe('line 5: }');
    });

    it('should extract entire file when range covers all lines', async () => {
      await fileSystem.writeFile('src/app.ts', sampleFile);

      const result = await extractSourceForUnit(fileSystem, {
        filePath: 'src/app.ts',
        lineStart: 1,
        lineEnd: 5,
      });

      expect(result).toBe(sampleFile);
    });
  });

  describe('extractSourceForUnits', () => {
    it('should extract source for multiple units from the same file', async () => {
      await fileSystem.writeFile('src/app.ts', sampleFile);

      const units = [
        { filePath: 'src/app.ts', lineStart: 1, lineEnd: 2 },
        { filePath: 'src/app.ts', lineStart: 3, lineEnd: 5 },
      ];

      const results = await extractSourceForUnits(fileSystem, units);

      expect(results).toHaveLength(2);
      expect(results[0]).toBe('line 1: import something\nline 2: const x = 1');
      expect(results[1]).toBe('line 3: function foo() {\nline 4:   return x\nline 5: }');
    });

    it('should cache file reads for units from the same file', async () => {
      await fileSystem.writeFile('src/app.ts', sampleFile);

      const readFileSpy = vi.spyOn(fileSystem, 'readFile');

      const units = [
        { filePath: 'src/app.ts', lineStart: 1, lineEnd: 2 },
        { filePath: 'src/app.ts', lineStart: 3, lineEnd: 5 },
      ];

      await extractSourceForUnits(fileSystem, units);

      expect(readFileSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle units from multiple different files', async () => {
      await fileSystem.writeFile('src/app.ts', sampleFile);
      await fileSystem.writeFile('src/utils.ts', 'export const PI = 3.14\nexport const E = 2.72');

      const units = [
        { filePath: 'src/app.ts', lineStart: 1, lineEnd: 1 },
        { filePath: 'src/utils.ts', lineStart: 2, lineEnd: 2 },
      ];

      const results = await extractSourceForUnits(fileSystem, units);

      expect(results).toHaveLength(2);
      expect(results[0]).toBe('line 1: import something');
      expect(results[1]).toBe('export const E = 2.72');
    });

    it('should return null for units whose files do not exist', async () => {
      await fileSystem.writeFile('src/app.ts', sampleFile);

      const units = [
        { filePath: 'src/app.ts', lineStart: 1, lineEnd: 1 },
        { filePath: 'nonexistent.ts', lineStart: 1, lineEnd: 5 },
      ];

      const results = await extractSourceForUnits(fileSystem, units);

      expect(results).toHaveLength(2);
      expect(results[0]).toBe('line 1: import something');
      expect(results[1]).toBeNull();
    });

    it('should return empty array for empty input', async () => {
      const results = await extractSourceForUnits(fileSystem, []);

      expect(results).toHaveLength(0);
    });
  });
});
