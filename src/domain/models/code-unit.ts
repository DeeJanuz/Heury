import { randomUUID } from 'node:crypto';
import type { CodeUnitPattern } from './code-unit-pattern.js';

export enum CodeUnitType {
  MODULE = 'MODULE',
  FUNCTION = 'FUNCTION',
  ARROW_FUNCTION = 'ARROW_FUNCTION',
  CLASS = 'CLASS',
  METHOD = 'METHOD',
  STRUCT = 'STRUCT',
  TRAIT = 'TRAIT',
  INTERFACE = 'INTERFACE',
  ENUM = 'ENUM',
  IMPL_BLOCK = 'IMPL_BLOCK',
}

export interface CodeUnit {
  readonly id: string;
  readonly filePath: string;
  readonly name: string;
  readonly unitType: CodeUnitType;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly parentUnitId?: string;
  readonly signature?: string;
  readonly isAsync: boolean;
  readonly isExported: boolean;
  readonly language: string;
  readonly complexity: Record<string, number>;
  readonly complexityScore: number;
  readonly patterns: CodeUnitPattern[];
  readonly children: CodeUnit[];
}

interface CreateCodeUnitParams {
  id?: string;
  filePath: string;
  name: string;
  unitType: CodeUnitType;
  lineStart: number;
  lineEnd: number;
  parentUnitId?: string;
  signature?: string;
  isAsync: boolean;
  isExported: boolean;
  language: string;
  complexity?: Record<string, number>;
  complexityScore?: number;
  patterns?: CodeUnitPattern[];
  children?: CodeUnit[];
}

export function createCodeUnit(params: CreateCodeUnitParams): CodeUnit {
  if (!params.filePath) {
    throw new Error('filePath must not be empty');
  }
  if (!params.name) {
    throw new Error('name must not be empty');
  }
  if (params.lineStart < 1) {
    throw new Error('lineStart must be >= 1');
  }
  if (params.lineEnd < params.lineStart) {
    throw new Error('lineEnd must be >= lineStart');
  }

  return {
    id: params.id ?? randomUUID(),
    filePath: params.filePath,
    name: params.name,
    unitType: params.unitType,
    lineStart: params.lineStart,
    lineEnd: params.lineEnd,
    parentUnitId: params.parentUnitId,
    signature: params.signature,
    isAsync: params.isAsync,
    isExported: params.isExported,
    language: params.language,
    complexity: params.complexity ?? {},
    complexityScore: params.complexityScore ?? 0,
    patterns: params.patterns ?? [],
    children: params.children ?? [],
  };
}
