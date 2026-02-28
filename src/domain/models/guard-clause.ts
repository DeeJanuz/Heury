import { randomUUID } from 'node:crypto';

export interface RepositoryGuardClause {
  readonly id: string;
  readonly codeUnitId: string;
  readonly guardType: string;
  readonly condition: string;
  readonly lineNumber: number;
}

interface CreateGuardClauseParams {
  id?: string;
  codeUnitId: string;
  guardType: string;
  condition: string;
  lineNumber: number;
}

export function createGuardClause(params: CreateGuardClauseParams): RepositoryGuardClause {
  if (!params.codeUnitId) throw new Error('codeUnitId must not be empty');
  if (!params.guardType) throw new Error('guardType must not be empty');
  if (!params.condition) throw new Error('condition must not be empty');
  if (params.lineNumber < 1) throw new Error('lineNumber must be >= 1');
  return {
    id: params.id ?? randomUUID(),
    codeUnitId: params.codeUnitId,
    guardType: params.guardType,
    condition: params.condition,
    lineNumber: params.lineNumber,
  };
}
