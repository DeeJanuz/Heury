import { describe, it, expect, beforeEach, vi } from 'vitest';

import { initCommand } from '@/cli/commands/init.js';
import { CONFIG_FILENAME } from '@/config/loader.js';
import { InMemoryFileSystem } from '../../helpers/fakes/index.js';

// We need to inject the filesystem into the init command for testability.
// The init command accepts an optional filesystem dependency.

describe('initCommand', () => {
  let fs: InMemoryFileSystem;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fs = new InMemoryFileSystem();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should create .heury directory', async () => {
    await initCommand({ dir: '/project' }, fs);

    expect(await fs.exists('/project/.heury')).toBe(true);
  });

  it('should create config file with defaults', async () => {
    await initCommand({ dir: '/project' }, fs);

    const configPath = `/project/${CONFIG_FILENAME}`;
    expect(await fs.exists(configPath)).toBe(true);

    const raw = await fs.readFile(configPath);
    const config = JSON.parse(raw);
    expect(config.outputDir).toBe('.heury');
  });

  it('should handle already-initialized project gracefully', async () => {
    // Initialize once
    await initCommand({ dir: '/project' }, fs);

    // Initialize again - should not throw
    await initCommand({ dir: '/project' }, fs);

    // Should log "already initialized" message
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('already initialized'),
    );
  });

  it('should use the specified directory', async () => {
    await initCommand({ dir: '/custom-dir' }, fs);

    expect(await fs.exists('/custom-dir/.heury')).toBe(true);
    expect(await fs.exists(`/custom-dir/${CONFIG_FILENAME}`)).toBe(true);
  });

  it('should write valid JSON config file', async () => {
    await initCommand({ dir: '/project' }, fs);

    const raw = await fs.readFile(`/project/${CONFIG_FILENAME}`);
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
