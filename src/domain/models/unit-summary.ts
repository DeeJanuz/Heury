import { randomUUID } from 'node:crypto';

export interface UnitSummary {
  readonly id: string;
  readonly codeUnitId: string;
  readonly summary: string;
  readonly keyBehaviors: string[];
  readonly sideEffects: string[];
  readonly providerModel: string;
  readonly generatedAt: string;
}

interface CreateUnitSummaryParams {
  id?: string;
  codeUnitId: string;
  summary: string;
  keyBehaviors?: string[];
  sideEffects?: string[];
  providerModel: string;
  generatedAt: string;
}

export function createUnitSummary(params: CreateUnitSummaryParams): UnitSummary {
  if (!params.codeUnitId) throw new Error('codeUnitId must not be empty');
  if (!params.summary) throw new Error('summary must not be empty');
  if (!params.providerModel) throw new Error('providerModel must not be empty');
  if (!params.generatedAt) throw new Error('generatedAt must not be empty');
  return {
    id: params.id ?? randomUUID(),
    codeUnitId: params.codeUnitId,
    summary: params.summary,
    keyBehaviors: params.keyBehaviors ?? [],
    sideEffects: params.sideEffects ?? [],
    providerModel: params.providerModel,
    generatedAt: params.generatedAt,
  };
}
