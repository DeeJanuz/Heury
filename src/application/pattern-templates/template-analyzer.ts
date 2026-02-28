import { randomUUID } from 'node:crypto';
import type { CodeUnit } from '@/domain/models/index.js';

export interface PatternTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly patternTypes: string[];
  readonly templateUnitId: string;
  readonly templateFilePath: string;
  readonly followers: Array<{ filePath: string; unitName: string }>;
  readonly followerCount: number;
  readonly conventions: string[];
}

/**
 * Analyze code units and detect recurring pattern combinations (conventions),
 * select canonical examples (templates), and identify followers.
 *
 * Pure function: no repository access, takes code units as input.
 */
export function detectPatternTemplates(units: CodeUnit[]): PatternTemplate[] {
  const groups = groupByPatternCombo(units);
  const templates: PatternTemplate[] = [];

  for (const [comboKey, members] of groups) {
    if (members.length < 3) {
      continue;
    }

    const sorted = rankCandidates(members);
    const template = sorted[0];
    const followers = sorted.slice(1);
    const patternTypes = comboKey.split('|');

    templates.push({
      id: randomUUID(),
      name: deriveName(patternTypes),
      description: deriveDescription(patternTypes, members.length),
      patternTypes,
      templateUnitId: template.id,
      templateFilePath: template.filePath,
      followers: followers.map((u) => ({ filePath: u.filePath, unitName: u.name })),
      followerCount: followers.length,
      conventions: deriveConventions(patternTypes),
    });
  }

  templates.sort((a, b) => b.followerCount - a.followerCount);
  return templates;
}

function groupByPatternCombo(units: CodeUnit[]): Map<string, CodeUnit[]> {
  const groups = new Map<string, CodeUnit[]>();

  for (const unit of units) {
    if (unit.patterns.length === 0) {
      continue;
    }

    const uniqueTypes = [...new Set(unit.patterns.map((p) => p.patternType))].sort();
    const key = uniqueTypes.join('|');

    const group = groups.get(key) ?? [];
    group.push(unit);
    groups.set(key, group);
  }

  return groups;
}

function rankCandidates(units: CodeUnit[]): CodeUnit[] {
  return [...units].sort((a, b) => {
    // Lower complexity scores better (ascending)
    const complexityDiff = a.complexityScore - b.complexityScore;
    if (complexityDiff !== 0) return complexityDiff;

    // Having a signature scores better (signature present first)
    const sigA = a.signature ? 1 : 0;
    const sigB = b.signature ? 1 : 0;
    if (sigA !== sigB) return sigB - sigA;

    // More patterns scores better (descending)
    const patternDiff = b.patterns.length - a.patterns.length;
    if (patternDiff !== 0) return patternDiff;

    // Being exported scores better (exported first)
    const expA = a.isExported ? 1 : 0;
    const expB = b.isExported ? 1 : 0;
    if (expA !== expB) return expB - expA;

    // Break ties by file path alphabetically
    return a.filePath.localeCompare(b.filePath);
  });
}

function formatPatternType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function deriveName(patternTypes: string[]): string {
  const formatted = patternTypes.map(formatPatternType);
  if (formatted.length === 1) {
    return formatted[0];
  }
  const last = formatted.pop()!;
  return `${formatted.join(', ')} with ${last}`;
}

function deriveDescription(patternTypes: string[], count: number): string {
  const formatted = patternTypes.map(formatPatternType);
  const joined =
    formatted.length === 1
      ? formatted[0]
      : `${formatted.slice(0, -1).join(', ')}, and ${formatted[formatted.length - 1]}`;
  return `Functions that combine ${joined}. Found in ${count} locations.`;
}

const CONVENTION_MAP: Record<string, Record<string, string>> = {
  'API_ENDPOINT|DATABASE_WRITE': {
    combo: 'Writes to database from API endpoint handler',
  },
  'API_ENDPOINT|DATABASE_READ': {
    combo: 'Reads from database in API endpoint handler',
  },
  'API_ENDPOINT|EXTERNAL_SERVICE': {
    combo: 'Calls external service from API endpoint handler',
  },
  'DATABASE_READ|DATABASE_WRITE': {
    combo: 'Reads and writes to database in single operation',
  },
  'API_ENDPOINT|DATABASE_READ|DATABASE_WRITE': {
    combo: 'API endpoint performing both database reads and writes',
  },
};

const SINGLE_PATTERN_CONVENTIONS: Record<string, string[]> = {
  API_ENDPOINT: ['Exposes an HTTP endpoint'],
  API_CALL: ['Makes outbound API calls'],
  DATABASE_READ: ['Reads from database'],
  DATABASE_WRITE: ['Writes to database'],
  EXTERNAL_SERVICE: ['Integrates with external service'],
  ENV_VARIABLE: ['Uses environment configuration'],
  IMPORT: ['Imports external dependency'],
  EXPORT: ['Exports public interface'],
};

function deriveConventions(patternTypes: string[]): string[] {
  const conventions: string[] = [];

  const comboKey = patternTypes.join('|');
  const mapped = CONVENTION_MAP[comboKey];
  if (mapped) {
    conventions.push(mapped.combo);
  }

  for (const pt of patternTypes) {
    const single = SINGLE_PATTERN_CONVENTIONS[pt];
    if (single) {
      conventions.push(...single);
    }
  }

  return conventions.length > 0 ? conventions.slice(0, 3) : [`Uses ${patternTypes.map(formatPatternType).join(' and ')}`];
}
