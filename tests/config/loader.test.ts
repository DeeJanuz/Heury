import { describe, it, expect, beforeEach } from 'vitest';

import { loadConfig, saveConfig, CONFIG_FILENAME } from '@/config/loader.js';
import { DEFAULT_CONFIG } from '@/config/schema.js';
import { InMemoryFileSystem } from '../helpers/fakes/index.js';
import type { HeuryConfig } from '@/domain/ports/index.js';

describe('Config Loader', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    fs = new InMemoryFileSystem();
  });

  describe('loadConfig', () => {
    it('should return defaults when no config file exists', async () => {
      const config = await loadConfig('/project', fs);
      expect(config.outputDir).toBe(DEFAULT_CONFIG.outputDir);
      expect(config.include).toEqual(DEFAULT_CONFIG.include);
      expect(config.exclude).toEqual(DEFAULT_CONFIG.exclude);
    });

    it('should set rootDir to the given directory', async () => {
      const config = await loadConfig('/my-project', fs);
      expect(config.rootDir).toBe('/my-project');
    });

    it('should read and parse an existing config file', async () => {
      const customConfig: HeuryConfig = {
        rootDir: '/project',
        outputDir: 'output',
        include: ['src/**'],
        exclude: ['vendor/**'],
      };
      await fs.writeFile(
        `/project/${CONFIG_FILENAME}`,
        JSON.stringify(customConfig),
      );

      const config = await loadConfig('/project', fs);
      expect(config.outputDir).toBe('output');
      expect(config.include).toEqual(['src/**']);
    });

    it('should merge loaded config with defaults', async () => {
      // Partial config - only override outputDir
      await fs.writeFile(
        `/project/${CONFIG_FILENAME}`,
        JSON.stringify({ outputDir: 'custom-output' }),
      );

      const config = await loadConfig('/project', fs);
      expect(config.outputDir).toBe('custom-output');
      // Defaults should fill in the rest
      expect(config.include).toEqual(DEFAULT_CONFIG.include);
      expect(config.exclude).toEqual(DEFAULT_CONFIG.exclude);
    });
  });

  describe('saveConfig', () => {
    it('should write JSON config to filesystem', async () => {
      const config: HeuryConfig = {
        rootDir: '/project',
        outputDir: '.heury',
        include: ['**/*'],
        exclude: ['node_modules/**'],
      };

      await saveConfig('/project', config, fs);

      const raw = await fs.readFile(`/project/${CONFIG_FILENAME}`);
      const parsed = JSON.parse(raw);
      expect(parsed.rootDir).toBe('/project');
      expect(parsed.outputDir).toBe('.heury');
    });
  });

  describe('round-trip', () => {
    it('should return the same config after save then load', async () => {
      const original: HeuryConfig = {
        rootDir: '/project',
        outputDir: '.heury',
        include: ['src/**/*.ts'],
        exclude: ['dist/**'],
      };

      await saveConfig('/project', original, fs);
      const loaded = await loadConfig('/project', fs);

      expect(loaded.rootDir).toBe(original.rootDir);
      expect(loaded.outputDir).toBe(original.outputDir);
      expect(loaded.include).toEqual(original.include);
      expect(loaded.exclude).toEqual(original.exclude);
    });
  });
});
