/**
 * CLI init command - initializes heury in a directory.
 */

import type { IFileSystem } from '@/domain/ports/index.js';
import { saveConfig, loadConfig, CONFIG_FILENAME } from '@/config/loader.js';
import { mergeWithDefaults } from '@/config/schema.js';
import { NodeFileSystem } from '@/adapters/filesystem/node-filesystem.js';

export async function initCommand(
  options: { dir: string },
  fileSystem?: IFileSystem,
): Promise<void> {
  const fs = fileSystem ?? new NodeFileSystem();
  const dir = options.dir;

  const heuryDir = `${dir}/.heury`;
  const configPath = `${dir}/${CONFIG_FILENAME}`;

  // Check if already initialized
  if (await fs.exists(configPath)) {
    console.log(`heury is already initialized in ${dir}`);
    return;
  }

  // Create .heury directory
  await fs.mkdir(heuryDir);

  // Create config with defaults
  const config = mergeWithDefaults({ rootDir: dir });
  await saveConfig(dir, config, fs);

  console.log(`heury initialized in ${dir}`);
  console.log(`  Config: ${configPath}`);
  console.log(`  Output: ${heuryDir}`);
}
