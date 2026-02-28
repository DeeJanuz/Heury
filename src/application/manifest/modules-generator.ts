import type { ICodeUnitRepository, IFileDependencyRepository, ITypeFieldRepository } from '@/domain/ports/index.js';
import type { CodeUnit } from '@/domain/models/index.js';
import { CodeUnitType, PatternType } from '@/domain/models/index.js';
import { fitSections, type Section } from './token-budgeter.js';

const SCORED_PATTERN_TYPES = new Set<string>([
  PatternType.API_ENDPOINT,
  PatternType.DATABASE_READ,
  PatternType.DATABASE_WRITE,
  PatternType.EXTERNAL_SERVICE,
]);

const COMPLEXITY_THRESHOLD = 15;

/**
 * Generate MODULES.md - overview of all code modules/files.
 * Groups code units by file path, scored by relevance and fitted to budget.
 */
export function generateModulesManifest(
  codeUnitRepo: ICodeUnitRepository,
  dependencyRepo: IFileDependencyRepository,
  maxTokens: number,
  typeFieldRepo?: ITypeFieldRepository,
): string {
  const allUnits = codeUnitRepo.findAll();
  const fileGroups = groupByFilePath(allUnits);

  const sections: Section[] = [];

  for (const [filePath, units] of fileGroups) {
    const content = buildFileSection(filePath, units, typeFieldRepo);
    const score = scoreFile(units, filePath, dependencyRepo);
    sections.push({ content, score });
  }

  return fitSections('# Modules\n', sections, maxTokens);
}

const TYPE_FIELD_UNIT_TYPES = new Set<CodeUnitType>([
  CodeUnitType.CLASS,
  CodeUnitType.INTERFACE,
  CodeUnitType.TYPE_ALIAS,
  CodeUnitType.STRUCT,
  CodeUnitType.ENUM,
]);

function buildFileSection(filePath: string, units: CodeUnit[], typeFieldRepo?: ITypeFieldRepository): string {
  const lines: string[] = [];
  lines.push(`## ${filePath}`);

  const topLevelUnits = units.filter((u) => !u.parentUnitId);
  const childUnits = units.filter((u) => u.parentUnitId);

  for (const unit of topLevelUnits) {
    lines.push(formatCodeUnit(unit, '- '));
    appendTypeFields(lines, unit, '  ', typeFieldRepo);

    const children = childUnits.filter((c) => c.parentUnitId === unit.id);
    for (const child of children) {
      lines.push(formatCodeUnit(child, '  - '));
      appendTypeFields(lines, child, '    ', typeFieldRepo);
    }
  }

  const patternTypes = collectPatternTypes(units);
  if (patternTypes.length > 0) {
    lines.push(`- Patterns: ${patternTypes.join(', ')}`);
  }

  lines.push('');
  return lines.join('\n');
}

function appendTypeFields(
  lines: string[],
  unit: CodeUnit,
  indent: string,
  typeFieldRepo?: ITypeFieldRepository,
): void {
  if (!typeFieldRepo || !TYPE_FIELD_UNIT_TYPES.has(unit.unitType)) {
    return;
  }

  const fields = typeFieldRepo.findByParentUnitId(unit.id);
  for (const field of fields) {
    const readonlyPrefix = field.isReadonly ? 'readonly ' : '';
    const optionalSuffix = field.isOptional ? '?' : '';
    const optionalFlag = field.isOptional ? ' (optional)' : '';
    lines.push(`${indent}- ${readonlyPrefix}${field.name}${optionalSuffix}: ${field.fieldType}${optionalFlag}`);
  }
}

function scoreFile(
  units: CodeUnit[],
  filePath: string,
  dependencyRepo: IFileDependencyRepository,
): number {
  let score = 0;

  for (const unit of units) {
    if (unit.isExported) {
      score += 3;
    }

    for (const pattern of unit.patterns) {
      if (SCORED_PATTERN_TYPES.has(pattern.patternType)) {
        score += 2;
      }
    }

    if (unit.complexityScore >= COMPLEXITY_THRESHOLD) {
      score += 1;
    }
  }

  const inboundDeps = dependencyRepo.findByTargetFile(filePath);
  score += inboundDeps.length;

  return score;
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
