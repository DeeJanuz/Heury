import { randomUUID } from 'node:crypto';

export interface SchemaModelField {
  readonly id: string;
  readonly modelId: string;
  readonly name: string;
  readonly fieldType: string;
  readonly isPrimaryKey: boolean;
  readonly isRequired: boolean;
  readonly isUnique: boolean;
  readonly hasDefault: boolean;
  readonly relationTarget?: string;
}

export interface SchemaModel {
  readonly id: string;
  readonly name: string;
  readonly filePath: string;
  readonly framework: string;
  readonly tableName?: string;
  readonly fields: SchemaModelField[];
}

interface CreateSchemaModelFieldParams {
  id?: string;
  modelId: string;
  name: string;
  fieldType: string;
  isPrimaryKey?: boolean;
  isRequired?: boolean;
  isUnique?: boolean;
  hasDefault?: boolean;
  relationTarget?: string;
}

export function createSchemaModelField(params: CreateSchemaModelFieldParams): SchemaModelField {
  if (!params.modelId) throw new Error('modelId must not be empty');
  if (!params.name) throw new Error('name must not be empty');
  if (!params.fieldType) throw new Error('fieldType must not be empty');
  return {
    id: params.id ?? randomUUID(),
    modelId: params.modelId,
    name: params.name,
    fieldType: params.fieldType,
    isPrimaryKey: params.isPrimaryKey ?? false,
    isRequired: params.isRequired ?? false,
    isUnique: params.isUnique ?? false,
    hasDefault: params.hasDefault ?? false,
    relationTarget: params.relationTarget,
  };
}

interface CreateSchemaModelParams {
  id?: string;
  name: string;
  filePath: string;
  framework: string;
  tableName?: string;
  fields?: SchemaModelField[];
}

export function createSchemaModel(params: CreateSchemaModelParams): SchemaModel {
  if (!params.name) throw new Error('name must not be empty');
  if (!params.filePath) throw new Error('filePath must not be empty');
  if (!params.framework) throw new Error('framework must not be empty');
  return {
    id: params.id ?? randomUUID(),
    name: params.name,
    filePath: params.filePath,
    framework: params.framework,
    tableName: params.tableName,
    fields: params.fields ?? [],
  };
}
