import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'node:child_process';

import { parseGitDiff, getChangedFilesSinceCommit } from '@/application/incremental/git-diff-parser.js';
import type { ChangedFile } from '@/application/incremental/git-diff-parser.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

const execFileMock = vi.mocked(execFile);

describe('parseGitDiff', () => {
  it('should return empty array for empty input', () => {
    expect(parseGitDiff('')).toEqual([]);
  });

  it('should return empty array for whitespace-only input', () => {
    expect(parseGitDiff('   \n  \n  ')).toEqual([]);
  });

  it('should parse a single added file', () => {
    const result = parseGitDiff('A\tsrc/new-file.ts');

    expect(result).toEqual<ChangedFile[]>([
      { filePath: 'src/new-file.ts', changeType: 'added' },
    ]);
  });

  it('should parse a single modified file', () => {
    const result = parseGitDiff('M\tsrc/modified-file.ts');

    expect(result).toEqual<ChangedFile[]>([
      { filePath: 'src/modified-file.ts', changeType: 'modified' },
    ]);
  });

  it('should parse a single deleted file', () => {
    const result = parseGitDiff('D\tsrc/deleted-file.ts');

    expect(result).toEqual<ChangedFile[]>([
      { filePath: 'src/deleted-file.ts', changeType: 'deleted' },
    ]);
  });

  it('should parse a renamed file with score', () => {
    const result = parseGitDiff('R100\tsrc/old-name.ts\tsrc/new-name.ts');

    expect(result).toEqual<ChangedFile[]>([
      {
        filePath: 'src/new-name.ts',
        changeType: 'renamed',
        oldPath: 'src/old-name.ts',
      },
    ]);
  });

  it('should parse a renamed file without score', () => {
    const result = parseGitDiff('R\tsrc/old-name.ts\tsrc/new-name.ts');

    expect(result).toEqual<ChangedFile[]>([
      {
        filePath: 'src/new-name.ts',
        changeType: 'renamed',
        oldPath: 'src/old-name.ts',
      },
    ]);
  });

  it('should parse a renamed file with partial score', () => {
    const result = parseGitDiff('R075\tsrc/old-name.ts\tsrc/new-name.ts');

    expect(result).toEqual<ChangedFile[]>([
      {
        filePath: 'src/new-name.ts',
        changeType: 'renamed',
        oldPath: 'src/old-name.ts',
      },
    ]);
  });

  it('should treat copy (C) as added', () => {
    const result = parseGitDiff('C100\tsrc/original.ts\tsrc/copy.ts');

    expect(result).toEqual<ChangedFile[]>([
      { filePath: 'src/copy.ts', changeType: 'added' },
    ]);
  });

  it('should treat copy (C) without score as added', () => {
    const result = parseGitDiff('C\tsrc/original.ts\tsrc/copy.ts');

    expect(result).toEqual<ChangedFile[]>([
      { filePath: 'src/copy.ts', changeType: 'added' },
    ]);
  });

  it('should skip empty lines', () => {
    const input = [
      'A\tsrc/file1.ts',
      '',
      'M\tsrc/file2.ts',
      '',
    ].join('\n');

    const result = parseGitDiff(input);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual<ChangedFile>({ filePath: 'src/file1.ts', changeType: 'added' });
    expect(result[1]).toEqual<ChangedFile>({ filePath: 'src/file2.ts', changeType: 'modified' });
  });

  it('should parse mixed changes together', () => {
    const input = [
      'A\tsrc/new-file.ts',
      'M\tsrc/modified-file.ts',
      'D\tsrc/deleted-file.ts',
      'R100\tsrc/old-name.ts\tsrc/new-name.ts',
    ].join('\n');

    const result = parseGitDiff(input);

    expect(result).toHaveLength(4);
    expect(result).toEqual<ChangedFile[]>([
      { filePath: 'src/new-file.ts', changeType: 'added' },
      { filePath: 'src/modified-file.ts', changeType: 'modified' },
      { filePath: 'src/deleted-file.ts', changeType: 'deleted' },
      { filePath: 'src/new-name.ts', changeType: 'renamed', oldPath: 'src/old-name.ts' },
    ]);
  });

  it('should skip lines with unknown status codes', () => {
    const input = [
      'A\tsrc/file1.ts',
      'X\tsrc/unknown.ts',
      'M\tsrc/file2.ts',
    ].join('\n');

    const result = parseGitDiff(input);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual<ChangedFile>({ filePath: 'src/file1.ts', changeType: 'added' });
    expect(result[1]).toEqual<ChangedFile>({ filePath: 'src/file2.ts', changeType: 'modified' });
  });

  it('should skip malformed lines without tabs', () => {
    const input = [
      'A\tsrc/file1.ts',
      'no-tab-here',
      'M\tsrc/file2.ts',
    ].join('\n');

    const result = parseGitDiff(input);

    expect(result).toHaveLength(2);
  });

  it('should handle file paths with spaces', () => {
    const result = parseGitDiff('A\tsrc/my file.ts');

    expect(result).toEqual<ChangedFile[]>([
      { filePath: 'src/my file.ts', changeType: 'added' },
    ]);
  });

  it('should handle deeply nested file paths', () => {
    const result = parseGitDiff('M\tsrc/a/b/c/d/e/file.ts');

    expect(result).toEqual<ChangedFile[]>([
      { filePath: 'src/a/b/c/d/e/file.ts', changeType: 'modified' },
    ]);
  });
});

describe('getChangedFilesSinceCommit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute git diff and return parsed results', async () => {
    execFileMock.mockImplementation(
      ((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as (err: Error | null, stdout: string, stderr: string) => void)(
          null, 'A\tsrc/new.ts\nM\tsrc/changed.ts\n', '',
        );
      }) as typeof execFile,
    );

    const result = await getChangedFilesSinceCommit('abc123', '/repo');

    expect(execFileMock).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-status', 'abc123', 'HEAD'],
      { cwd: '/repo' },
      expect.any(Function),
    );

    expect(result).toEqual<ChangedFile[]>([
      { filePath: 'src/new.ts', changeType: 'added' },
      { filePath: 'src/changed.ts', changeType: 'modified' },
    ]);
  });

  it('should throw a descriptive error when git command fails', async () => {
    execFileMock.mockImplementation(
      ((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as (err: Error | null, stdout: string, stderr: string) => void)(
          new Error('fatal: bad revision'), '', 'fatal: bad revision',
        );
      }) as typeof execFile,
    );

    await expect(getChangedFilesSinceCommit('invalid', '/repo')).rejects.toThrow(
      /failed to get changed files/i,
    );
  });

  it('should return empty array when no files changed', async () => {
    execFileMock.mockImplementation(
      ((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as (err: Error | null, stdout: string, stderr: string) => void)(
          null, '', '',
        );
      }) as typeof execFile,
    );

    const result = await getChangedFilesSinceCommit('abc123', '/repo');

    expect(result).toEqual([]);
  });
});
