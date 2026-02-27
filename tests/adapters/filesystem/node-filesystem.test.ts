import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { NodeFileSystem } from '@/adapters/filesystem/node-filesystem.js';

describe('NodeFileSystem', () => {
  let fs: NodeFileSystem;
  let tempDir: string;

  beforeEach(async () => {
    fs = new NodeFileSystem();
    tempDir = await mkdtemp(join(tmpdir(), 'heury-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('readFile', () => {
    it('should read an actual file from disk', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeFile(filePath, 'hello world', 'utf-8');

      const content = await fs.readFile(filePath);
      expect(content).toBe('hello world');
    });

    it('should throw when file does not exist', async () => {
      await expect(fs.readFile(join(tempDir, 'nope.txt'))).rejects.toThrow();
    });
  });

  describe('writeFile', () => {
    it('should create a file with given content', async () => {
      const filePath = join(tempDir, 'output.txt');
      await fs.writeFile(filePath, 'written content');

      const content = await fs.readFile(filePath);
      expect(content).toBe('written content');
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const filePath = join(tempDir, 'exists.txt');
      await writeFile(filePath, 'data', 'utf-8');

      expect(await fs.exists(filePath)).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      expect(await fs.exists(join(tempDir, 'nope.txt'))).toBe(false);
    });
  });

  describe('getFileHash', () => {
    it('should return consistent SHA-256 hash', async () => {
      const filePath = join(tempDir, 'hash.txt');
      await writeFile(filePath, 'hash me', 'utf-8');

      const hash1 = await fs.getFileHash(filePath);
      const hash2 = await fs.getFileHash(filePath);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('listFiles', () => {
    it('should return files in directory recursively', async () => {
      await writeFile(join(tempDir, 'a.ts'), 'content');
      await mkdir(join(tempDir, 'sub'));
      await writeFile(join(tempDir, 'sub', 'b.ts'), 'content');

      const files = await fs.listFiles(tempDir);
      expect(files).toContain('a.ts');
      expect(files).toContain(join('sub', 'b.ts'));
    });

    it('should skip .git and node_modules directories', async () => {
      await writeFile(join(tempDir, 'a.ts'), 'content');
      await mkdir(join(tempDir, '.git'));
      await writeFile(join(tempDir, '.git', 'config'), 'gitconfig');
      await mkdir(join(tempDir, 'node_modules'));
      await writeFile(join(tempDir, 'node_modules', 'pkg.js'), 'module');

      const files = await fs.listFiles(tempDir);
      expect(files).toContain('a.ts');
      expect(files).not.toContain(join('.git', 'config'));
      expect(files).not.toContain(join('node_modules', 'pkg.js'));
    });
  });

  describe('isDirectory', () => {
    it('should return true for a directory', async () => {
      await mkdir(join(tempDir, 'subdir'));
      expect(await fs.isDirectory(join(tempDir, 'subdir'))).toBe(true);
    });

    it('should return false for a file', async () => {
      const filePath = join(tempDir, 'file.txt');
      await writeFile(filePath, 'data');
      expect(await fs.isDirectory(filePath)).toBe(false);
    });
  });

  describe('mkdir', () => {
    it('should create directories recursively', async () => {
      const nested = join(tempDir, 'a', 'b', 'c');
      await fs.mkdir(nested);
      expect(await fs.isDirectory(nested)).toBe(true);
    });
  });
});
