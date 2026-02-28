import type { IFileDependencyRepository } from '@/domain/ports/index.js';
import { fitSections, type Section } from './token-budgeter.js';

/**
 * Generate DEPENDENCIES.md - file dependency graph.
 * Uses section-based inclusion: hub files get highest priority,
 * source files scored by import count (orchestrators rank higher).
 */
export function generateDependenciesManifest(
  dependencyRepo: IFileDependencyRepository,
  maxTokens: number,
): string {
  const allDeps = dependencyRepo.findAll();

  if (allDeps.length === 0) {
    return fitSections('# Dependencies\n', [], maxTokens);
  }

  const sections: Section[] = [];

  // Calculate import counts per target file (for hub files)
  const importCounts = new Map<string, number>();
  for (const dep of allDeps) {
    importCounts.set(dep.targetFile, (importCounts.get(dep.targetFile) ?? 0) + 1);
  }

  // Hub files section: scored high so it's always included first
  const hubFiles = [...importCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count >= 2);

  if (hubFiles.length > 0) {
    const hubLines: string[] = ['## Hub Files (most imported)'];
    for (const [file, count] of hubFiles) {
      hubLines.push(`- ${file} (imported by ${count} files)`);
    }
    hubLines.push('');
    sections.push({ content: hubLines.join('\n') + '\n', score: 100 });
  }

  // Build per-source-file sections, scored by number of imports
  const sourceFiles = new Map<string, string[]>();
  for (const dep of allDeps) {
    const targets = sourceFiles.get(dep.sourceFile) ?? [];
    targets.push(dep.targetFile);
    sourceFiles.set(dep.sourceFile, targets);
  }

  for (const [source, targets] of sourceFiles) {
    const lines: string[] = [source];
    for (const target of targets.sort()) {
      lines.push(`  → ${target}`);
    }
    lines.push('');
    sections.push({ content: lines.join('\n') + '\n', score: targets.length });
  }

  return fitSections('# Dependencies\n', sections, maxTokens);
}
