import type { IFileDependencyRepository } from '@/domain/ports/index.js';
import { truncateToTokenBudget } from './token-budgeter.js';

/**
 * Generate DEPENDENCIES.md - file dependency graph.
 * Shows hub files (most imported) first, then full dependency graph.
 */
export function generateDependenciesManifest(
  dependencyRepo: IFileDependencyRepository,
  maxTokens: number,
): string {
  const allDeps = dependencyRepo.findAll();
  const lines: string[] = ['# Dependencies', ''];

  if (allDeps.length === 0) {
    return truncateToTokenBudget(lines.join('\n'), maxTokens);
  }

  // Calculate import counts per target file
  const importCounts = new Map<string, number>();
  for (const dep of allDeps) {
    importCounts.set(dep.targetFile, (importCounts.get(dep.targetFile) ?? 0) + 1);
  }

  // Hub files: sorted by import count descending
  const hubFiles = [...importCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count >= 2);

  if (hubFiles.length > 0) {
    lines.push('## Hub Files (most imported)');
    for (const [file, count] of hubFiles) {
      lines.push(`- ${file} (imported by ${count} files)`);
    }
    lines.push('');
  }

  // Dependency graph: group by source file, sorted alphabetically
  const sourceFiles = new Map<string, string[]>();
  for (const dep of allDeps) {
    const targets = sourceFiles.get(dep.sourceFile) ?? [];
    targets.push(dep.targetFile);
    sourceFiles.set(dep.sourceFile, targets);
  }

  const sortedSources = [...sourceFiles.keys()].sort();

  lines.push('## Dependency Graph');
  for (const source of sortedSources) {
    lines.push(source);
    const targets = sourceFiles.get(source)!;
    for (const target of targets.sort()) {
      lines.push(`  \u2192 ${target}`);
    }
    lines.push('');
  }

  return truncateToTokenBudget(lines.join('\n'), maxTokens);
}
