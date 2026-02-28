import type { ICodeUnitRepository, IEnvVariableRepository } from '@/domain/ports/index.js';
import type { CodeUnit, CodeUnitPattern } from '@/domain/models/index.js';
import { PatternType } from '@/domain/models/index.js';
import { fitSections, type Section } from './token-budgeter.js';

interface PatternEntry {
  readonly patternValue: string;
  readonly filePath: string;
  readonly functionName: string;
}

/**
 * Generate PATTERNS.md - all detected patterns grouped by type.
 */
export function generatePatternsManifest(
  codeUnitRepo: ICodeUnitRepository,
  envVarRepo: IEnvVariableRepository,
  maxTokens: number,
): string {
  const allUnits = codeUnitRepo.findAll();
  const patternsByType = groupPatternsByType(allUnits);
  const envVars = envVarRepo.findAll();

  const sections: Section[] = [];

  // API Endpoints
  const apiEndpoints = patternsByType.get(PatternType.API_ENDPOINT);
  if (apiEndpoints && apiEndpoints.length > 0) {
    const lines: string[] = ['## API Endpoints'];
    for (const entry of apiEndpoints) {
      lines.push(`- ${entry.patternValue} - ${entry.filePath}:${entry.functionName}`);
    }
    lines.push('');
    sections.push({ content: lines.join('\n'), score: apiEndpoints.length });
  }

  // Database Operations
  const dbReads = patternsByType.get(PatternType.DATABASE_READ) ?? [];
  const dbWrites = patternsByType.get(PatternType.DATABASE_WRITE) ?? [];
  if (dbReads.length > 0 || dbWrites.length > 0) {
    const lines: string[] = ['## Database Operations'];
    if (dbReads.length > 0) {
      lines.push('### Reads');
      for (const entry of dbReads) {
        lines.push(
          `- ${entry.patternValue} - ${entry.filePath}:${entry.functionName}`,
        );
      }
    }
    if (dbWrites.length > 0) {
      lines.push('### Writes');
      for (const entry of dbWrites) {
        lines.push(
          `- ${entry.patternValue} - ${entry.filePath}:${entry.functionName}`,
        );
      }
    }
    lines.push('');
    sections.push({ content: lines.join('\n'), score: dbReads.length + dbWrites.length });
  }

  // External Services
  const externalServices = patternsByType.get(PatternType.EXTERNAL_SERVICE);
  if (externalServices && externalServices.length > 0) {
    const lines: string[] = ['## External Services'];
    for (const entry of externalServices) {
      lines.push(`- ${entry.patternValue} - ${entry.filePath}:${entry.functionName}`);
    }
    lines.push('');
    sections.push({ content: lines.join('\n'), score: externalServices.length });
  }

  // API Calls
  const apiCalls = patternsByType.get(PatternType.API_CALL);
  if (apiCalls && apiCalls.length > 0) {
    const lines: string[] = ['## API Calls'];
    for (const entry of apiCalls) {
      lines.push(`- ${entry.patternValue} - ${entry.filePath}:${entry.functionName}`);
    }
    lines.push('');
    sections.push({ content: lines.join('\n'), score: apiCalls.length });
  }

  // Environment Variables
  if (envVars.length > 0) {
    const lines: string[] = ['## Environment Variables'];
    for (const envVar of envVars) {
      const desc = envVar.description ? ` - ${envVar.description}` : '';
      lines.push(`- ${envVar.name}${desc}`);
    }
    lines.push('');
    sections.push({ content: lines.join('\n'), score: envVars.length });
  }

  return fitSections('# Patterns\n\n', sections, maxTokens);
}

function groupPatternsByType(units: CodeUnit[]): Map<PatternType, PatternEntry[]> {
  const groups = new Map<PatternType, PatternEntry[]>();

  for (const unit of units) {
    for (const pattern of unit.patterns) {
      const entries = groups.get(pattern.patternType) ?? [];
      entries.push({
        patternValue: pattern.patternValue,
        filePath: unit.filePath,
        functionName: unit.name,
      });
      groups.set(pattern.patternType, entries);
    }
  }

  return groups;
}
