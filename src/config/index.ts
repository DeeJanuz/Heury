/**
 * Config module barrel export.
 */

export { DEFAULT_CONFIG, validateConfig, mergeWithDefaults } from './schema.js';
export type { HeuryConfig } from './schema.js';
export { loadConfig, saveConfig, CONFIG_FILENAME } from './loader.js';
