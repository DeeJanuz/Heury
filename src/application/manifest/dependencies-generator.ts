import type { IFileDependencyRepository } from '@/domain/ports/index.js';
import { detectCircularDeps } from '@/application/graph-analysis/circular-deps.js';
import { estimateTokens, fitSections, type Section } from './token-budgeter.js';

/**
 * Generate DEPENDENCIES.md - file dependency graph.
 * Uses section-based inclusion: hub files get highest priority,
 * source files scored by import count (orchestrators rank higher).
 * Appends a Circular Dependencies section when cycles are detected.
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

  const mainOutput = fitSections('# Dependencies\n', sections, maxTokens);

  // Append circular dependencies section if cycles are detected
  const circularDeps = detectCircularDeps(allDeps);
  if (circularDeps.length === 0) {
    return mainOutput;
  }

  const remainingTokens = maxTokens - estimateTokens(mainOutput);
  if (remainingTokens <= 0) {
    return mainOutput;
  }

  const circularHeader = '\n## Circular Dependencies\n\n';
  const circularSections: Section[] = circularDeps.map((dep, index) => {
    const lines: string[] = [];
    lines.push(`### Cycle ${index + 1} (${dep.length} files)`);
    lines.push(dep.cycle.join(' → '));
    lines.push('');
    return { content: lines.join('\n') + '\n', score: 100 - index };
  });

  const circularOutput = fitSections(circularHeader, circularSections, remainingTokens);

  // Only append if at least one cycle was included (not just the header)
  if (circularOutput === circularHeader) {
    return mainOutput;
  }

  return mainOutput + circularOutput;
}
