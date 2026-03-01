import { describe, it, expect } from 'vitest';

import { DEFAULT_CONFIG, validateConfig, mergeWithDefaults } from '@/config/schema.js';
import type { HeuryConfig } from '@/domain/ports/index.js';

describe('Config Schema', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have expected shape', () => {
      expect(DEFAULT_CONFIG.rootDir).toBe('.');
      expect(DEFAULT_CONFIG.outputDir).toBe('.heury');
      expect(DEFAULT_CONFIG.include).toEqual(['**/*']);
      expect(DEFAULT_CONFIG.exclude).toContain('node_modules/**');
      expect(DEFAULT_CONFIG.exclude).toContain('dist/**');
      expect(DEFAULT_CONFIG.exclude).toContain('.git/**');
    });
  });

  describe('validateConfig', () => {
    it('should accept a valid config', () => {
      const config: HeuryConfig = {
        rootDir: '/project',
        outputDir: '.heury',
        include: ['**/*.ts'],
        exclude: ['node_modules/**'],
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should reject config with missing rootDir', () => {
      const config = {
        outputDir: '.heury',
        include: ['**/*'],
        exclude: [],
      };
      expect(() => validateConfig(config)).toThrow('rootDir');
    });

    it('should reject config with non-string rootDir', () => {
      const config = {
        rootDir: 123,
        outputDir: '.heury',
        include: ['**/*'],
        exclude: [],
      };
      expect(() => validateConfig(config)).toThrow('rootDir');
    });

    it('should reject config with non-array include', () => {
      const config = {
        rootDir: '.',
        outputDir: '.heury',
        include: 'not-an-array',
        exclude: [],
      };
      expect(() => validateConfig(config)).toThrow('include');
    });

    it('should reject null or non-object config', () => {
      expect(() => validateConfig(null)).toThrow();
      expect(() => validateConfig('string')).toThrow();
    });

    it('should accept config with valid manifestTokenBudget', () => {
      const config: HeuryConfig = {
        rootDir: '/project',
        outputDir: '.heury',
        include: ['**/*.ts'],
        exclude: ['node_modules/**'],
        manifestTokenBudget: 5000,
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should accept config without manifestTokenBudget', () => {
      const config: HeuryConfig = {
        rootDir: '/project',
        outputDir: '.heury',
        include: ['**/*.ts'],
        exclude: ['node_modules/**'],
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should reject config with zero manifestTokenBudget', () => {
      const config = {
        rootDir: '/project',
        outputDir: '.heury',
        include: ['**/*.ts'],
        exclude: ['node_modules/**'],
        manifestTokenBudget: 0,
      };
      expect(() => validateConfig(config)).toThrow('manifestTokenBudget');
    });

    it('should reject config with negative manifestTokenBudget', () => {
      const config = {
        rootDir: '/project',
        outputDir: '.heury',
        include: ['**/*.ts'],
        exclude: ['node_modules/**'],
        manifestTokenBudget: -100,
      };
      expect(() => validateConfig(config)).toThrow('manifestTokenBudget');
    });

    it('should reject config with non-number manifestTokenBudget', () => {
      const config = {
        rootDir: '/project',
        outputDir: '.heury',
        include: ['**/*.ts'],
        exclude: ['node_modules/**'],
        manifestTokenBudget: 'large',
      };
      expect(() => validateConfig(config)).toThrow('manifestTokenBudget');
    });
  });

  describe('mergeWithDefaults', () => {
    it('should apply defaults for missing fields', () => {
      const result = mergeWithDefaults({});
      expect(result.rootDir).toBe(DEFAULT_CONFIG.rootDir);
      expect(result.outputDir).toBe(DEFAULT_CONFIG.outputDir);
      expect(result.include).toEqual(DEFAULT_CONFIG.include);
      expect(result.exclude).toEqual(DEFAULT_CONFIG.exclude);
    });

    it('should preserve provided values', () => {
      const result = mergeWithDefaults({
        rootDir: '/custom',
        outputDir: 'out',
        include: ['src/**'],
        exclude: ['vendor/**'],
      });
      expect(result.rootDir).toBe('/custom');
      expect(result.outputDir).toBe('out');
      expect(result.include).toEqual(['src/**']);
      expect(result.exclude).toEqual(['vendor/**']);
    });

    it('should pass through manifestTokenBudget when provided', () => {
      const result = mergeWithDefaults({
        manifestTokenBudget: 8000,
      });
      expect(result.manifestTokenBudget).toBe(8000);
    });

    it('should not include manifestTokenBudget when not provided', () => {
      const result = mergeWithDefaults({});
      expect(result.manifestTokenBudget).toBeUndefined();
    });
  });
});
