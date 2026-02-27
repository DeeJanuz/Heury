import { randomUUID } from 'node:crypto';

export interface RepositoryEnvVariable {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly hasDefault: boolean;
  readonly lineNumber: number;
}

interface CreateEnvVariableParams {
  id?: string;
  name: string;
  description?: string;
  hasDefault?: boolean;
  lineNumber: number;
}

export function createEnvVariable(params: CreateEnvVariableParams): RepositoryEnvVariable {
  if (!params.name) {
    throw new Error('name must not be empty');
  }
  if (params.lineNumber < 1) {
    throw new Error('lineNumber must be >= 1');
  }

  return {
    id: params.id ?? randomUUID(),
    name: params.name,
    description: params.description,
    hasDefault: params.hasDefault ?? false,
    lineNumber: params.lineNumber,
  };
}
