import { describe, it, expect, beforeEach, vi } from 'vitest';

import { analyzeCommand } from '@/cli/commands/analyze.js';
import { CONFIG_FILENAME } from '@/config/loader.js';
import { InMemoryFileSystem } from '../../helpers/fakes/index.js';

vi.mock('@/application/incremental/git-diff-parser.js', () => ({
  parseGitDiff: vi.fn(),
  getChangedFilesSinceCommit: vi.fn(),
}));

describe('analyzeCommand', () => {
  let fs: InMemoryFileSystem;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fs = new InMemoryFileSystem();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should run analysis and print stats', async () => {
    // Set up a minimal project with a config and a source file
    await fs.writeFile(
      `/project/${CONFIG_FILENAME}`,
      JSON.stringify({
        rootDir: '/project',
        outputDir: '.heury',
        include: ['**/*'],
        exclude: [],
        embedding: { provider: 'local' },
      }),
    );
    await fs.writeFile('/project/index.ts', 'export function hello() { return "hi"; }');

    await analyzeCommand({ dir: '/project', full: false }, fs);

    // Should print some stats
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should handle missing config gracefully by using defaults', async () => {
    // No config file, but add a source file
    await fs.writeFile('/project/app.ts', 'export const x = 1;');

    // Should not throw
    await analyzeCommand({ dir: '/project', full: false }, fs);

    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should generate manifest files after successful analysis', async () => {
    await fs.writeFile(
      `/project/${CONFIG_FILENAME}`,
      JSON.stringify({
        rootDir: '/project',
        outputDir: '.heury',
        include: ['**/*'],
        exclude: [],
        embedding: { provider: 'local' },
      }),
    );
    await fs.writeFile('/project/index.ts', 'export function hello() { return "hi"; }');

    await analyzeCommand({ dir: '/project', full: false }, fs);

    // Verify manifest files were created
    const modulesExists = await fs.exists('/project/.heury/MODULES.md');
    const patternsExists = await fs.exists('/project/.heury/PATTERNS.md');
    const dependenciesExists = await fs.exists('/project/.heury/DEPENDENCIES.md');
    const hotspotsExists = await fs.exists('/project/.heury/HOTSPOTS.md');

    expect(modulesExists).toBe(true);
    expect(patternsExists).toBe(true);
    expect(dependenciesExists).toBe(true);
    expect(hotspotsExists).toBe(true);

    // Verify the manifest log line was printed
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Manifests:'),
    );
  });

  it('should pass manifestTokenBudget from config to manifest generation', async () => {
    await fs.writeFile(
      `/project/${CONFIG_FILENAME}`,
      JSON.stringify({
        rootDir: '/project',
        outputDir: '.heury',
        include: ['**/*'],
        exclude: [],
        embedding: { provider: 'local' },
        manifestTokenBudget: 500,
      }),
    );
    // Create many files to produce enough data that a 500-token budget would truncate
    for (let i = 0; i < 50; i++) {
      await fs.writeFile(
        `/project/module-${i}.ts`,
        `export function longFunctionName_${i}_${'x'.repeat(80)}() { return ${i}; }`,
      );
    }

    await analyzeCommand({ dir: '/project', full: false }, fs);

    // Manifests should be generated (analysis succeeds)
    expect(await fs.exists('/project/.heury/MODULES.md')).toBe(true);

    // With a tiny 500-token budget, the total manifest size should be small
    const modules = await fs.readFile('/project/.heury/MODULES.md');
    const hotspots = await fs.readFile('/project/.heury/HOTSPOTS.md');
    // 500 tokens * 4 chars/token = 2000 chars total across all manifests
    // Each section gets ~25% = 125 tokens = 500 chars
    expect(modules.length).toBeLessThan(1000);
    expect(hotspots.length).toBeLessThan(1000);
  });

  it('should report errors on failure', async () => {
    // Create a filesystem that throws on readFile (simulating corrupt config)
    const brokenFs = new InMemoryFileSystem();
    // Write invalid JSON to config file so loadConfig fails during parse
    await brokenFs.writeFile(
      `/project/${CONFIG_FILENAME}`,
      'not valid json {{{{',
    );

    await analyzeCommand({ dir: '/project', full: false }, brokenFs);

    // Should have logged an error
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  describe('incremental mode', () => {
    it('should run incremental analysis when incremental flag is set', async () => {
      const { getChangedFilesSinceCommit } = await import(
        '@/application/incremental/git-diff-parser.js'
      );
      const mockGetChanged = vi.mocked(getChangedFilesSinceCommit);

      await fs.writeFile(
        `/project/${CONFIG_FILENAME}`,
        JSON.stringify({
          rootDir: '/project',
          outputDir: '.heury',
          include: ['**/*'],
          exclude: [],
          embedding: { provider: 'local' },
        }),
      );
      await fs.writeFile('/project/index.ts', 'export function hello() { return "hi"; }');

      mockGetChanged.mockResolvedValue([
        { filePath: 'index.ts', changeType: 'modified' },
      ]);

      await analyzeCommand(
        { dir: '/project', full: false, incremental: true },
        fs,
      );

      expect(mockGetChanged).toHaveBeenCalledWith('HEAD~1', '/project');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Incremental analysis'),
      );
    });

    it('should print incremental stats with added, modified, deleted counts', async () => {
      const { getChangedFilesSinceCommit } = await import(
        '@/application/incremental/git-diff-parser.js'
      );
      const mockGetChanged = vi.mocked(getChangedFilesSinceCommit);

      await fs.writeFile(
        `/project/${CONFIG_FILENAME}`,
        JSON.stringify({
          rootDir: '/project',
          outputDir: '.heury',
          include: ['**/*'],
          exclude: [],
          embedding: { provider: 'local' },
        }),
      );
      await fs.writeFile('/project/added.ts', 'export const x = 1;');

      mockGetChanged.mockResolvedValue([
        { filePath: 'added.ts', changeType: 'added' },
      ]);

      await analyzeCommand(
        { dir: '/project', full: false, incremental: true },
        fs,
      );

      // Should print stats line with added/modified/deleted
      const calls = consoleSpy.mock.calls.map((c) => c[0]);
      const statsLine = calls.find(
        (c: string) => typeof c === 'string' && c.includes('Incremental analysis'),
      );
      expect(statsLine).toBeDefined();
      expect(statsLine).toMatch(/\d+ added/);
      expect(statsLine).toMatch(/\d+ modified/);
      expect(statsLine).toMatch(/\d+ deleted/);
    });

    it('should handle git diff failure gracefully', async () => {
      const { getChangedFilesSinceCommit } = await import(
        '@/application/incremental/git-diff-parser.js'
      );
      const mockGetChanged = vi.mocked(getChangedFilesSinceCommit);

      await fs.writeFile(
        `/project/${CONFIG_FILENAME}`,
        JSON.stringify({
          rootDir: '/project',
          outputDir: '.heury',
          include: ['**/*'],
          exclude: [],
          embedding: { provider: 'local' },
        }),
      );

      mockGetChanged.mockRejectedValue(new Error('Not a git repository'));

      await analyzeCommand(
        { dir: '/project', full: false, incremental: true },
        fs,
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not a git repository'),
      );
    });

    it('should generate manifests after incremental analysis', async () => {
      const { getChangedFilesSinceCommit } = await import(
        '@/application/incremental/git-diff-parser.js'
      );
      const mockGetChanged = vi.mocked(getChangedFilesSinceCommit);

      await fs.writeFile(
        `/project/${CONFIG_FILENAME}`,
        JSON.stringify({
          rootDir: '/project',
          outputDir: '.heury',
          include: ['**/*'],
          exclude: [],
          embedding: { provider: 'local' },
        }),
      );
      await fs.writeFile('/project/index.ts', 'export function hello() { return "hi"; }');

      mockGetChanged.mockResolvedValue([
        { filePath: 'index.ts', changeType: 'modified' },
      ]);

      await analyzeCommand(
        { dir: '/project', full: false, incremental: true },
        fs,
      );

      expect(await fs.exists('/project/.heury/MODULES.md')).toBe(true);
      expect(await fs.exists('/project/.heury/PATTERNS.md')).toBe(true);
    });
  });
});
