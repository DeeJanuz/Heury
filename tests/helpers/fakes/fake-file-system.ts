import { createHash } from 'node:crypto';
import type { IFileSystem } from '@/domain/ports/index.js';

export class InMemoryFileSystem implements IFileSystem {
  private readonly files = new Map<string, string>();
  private readonly directories = new Set<string>();

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path);
  }

  async listFiles(directory: string, pattern?: string): Promise<string[]> {
    const prefix = directory.endsWith('/') ? directory : `${directory}/`;
    const matches: string[] = [];
    for (const filePath of this.files.keys()) {
      if (!filePath.startsWith(prefix)) continue;
      const relativePath = filePath.slice(prefix.length);
      if (relativePath.includes('/')) continue; // only direct children
      if (pattern) {
        const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
        if (!regex.test(relativePath)) continue;
      }
      matches.push(filePath);
    }
    return matches;
  }

  async getFileHash(path: string): Promise<string> {
    const content = await this.readFile(path);
    return createHash('sha256').update(content).digest('hex');
  }

  async isDirectory(path: string): Promise<boolean> {
    return this.directories.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.directories.add(path);
  }
}
