/**
 * CLI hook commands - install/remove git post-commit hook for heury analysis.
 */

import type { IFileSystem } from '@/domain/ports/index.js';
import { NodeFileSystem } from '@/adapters/filesystem/node-filesystem.js';
import { chmod, unlink } from 'node:fs/promises';

export interface HookOptions {
  dir: string;
}

const HOOK_SHEBANG = '#!/bin/sh';
const HOOK_COMMENT = '# heury: incremental analysis on commit';
const HOOK_COMMAND = 'npx heury analyze --dir . --incremental';

const HEURY_HOOK_CONTENT = [HOOK_SHEBANG, HOOK_COMMENT, HOOK_COMMAND].join(
  '\n',
);

function isHeuryLine(line: string): boolean {
  return line.includes('heury');
}

function isOnlyHeuryHook(lines: string[]): boolean {
  const contentLines = lines.filter(
    (line) => line.trim() !== '' && !line.startsWith('#!'),
  );
  return contentLines.length > 0 && contentLines.every(isHeuryLine);
}

export async function hookInstallCommand(
  options: HookOptions,
  fileSystem?: IFileSystem,
  chmodFn?: (path: string, mode: number) => Promise<void>,
): Promise<void> {
  const fs = fileSystem ?? new NodeFileSystem();
  const doChmod = chmodFn ?? chmod;
  const hooksDir = `${options.dir}/.git/hooks`;
  const hookPath = `${hooksDir}/post-commit`;

  // Verify git repository
  if (!(await fs.exists(hooksDir))) {
    throw new Error('Not a git repository');
  }

  let content: string;

  if (await fs.exists(hookPath)) {
    const existing = await fs.readFile(hookPath);

    if (existing.includes('heury')) {
      // Replace existing heury hook entirely
      content = HEURY_HOOK_CONTENT;
    } else {
      // Append heury hook to existing content
      content = `${existing}\n\n${HOOK_COMMENT}\n${HOOK_COMMAND}`;
    }
  } else {
    content = HEURY_HOOK_CONTENT;
  }

  await fs.writeFile(hookPath, content);
  await doChmod(hookPath, 0o755);

  console.log('heury post-commit hook installed');
}

export async function hookRemoveCommand(
  options: HookOptions,
  fileSystem?: IFileSystem,
  deleteFileFn?: (path: string) => Promise<void>,
): Promise<void> {
  const fs = fileSystem ?? new NodeFileSystem();
  const doDelete = deleteFileFn ?? unlink;
  const hookPath = `${options.dir}/.git/hooks/post-commit`;

  if (!(await fs.exists(hookPath))) {
    console.log('No post-commit hook found');
    return;
  }

  const content = await fs.readFile(hookPath);

  if (!content.includes('heury')) {
    console.log('No heury hook found in post-commit');
    return;
  }

  const lines = content.split('\n');

  if (isOnlyHeuryHook(lines)) {
    // Hook contains only heury content - remove the file
    await doDelete(hookPath);
  } else {
    // Remove only heury lines, keep everything else
    const filtered = lines.filter((line) => !isHeuryLine(line));
    // Clean up trailing empty lines left behind
    const cleaned = filtered
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
    await fs.writeFile(hookPath, cleaned);
  }

  console.log('heury post-commit hook removed');
}
