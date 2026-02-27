/**
 * Config file loading and saving.
 */

import type { HeuryConfig } from '@/domain/ports/index.js';
import type { IFileSystem } from '@/domain/ports/index.js';
import { mergeWithDefaults } from './schema.js';

export const CONFIG_FILENAME = 'heury.config.json';

/**
 * Load config from heury.config.json in the given directory.
 * If the file doesn't exist, returns defaults with rootDir set to directory.
 */
export async function loadConfig(
  directory: string,
  fileSystem: IFileSystem,
): Promise<HeuryConfig> {
  const configPath = `${directory}/${CONFIG_FILENAME}`;

  if (await fileSystem.exists(configPath)) {
    const raw = await fileSystem.readFile(configPath);
    const parsed = JSON.parse(raw) as Partial<HeuryConfig>;
    const merged = mergeWithDefaults(parsed);
    // Ensure rootDir reflects the directory the config was loaded from
    return { ...merged, rootDir: parsed.rootDir ?? directory };
  }

  return mergeWithDefaults({ rootDir: directory });
}

/**
 * Save config to heury.config.json in the given directory.
 */
export async function saveConfig(
  directory: string,
  config: HeuryConfig,
  fileSystem: IFileSystem,
): Promise<void> {
  const configPath = `${directory}/${CONFIG_FILENAME}`;
  await fileSystem.writeFile(configPath, JSON.stringify(config, null, 2));
}
