import { randomUUID } from 'node:crypto';

export enum ImportType {
  NAMED = 'NAMED',
  DEFAULT = 'DEFAULT',
  NAMESPACE = 'NAMESPACE',
  DYNAMIC = 'DYNAMIC',
  PACKAGE = 'PACKAGE',
  MODULE = 'MODULE',
  WILDCARD = 'WILDCARD',
}

export interface FileDependency {
  readonly id: string;
  readonly sourceFile: string;
  readonly targetFile: string;
  readonly importType: ImportType;
  readonly importedNames: string[];
}

interface CreateFileDependencyParams {
  id?: string;
  sourceFile: string;
  targetFile: string;
  importType: ImportType;
  importedNames?: string[];
}

export function createFileDependency(params: CreateFileDependencyParams): FileDependency {
  if (!params.sourceFile) {
    throw new Error('sourceFile must not be empty');
  }
  if (!params.targetFile) {
    throw new Error('targetFile must not be empty');
  }

  return {
    id: params.id ?? randomUUID(),
    sourceFile: params.sourceFile,
    targetFile: params.targetFile,
    importType: params.importType,
    importedNames: params.importedNames ?? [],
  };
}
