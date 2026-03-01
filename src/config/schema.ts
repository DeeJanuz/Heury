/**
 * Config schema: validation and defaults for HeuryConfig.
 */

import type { HeuryConfig } from '@/domain/ports/index.js';

export type { HeuryConfig };

export const DEFAULT_CONFIG: HeuryConfig = {
  rootDir: '.',
  outputDir: '.heury',
  include: ['**/*'],
  exclude: ['node_modules/**', 'dist/**', 'build/**', '.git/**', 'coverage/**'],
};

/**
 * Validates that the given value is a valid HeuryConfig.
 * Throws descriptive errors for invalid configs.
 */
export function validateConfig(config: unknown): config is HeuryConfig {
  if (config === null || config === undefined || typeof config !== 'object') {
    throw new Error('Config must be a non-null object');
  }

  const obj = config as Record<string, unknown>;

  if (typeof obj.rootDir !== 'string') {
    throw new Error('Config rootDir must be a string');
  }

  if (typeof obj.outputDir !== 'string') {
    throw new Error('Config outputDir must be a string');
  }

  if (!Array.isArray(obj.include)) {
    throw new Error('Config include must be an array of strings');
  }

  if (!Array.isArray(obj.exclude)) {
    throw new Error('Config exclude must be an array of strings');
  }

  // Validate optional manifestTokenBudget
  if (obj.manifestTokenBudget !== undefined) {
    if (typeof obj.manifestTokenBudget !== 'number' || obj.manifestTokenBudget <= 0) {
      throw new Error('Config manifestTokenBudget must be a positive number');
    }
  }

  return true;
}

/**
 * Merges a partial config with DEFAULT_CONFIG.
 */
export function mergeWithDefaults(partial: Partial<HeuryConfig>): HeuryConfig {
  const config: HeuryConfig = {
    rootDir: partial.rootDir ?? DEFAULT_CONFIG.rootDir,
    outputDir: partial.outputDir ?? DEFAULT_CONFIG.outputDir,
    include: partial.include ?? DEFAULT_CONFIG.include,
    exclude: partial.exclude ?? DEFAULT_CONFIG.exclude,
  };

  if (partial.manifestTokenBudget !== undefined) {
    config.manifestTokenBudget = partial.manifestTokenBudget;
  }

  return config;
}
