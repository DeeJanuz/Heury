import type { ICodeUnitRepository, IFunctionCallRepository } from '@/domain/ports/index.js';
import type { CodeUnit } from '@/domain/models/index.js';
import { CodeUnitType } from '@/domain/models/index.js';
import { fitSections } from './token-budgeter.js';
import type { Section } from './token-budgeter.js';

const MAX_COMPLEX_FUNCTIONS = 10;
const MAX_FAN_OUT_FUNCTIONS = 10;

const HEADER = '# Hotspots\n';

/**
 * Generate HOTSPOTS.md - complex code, critical paths, risk areas.
 */
export function generateHotspotsManifest(
  codeUnitRepo: ICodeUnitRepository,
  maxTokens: number,
  functionCallRepo?: IFunctionCallRepository,
): string {
  const allUnits = codeUnitRepo.findAll();

  if (allUnits.length === 0) {
    return fitSections(HEADER, [], maxTokens);
  }

  const callable = allUnits.filter(isCallable);
  const sections: Section[] = [];

  // Most complex functions (top 10 by complexityScore) - highest priority
  const sortedByComplexity = [...callable]
    .sort((a, b) => b.complexityScore - a.complexityScore)
    .slice(0, MAX_COMPLEX_FUNCTIONS)
    .filter((u) => u.complexityScore > 0);

  if (sortedByComplexity.length > 0) {
    const lines: string[] = ['## Most Complex Functions'];
    for (let i = 0; i < sortedByComplexity.length; i++) {
      const unit = sortedByComplexity[i];
      const level = getComplexityLabel(unit.complexityScore);
      lines.push(
        `${i + 1}. \`${unit.name}\` (${unit.filePath}) - score: ${unit.complexityScore} (${level})`,
      );
    }
    lines.push('');
    sections.push({ content: lines.join('\n'), score: 3 });
  }

  // Critical paths: functions with 3+ different pattern types
  const criticalPaths = callable.filter((u) => {
    const uniqueTypes = new Set(u.patterns.map((p) => p.patternType));
    return uniqueTypes.size >= 3;
  });

  if (criticalPaths.length > 0) {
    const lines: string[] = ['## Critical Paths (functions with many patterns)'];
    for (const unit of criticalPaths) {
      const types = [...new Set(unit.patterns.map((p) => p.patternType))].sort();
      lines.push(`- \`${unit.name}\` - ${types.join(', ')}`);
    }
    lines.push('');
    sections.push({ content: lines.join('\n'), score: 2 });
  }

  // Files with most code units
  const fileCounts = new Map<string, number>();
  for (const unit of allUnits) {
    fileCounts.set(unit.filePath, (fileCounts.get(unit.filePath) ?? 0) + 1);
  }

  const topFiles = [...fileCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (topFiles.length > 0) {
    const lines: string[] = ['## Files with Most Code Units'];
    for (const [filePath, count] of topFiles) {
      lines.push(`- ${filePath} (${count} units)`);
    }
    lines.push('');
    sections.push({ content: lines.join('\n'), score: 1 });
  }

  // High fan-out functions
  if (functionCallRepo) {
    const fanOutSection = buildFanOutSection(functionCallRepo, codeUnitRepo);
    if (fanOutSection) {
      sections.push(fanOutSection);
    }
  }

  return fitSections(HEADER, sections, maxTokens);
}

function buildFanOutSection(
  functionCallRepo: IFunctionCallRepository,
  codeUnitRepo: ICodeUnitRepository,
): Section | undefined {
  const allCalls = functionCallRepo.findAll();
  if (allCalls.length === 0) {
    return undefined;
  }

  // Group by callerUnitId and count
  const callCounts = new Map<string, number>();
  for (const call of allCalls) {
    callCounts.set(call.callerUnitId, (callCounts.get(call.callerUnitId) ?? 0) + 1);
  }

  // Sort by count descending, take top 10
  const topCallers = [...callCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_FAN_OUT_FUNCTIONS);

  const lines: string[] = ['## High Fan-Out Functions'];
  let entryCount = 0;

  for (let i = 0; i < topCallers.length; i++) {
    const [unitId, count] = topCallers[i];
    const unit = codeUnitRepo.findById(unitId);
    if (!unit) continue;
    entryCount++;
    lines.push(`${entryCount}. \`${unit.name}\` (${unit.filePath}) - ${count} outgoing calls`);
  }

  if (entryCount === 0) {
    return undefined;
  }

  lines.push('');
  return { content: lines.join('\n'), score: 1 };
}

function isCallable(unit: CodeUnit): boolean {
  return (
    unit.unitType === CodeUnitType.FUNCTION ||
    unit.unitType === CodeUnitType.ARROW_FUNCTION ||
    unit.unitType === CodeUnitType.METHOD
  );
}

function getComplexityLabel(score: number): string {
  if (score >= 30) return 'complex';
  if (score >= 15) return 'moderate';
  return 'simple';
}
