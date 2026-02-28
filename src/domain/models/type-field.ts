import { randomUUID } from 'node:crypto';

export interface TypeField {
  readonly id: string;
  readonly parentUnitId: string;
  readonly name: string;
  readonly fieldType: string;
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
  readonly lineNumber: number;
}

interface CreateTypeFieldParams {
  id?: string;
  parentUnitId: string;
  name: string;
  fieldType: string;
  isOptional: boolean;
  isReadonly: boolean;
  lineNumber: number;
}

export function createTypeField(params: CreateTypeFieldParams): TypeField {
  if (!params.parentUnitId) throw new Error('parentUnitId must not be empty');
  if (!params.name) throw new Error('name must not be empty');
  if (!params.fieldType) throw new Error('fieldType must not be empty');
  if (params.lineNumber < 1) throw new Error('lineNumber must be >= 1');
  return {
    id: params.id ?? randomUUID(),
    parentUnitId: params.parentUnitId,
    name: params.name,
    fieldType: params.fieldType,
    isOptional: params.isOptional,
    isReadonly: params.isReadonly,
    lineNumber: params.lineNumber,
  };
}
