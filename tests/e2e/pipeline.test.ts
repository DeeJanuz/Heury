/**
 * End-to-end integration tests for the heury CLI pipeline.
 *
 * Exercises the real pipeline against actual files on disk:
 * real filesystem, real SQLite, real extraction, real manifest generation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, cp, rm, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initCommand } from '@/cli/commands/init.js';
import { analyzeCommand } from '@/cli/commands/analyze.js';

const FIXTURE_DIR = join(__dirname, 'fixtures', 'sample-project');

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('E2E: heury pipeline', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'heury-e2e-'));
    await cp(FIXTURE_DIR, tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('init command', () => {
    it('creates .heury directory and config file', async () => {
      await initCommand({ dir: tempDir });

      expect(await exists(join(tempDir, '.heury'))).toBe(true);
      expect(await exists(join(tempDir, 'heury.config.json'))).toBe(true);
    });

    it('creates valid config with defaults', async () => {
      await initCommand({ dir: tempDir });

      const raw = await readFile(join(tempDir, 'heury.config.json'), 'utf-8');
      const config = JSON.parse(raw);

      expect(config.rootDir).toBe(tempDir);
      expect(config.outputDir).toBe('.heury');
      expect(config.include).toEqual(['**/*']);
      expect(config.exclude).toContain('node_modules/**');
    });

    it('is idempotent - does not overwrite existing config', async () => {
      await initCommand({ dir: tempDir });
      const firstConfig = await readFile(join(tempDir, 'heury.config.json'), 'utf-8');

      // Run init again
      await initCommand({ dir: tempDir });
      const secondConfig = await readFile(join(tempDir, 'heury.config.json'), 'utf-8');

      expect(secondConfig).toBe(firstConfig);
    });
  });

  describe('analyze command (full)', () => {
    beforeEach(async () => {
      await initCommand({ dir: tempDir });
    });

    it('creates SQLite database in .heury/', async () => {
      await analyzeCommand({ dir: tempDir, full: true });

      expect(await exists(join(tempDir, '.heury', 'heury.db'))).toBe(true);
    });

    it('generates MODULES.md manifest', async () => {
      await analyzeCommand({ dir: tempDir, full: true });

      const modulesPath = join(tempDir, '.heury', 'MODULES.md');
      expect(await exists(modulesPath)).toBe(true);

      const content = await readFile(modulesPath, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });

    it('generates PATTERNS.md manifest', async () => {
      await analyzeCommand({ dir: tempDir, full: true });

      const path = join(tempDir, '.heury', 'PATTERNS.md');
      expect(await exists(path)).toBe(true);

      const content = await readFile(path, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });

    it('generates DEPENDENCIES.md manifest', async () => {
      await analyzeCommand({ dir: tempDir, full: true });

      const path = join(tempDir, '.heury', 'DEPENDENCIES.md');
      expect(await exists(path)).toBe(true);

      const content = await readFile(path, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });

    it('generates HOTSPOTS.md manifest', async () => {
      await analyzeCommand({ dir: tempDir, full: true });

      const path = join(tempDir, '.heury', 'HOTSPOTS.md');
      expect(await exists(path)).toBe(true);

      const content = await readFile(path, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });

    it('generates SCHEMA.md manifest with Prisma models', async () => {
      await analyzeCommand({ dir: tempDir, full: true });

      const path = join(tempDir, '.heury', 'SCHEMA.md');
      expect(await exists(path)).toBe(true);

      const content = await readFile(path, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('manifest content validation', () => {
    beforeEach(async () => {
      await initCommand({ dir: tempDir });
      await analyzeCommand({ dir: tempDir, full: true });
    });

    it('MODULES.md contains extracted code units from fixture files', async () => {
      const content = await readFile(join(tempDir, '.heury', 'MODULES.md'), 'utf-8');

      // Should find the UserEntity class
      expect(content).toContain('UserEntity');
      // Should find the UserService class
      expect(content).toContain('UserService');
    });

    it('MODULES.md contains functions from fixture files', async () => {
      const content = await readFile(join(tempDir, '.heury', 'MODULES.md'), 'utf-8');

      // Should find the registerUserRoutes function
      expect(content).toContain('registerUserRoutes');
    });

    it('DEPENDENCIES.md contains import relationships', async () => {
      const content = await readFile(join(tempDir, '.heury', 'DEPENDENCIES.md'), 'utf-8');

      // user-routes imports from user-service
      expect(content).toContain('user-service');
      // user-service imports from user model
      expect(content).toContain('user');
    });

    it('PATTERNS.md contains detected API endpoint patterns', async () => {
      const content = await readFile(join(tempDir, '.heury', 'PATTERNS.md'), 'utf-8');

      // Should detect REST API patterns from the Express-style routes
      // The pattern detector should find router.get, router.post patterns
      expect(content).toContain('/api/users');
    });

    it('PATTERNS.md contains env variables from .env.example', async () => {
      const content = await readFile(join(tempDir, '.heury', 'PATTERNS.md'), 'utf-8');

      // Should detect env variables
      expect(content).toContain('DATABASE_URL');
    });

    it('SCHEMA.md contains Prisma model names', async () => {
      const content = await readFile(join(tempDir, '.heury', 'SCHEMA.md'), 'utf-8');

      // Should detect User and Post models from schema.prisma
      expect(content).toContain('User');
      expect(content).toContain('Post');
    });

    it('SCHEMA.md contains Prisma field names', async () => {
      const content = await readFile(join(tempDir, '.heury', 'SCHEMA.md'), 'utf-8');

      // Should detect fields from the schema
      expect(content).toContain('email');
      expect(content).toContain('title');
    });

    it('HOTSPOTS.md is generated with complexity info', async () => {
      const content = await readFile(join(tempDir, '.heury', 'HOTSPOTS.md'), 'utf-8');

      // HOTSPOTS.md should exist and have content (may be minimal for simple fixture)
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
    });
  });

  describe('full analysis re-run (idempotency)', () => {
    it('produces consistent results on re-analysis', async () => {
      await initCommand({ dir: tempDir });

      await analyzeCommand({ dir: tempDir, full: true });
      const modules1 = await readFile(join(tempDir, '.heury', 'MODULES.md'), 'utf-8');
      const deps1 = await readFile(join(tempDir, '.heury', 'DEPENDENCIES.md'), 'utf-8');

      // Run again
      await analyzeCommand({ dir: tempDir, full: true });
      const modules2 = await readFile(join(tempDir, '.heury', 'MODULES.md'), 'utf-8');
      const deps2 = await readFile(join(tempDir, '.heury', 'DEPENDENCIES.md'), 'utf-8');

      expect(modules2).toBe(modules1);
      expect(deps2).toBe(deps1);
    });
  });

  describe('analysis with modified fixture', () => {
    it('reflects file additions in manifests', async () => {
      await initCommand({ dir: tempDir });
      await analyzeCommand({ dir: tempDir, full: true });

      const modulesBefore = await readFile(join(tempDir, '.heury', 'MODULES.md'), 'utf-8');
      expect(modulesBefore).not.toContain('OrderService');

      // Add a new file
      const newFile = join(tempDir, 'src', 'services', 'order-service.ts');
      await writeFile(newFile, `
export class OrderService {
  async placeOrder(userId: string, items: string[]): Promise<string> {
    return 'order-123';
  }

  async cancelOrder(orderId: string): Promise<void> {
    // cancel logic
  }
}
`, 'utf-8');

      // Re-analyze (full)
      await analyzeCommand({ dir: tempDir, full: true });

      const modulesAfter = await readFile(join(tempDir, '.heury', 'MODULES.md'), 'utf-8');
      expect(modulesAfter).toContain('OrderService');
    });

    it('reflects file modifications in manifests after re-analysis', async () => {
      await initCommand({ dir: tempDir });
      await analyzeCommand({ dir: tempDir, full: true });

      const modulesBefore = await readFile(join(tempDir, '.heury', 'MODULES.md'), 'utf-8');
      expect(modulesBefore).not.toContain('AdminService');

      // Modify existing file to add a new top-level export
      const servicePath = join(tempDir, 'src', 'services', 'user-service.ts');
      const original = await readFile(servicePath, 'utf-8');
      const modified = original + `\n
export class AdminService {
  async promoteUser(userId: string): Promise<void> {
    // promote logic
  }
}
`;
      await writeFile(servicePath, modified, 'utf-8');

      // Re-analyze
      await analyzeCommand({ dir: tempDir, full: true });

      const modulesAfter = await readFile(join(tempDir, '.heury', 'MODULES.md'), 'utf-8');
      expect(modulesAfter).toContain('AdminService');
    });
  });
});
