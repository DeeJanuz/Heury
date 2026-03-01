/**
 * Source extraction utility for MCP tools.
 * Reads file content and extracts specific line ranges for code units.
 */

import type { IFileSystem } from '@/domain/ports/index.js';

export interface SourceUnit {
  readonly filePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
}

/**
 * Extract source code lines for a single unit.
 * Returns the source string, or null on any error (file not found, etc.).
 */
export async function extractSourceForUnit(
  fileSystem: IFileSystem,
  unit: SourceUnit,
): Promise<string | null> {
  try {
    const content = await fileSystem.readFile(unit.filePath);
    const lines = content.split('\n');
    const extracted = lines.slice(unit.lineStart - 1, unit.lineEnd);
    return extracted.join('\n');
  } catch {
    return null;
  }
}

/**
 * Extract source code lines for multiple units with file-level caching.
 * Returns an array of source strings (or null) matching the input array order.
 * Files are read at most once, even when multiple units reference the same file.
 */
export async function extractSourceForUnits(
  fileSystem: IFileSystem,
  units: readonly SourceUnit[],
): Promise<(string | null)[]> {
  const fileCache = new Map<string, string | null>();

  async function getFileContent(filePath: string): Promise<string | null> {
    if (fileCache.has(filePath)) {
      return fileCache.get(filePath)!;
    }

    try {
      const content = await fileSystem.readFile(filePath);
      fileCache.set(filePath, content);
      return content;
    } catch {
      fileCache.set(filePath, null);
      return null;
    }
  }

  const results: (string | null)[] = [];

  for (const unit of units) {
    const content = await getFileContent(unit.filePath);
    if (content === null) {
      results.push(null);
    } else {
      const lines = content.split('\n');
      const extracted = lines.slice(unit.lineStart - 1, unit.lineEnd);
      results.push(extracted.join('\n'));
    }
  }

  return results;
}
