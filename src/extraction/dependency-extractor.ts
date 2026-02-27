/**
 * Dependency Extractor Service
 *
 * Extracts import/require/re-export statements from JS/TS content.
 * Resolves relative paths, skips external modules.
 */

import { ImportType } from '@/domain/models/index.js';

import type { FileDependencyInfo } from './types.js';

/**
 * Import detection patterns.
 */
const IMPORT_PATTERNS = {
  namedImport: /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g,
  defaultImport: /import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s*['"]([^'"]+)['"]/g,
  namespaceImport: /import\s*\*\s*as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s*['"]([^'"]+)['"]/g,
  requireStatement:
    /(?:const|let|var)\s+(?:(\{[^}]+\})|([A-Za-z_$][A-Za-z0-9_$]*))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  dynamicImport: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  reExport: /export\s*(?:\{[^}]*\}|\*)\s*from\s*['"]([^'"]+)['"]/g,
};

function isExternalModule(modulePath: string): boolean {
  return !modulePath.startsWith('.') && !modulePath.startsWith('/');
}

function resolveRelativePath(fromFile: string, importPath: string): string | null {
  if (isExternalModule(importPath)) {
    return null;
  }

  const pathParts = fromFile.split('/');
  pathParts.pop(); // Remove filename
  const resultParts = pathParts.filter(Boolean);

  const importParts = importPath.split('/');
  for (const part of importParts) {
    if (part === '.') {
      continue;
    } else if (part === '..') {
      resultParts.pop();
    } else {
      resultParts.push(part);
    }
  }

  return resultParts.join('/');
}

function extractImportedNames(importString: string): string[] {
  return importString
    .replace(/[{}]/g, '')
    .split(',')
    .map((name) => {
      const parts = name.trim().split(/\s+as\s+/);
      const cleanName = parts[0].replace(/^type\s+/, '').trim();
      return cleanName;
    })
    .filter((name) => name.length > 0 && name !== 'type');
}

/**
 * Extract dependencies (imports) from JS/TS file content.
 *
 * @param content - The file content to analyze
 * @param filePath - The path of the source file
 * @returns Array of FileDependencyInfo objects (only local dependencies)
 */
export function extractDependencies(content: string, filePath: string): FileDependencyInfo[] {
  const dependencies: FileDependencyInfo[] = [];
  const seenDeps = new Set<string>();

  function addDependency(
    importPath: string,
    importType: ImportType,
    importedNames: string[],
  ): void {
    if (isExternalModule(importPath)) {
      return;
    }

    const resolvedPath = resolveRelativePath(filePath, importPath);
    if (!resolvedPath) {
      return;
    }

    if (resolvedPath.includes('node_modules')) {
      return;
    }

    const key = `${resolvedPath}:${importType}`;
    if (seenDeps.has(key)) {
      return;
    }
    seenDeps.add(key);

    dependencies.push({
      targetFile: resolvedPath,
      importType,
      importedNames,
    });
  }

  // Named imports
  let match;
  const namedPattern = new RegExp(IMPORT_PATTERNS.namedImport.source, 'g');
  while ((match = namedPattern.exec(content)) !== null) {
    const names = extractImportedNames(match[1]);
    addDependency(match[2], ImportType.NAMED, names);
  }

  // Default imports
  const defaultPattern = new RegExp(IMPORT_PATTERNS.defaultImport.source, 'g');
  while ((match = defaultPattern.exec(content)) !== null) {
    const name = match[1];
    if (name === 'type' || name === 'typeof') continue;
    addDependency(match[2], ImportType.DEFAULT, [name]);
  }

  // Namespace imports
  const namespacePattern = new RegExp(IMPORT_PATTERNS.namespaceImport.source, 'g');
  while ((match = namespacePattern.exec(content)) !== null) {
    addDependency(match[2], ImportType.NAMESPACE, [match[1]]);
  }

  // CommonJS require
  const requirePattern = new RegExp(IMPORT_PATTERNS.requireStatement.source, 'g');
  while ((match = requirePattern.exec(content)) !== null) {
    const destructured = match[1];
    const singleName = match[2];
    const modulePath = match[3];
    if (destructured) {
      const names = extractImportedNames(destructured);
      addDependency(modulePath, ImportType.NAMED, names);
    } else if (singleName) {
      addDependency(modulePath, ImportType.DEFAULT, [singleName]);
    }
  }

  // Dynamic imports
  const dynamicPattern = new RegExp(IMPORT_PATTERNS.dynamicImport.source, 'g');
  while ((match = dynamicPattern.exec(content)) !== null) {
    addDependency(match[1], ImportType.DYNAMIC, []);
  }

  // Re-exports
  const reExportPattern = new RegExp(IMPORT_PATTERNS.reExport.source, 'g');
  while ((match = reExportPattern.exec(content)) !== null) {
    addDependency(match[1], ImportType.NAMED, []);
  }

  return dependencies;
}
