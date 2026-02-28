import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  hookInstallCommand,
  hookRemoveCommand,
} from '@/cli/commands/hook.js';
import { InMemoryFileSystem } from '../../helpers/fakes/index.js';

describe('hookInstallCommand', () => {
  let fs: InMemoryFileSystem;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let chmodSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fs = new InMemoryFileSystem();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    chmodSpy = vi.fn();
  });

  it('should throw error when not a git repository', async () => {
    await expect(
      hookInstallCommand({ dir: '/project' }, fs, chmodSpy),
    ).rejects.toThrow('Not a git repository');
  });

  it('should create post-commit hook in .git/hooks', async () => {
    await fs.mkdir('/project/.git/hooks');

    await hookInstallCommand({ dir: '/project' }, fs, chmodSpy);

    const hookExists = await fs.exists('/project/.git/hooks/post-commit');
    expect(hookExists).toBe(true);
  });

  it('should write hook with proper shebang', async () => {
    await fs.mkdir('/project/.git/hooks');

    await hookInstallCommand({ dir: '/project' }, fs, chmodSpy);

    const content = await fs.readFile('/project/.git/hooks/post-commit');
    expect(content.startsWith('#!/bin/sh')).toBe(true);
  });

  it('should write hook containing heury analyze command', async () => {
    await fs.mkdir('/project/.git/hooks');

    await hookInstallCommand({ dir: '/project' }, fs, chmodSpy);

    const content = await fs.readFile('/project/.git/hooks/post-commit');
    expect(content).toContain('npx heury analyze --dir . --incremental');
  });

  it('should write hook with heury comment marker', async () => {
    await fs.mkdir('/project/.git/hooks');

    await hookInstallCommand({ dir: '/project' }, fs, chmodSpy);

    const content = await fs.readFile('/project/.git/hooks/post-commit');
    expect(content).toContain('# heury:');
  });

  it('should call chmod to make hook executable', async () => {
    await fs.mkdir('/project/.git/hooks');

    await hookInstallCommand({ dir: '/project' }, fs, chmodSpy);

    expect(chmodSpy).toHaveBeenCalledWith(
      '/project/.git/hooks/post-commit',
      0o755,
    );
  });

  it('should print success message', async () => {
    await fs.mkdir('/project/.git/hooks');

    await hookInstallCommand({ dir: '/project' }, fs, chmodSpy);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('post-commit hook installed'),
    );
  });

  it('should replace existing heury hook', async () => {
    await fs.mkdir('/project/.git/hooks');

    // Write an existing heury hook with old content
    const oldHook = [
      '#!/bin/sh',
      '# heury: old version',
      'npx heury analyze --dir . --old-flag',
    ].join('\n');
    await fs.writeFile('/project/.git/hooks/post-commit', oldHook);

    await hookInstallCommand({ dir: '/project' }, fs, chmodSpy);

    const content = await fs.readFile('/project/.git/hooks/post-commit');
    expect(content).toContain('npx heury analyze --dir . --incremental');
    expect(content).not.toContain('--old-flag');
  });

  it('should append to existing non-heury hook', async () => {
    await fs.mkdir('/project/.git/hooks');

    // Write an existing hook that is NOT from heury
    const existingHook = [
      '#!/bin/sh',
      '# run linter',
      'npm run lint',
    ].join('\n');
    await fs.writeFile('/project/.git/hooks/post-commit', existingHook);

    await hookInstallCommand({ dir: '/project' }, fs, chmodSpy);

    const content = await fs.readFile('/project/.git/hooks/post-commit');
    // Should preserve existing content
    expect(content).toContain('npm run lint');
    // Should also contain heury
    expect(content).toContain('npx heury analyze --dir . --incremental');
  });
});

describe('hookRemoveCommand', () => {
  let fs: InMemoryFileSystem;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let deleteSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fs = new InMemoryFileSystem();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    deleteSpy = vi.fn();
  });

  it('should handle non-existent hook gracefully', async () => {
    await fs.mkdir('/project/.git/hooks');

    // Should not throw
    await hookRemoveCommand({ dir: '/project' }, fs, deleteSpy);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No post-commit hook found'),
    );
  });

  it('should remove file when hook contains only heury content', async () => {
    await fs.mkdir('/project/.git/hooks');

    const heuryHook = [
      '#!/bin/sh',
      '# heury: incremental analysis on commit',
      'npx heury analyze --dir . --incremental',
    ].join('\n');
    await fs.writeFile('/project/.git/hooks/post-commit', heuryHook);

    await hookRemoveCommand({ dir: '/project' }, fs, deleteSpy);

    expect(deleteSpy).toHaveBeenCalledWith('/project/.git/hooks/post-commit');
  });

  it('should print success message after removal', async () => {
    await fs.mkdir('/project/.git/hooks');

    const heuryHook = [
      '#!/bin/sh',
      '# heury: incremental analysis on commit',
      'npx heury analyze --dir . --incremental',
    ].join('\n');
    await fs.writeFile('/project/.git/hooks/post-commit', heuryHook);

    await hookRemoveCommand({ dir: '/project' }, fs, deleteSpy);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('post-commit hook removed'),
    );
  });

  it('should remove only heury lines from mixed hook', async () => {
    await fs.mkdir('/project/.git/hooks');

    const mixedHook = [
      '#!/bin/sh',
      '# run linter',
      'npm run lint',
      '',
      '# heury: incremental analysis on commit',
      'npx heury analyze --dir . --incremental',
    ].join('\n');
    await fs.writeFile('/project/.git/hooks/post-commit', mixedHook);

    await hookRemoveCommand({ dir: '/project' }, fs, deleteSpy);

    // Should NOT delete the file
    expect(deleteSpy).not.toHaveBeenCalled();

    // Should have updated file without heury lines
    const content = await fs.readFile('/project/.git/hooks/post-commit');
    expect(content).toContain('npm run lint');
    expect(content).not.toContain('heury');
  });

  it('should handle hook with no heury content gracefully', async () => {
    await fs.mkdir('/project/.git/hooks');

    const otherHook = [
      '#!/bin/sh',
      '# run tests',
      'npm test',
    ].join('\n');
    await fs.writeFile('/project/.git/hooks/post-commit', otherHook);

    await hookRemoveCommand({ dir: '/project' }, fs, deleteSpy);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No heury hook found'),
    );

    // File should remain unchanged
    const content = await fs.readFile('/project/.git/hooks/post-commit');
    expect(content).toContain('npm test');
  });
});
