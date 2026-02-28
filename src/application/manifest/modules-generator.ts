import type { ICodeUnitRepository } from '@/domain/ports/index.js';
import type { CodeUnit } from '@/domain/models/index.js';
import { CodeUnitType, PatternType } from '@/domain/models/index.js';
import { truncateToTokenBudget } from './token-budgeter.js';

/**
 * Generate MODULES.md - overview of all code modules/files.
 * Groups code units by file path, sorted alphabetically.
 */
export function generateModulesManifest(
  codeUnitRepo: ICodeUnitRepository,
  maxTokens: number,
): string {
  const allUnits = codeUnitRepo.findAll();
  const fileGroups = groupByFilePath(allUnits);
  const sortedPaths = [...fileGroups.keys()].sort();

  const lines: string[] = ['# Modules', ''];

  for (const filePath of sortedPaths) {
    const units = fileGroups.get(filePath)!;
    lines.push(`## ${filePath}`);

    const topLevelUnits = units.filter((u) => !u.parentUnitId);
    const childUnits = units.filter((u) => u.parentUnitId);

    for (const unit of topLevelUnits) {
      lines.push(formatCodeUnit(unit, '- '));

      // Find children (methods of this class)
      const children = childUnits.filter((c) => c.parentUnitId === unit.id);
      for (const child of children) {
        lines.push(formatCodeUnit(child, '  - '));
      }
    }

    // Summarize patterns for the file
    const patternTypes = collectPatternTypes(units);
    if (patternTypes.length > 0) {
      lines.push(`- Patterns: ${patternTypes.join(', ')}`);
    }

    lines.push('');
  }

  return truncateToTokenBudget(lines.join('\n'), maxTokens);
}

function groupByFilePath(units: CodeUnit[]): Map<string, CodeUnit[]> {
  const groups = new Map<string, CodeUnit[]>();
  for (const unit of units) {
    const existing = groups.get(unit.filePath) ?? [];
    existing.push(unit);
    groups.set(unit.filePath, existing);
  }
  return groups;
}

function formatCodeUnit(unit: CodeUnit, prefix: string): string {
  const typeName = formatType(unit.unitType);
  const asyncLabel = unit.isAsync ? 'async ' : '';
  const rawSignature = unit.isExported && unit.signature ? unit.signature : '';
  const signatureLabel = rawSignature && !rawSignature.startsWith('(') ? ` ${rawSignature}` : rawSignature;
  const complexityLabel =
    unit.complexityScore > 0 ? `, complexity: ${unit.complexityScore}` : '';

  return `${prefix}\`${unit.name}\` - ${asyncLabel}${typeName}${signatureLabel}${complexityLabel}`;
}

function formatType(unitType: CodeUnitType): string {
  switch (unitType) {
    case CodeUnitType.FUNCTION:
    case CodeUnitType.ARROW_FUNCTION:
      return 'function';
    case CodeUnitType.CLASS:
      return 'class';
    case CodeUnitType.METHOD:
      return 'method';
    case CodeUnitType.STRUCT:
      return 'struct';
    case CodeUnitType.TRAIT:
      return 'trait';
    case CodeUnitType.INTERFACE:
      return 'interface';
    case CodeUnitType.ENUM:
      return 'enum';
    case CodeUnitType.IMPL_BLOCK:
      return 'impl';
    case CodeUnitType.TYPE_ALIAS:
      return 'type';
    case CodeUnitType.MODULE:
      return 'module';
    default:
      return 'unknown';
  }
}

function collectPatternTypes(units: CodeUnit[]): string[] {
  const types = new Set<string>();
  for (const unit of units) {
    for (const pattern of unit.patterns) {
      types.add(pattern.patternType);
    }
  }
  return [...types].sort();
}
