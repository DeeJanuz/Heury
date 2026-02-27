import { randomUUID } from 'node:crypto';

export enum PatternType {
  API_ENDPOINT = 'API_ENDPOINT',
  API_CALL = 'API_CALL',
  DATABASE_READ = 'DATABASE_READ',
  DATABASE_WRITE = 'DATABASE_WRITE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  ENV_VARIABLE = 'ENV_VARIABLE',
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
}

export interface CodeUnitPattern {
  readonly id: string;
  readonly codeUnitId: string;
  readonly patternType: PatternType;
  readonly patternValue: string;
  readonly lineNumber?: number;
  readonly columnAccess?: { read: string[]; write: string[] };
}

interface CreateCodeUnitPatternParams {
  id?: string;
  codeUnitId: string;
  patternType: PatternType;
  patternValue: string;
  lineNumber?: number;
  columnAccess?: { read: string[]; write: string[] };
}

export function createCodeUnitPattern(params: CreateCodeUnitPatternParams): CodeUnitPattern {
  if (!params.codeUnitId) {
    throw new Error('codeUnitId must not be empty');
  }
  if (!params.patternValue) {
    throw new Error('patternValue must not be empty');
  }

  return {
    id: params.id ?? randomUUID(),
    codeUnitId: params.codeUnitId,
    patternType: params.patternType,
    patternValue: params.patternValue,
    lineNumber: params.lineNumber,
    columnAccess: params.columnAccess,
  };
}
