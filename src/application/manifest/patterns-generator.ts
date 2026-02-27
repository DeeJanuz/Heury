import type { ICodeUnitRepository, IEnvVariableRepository } from '@/domain/ports/index.js';
import type { CodeUnit, CodeUnitPattern } from '@/domain/models/index.js';
import { PatternType } from '@/domain/models/index.js';
import { truncateToTokenBudget } from './token-budgeter.js';

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

  const lines: string[] = ['# Patterns', ''];

  // API Endpoints
  const apiEndpoints = patternsByType.get(PatternType.API_ENDPOINT);
  if (apiEndpoints && apiEndpoints.length > 0) {
    lines.push('## API Endpoints');
    for (const entry of apiEndpoints) {
      lines.push(`- ${entry.patternValue} - ${entry.filePath}:${entry.functionName}`);
    }
    lines.push('');
  }

  // Database Operations
  const dbReads = patternsByType.get(PatternType.DATABASE_READ) ?? [];
  const dbWrites = patternsByType.get(PatternType.DATABASE_WRITE) ?? [];
  if (dbReads.length > 0 || dbWrites.length > 0) {
    lines.push('## Database Operations');
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
  }

  // External Services
  const externalServices = patternsByType.get(PatternType.EXTERNAL_SERVICE);
  if (externalServices && externalServices.length > 0) {
    lines.push('## External Services');
    for (const entry of externalServices) {
      lines.push(`- ${entry.patternValue} - ${entry.filePath}:${entry.functionName}`);
    }
    lines.push('');
  }

  // API Calls
  const apiCalls = patternsByType.get(PatternType.API_CALL);
  if (apiCalls && apiCalls.length > 0) {
    lines.push('## API Calls');
    for (const entry of apiCalls) {
      lines.push(`- ${entry.patternValue} - ${entry.filePath}:${entry.functionName}`);
    }
    lines.push('');
  }

  // Environment Variables (from env var repository)
  if (envVars.length > 0) {
    lines.push('## Environment Variables');
    for (const envVar of envVars) {
      const desc = envVar.description ? ` - ${envVar.description}` : '';
      lines.push(`- ${envVar.name}${desc}`);
    }
    lines.push('');
  }

  return truncateToTokenBudget(lines.join('\n'), maxTokens);
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
