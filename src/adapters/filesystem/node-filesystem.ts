/**
 * Real filesystem implementation using Node.js fs module.
 */

import type { IFileSystem } from '@/domain/ports/index.js';
import { createHash } from 'node:crypto';
import {
  readFile,
  writeFile,
  access,
  readdir,
  stat,
  mkdir,
} from 'node:fs/promises';
import { join, relative } from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules']);

export class NodeFileSystem implements IFileSystem {
  async readFile(path: string): Promise<string> {
    return readFile(path, 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    await writeFile(path, content, 'utf-8');
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(directory: string, pattern?: string): Promise<string[]> {
    const results: string[] = [];
    await this.walkDir(directory, directory, results);

    if (pattern) {
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
      return results.filter((f) => regex.test(f));
    }

    return results;
  }

  async getFileHash(path: string): Promise<string> {
    const content = await readFile(path);
    return createHash('sha256').update(content).digest('hex');
  }

  async isDirectory(path: string): Promise<boolean> {
    try {
      const s = await stat(path);
      return s.isDirectory();
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  private async walkDir(
    rootDir: string,
    currentDir: string,
    accumulator: string[],
  ): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;

      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await this.walkDir(rootDir, fullPath, accumulator);
      } else {
        accumulator.push(relative(rootDir, fullPath));
      }
    }
  }
}
