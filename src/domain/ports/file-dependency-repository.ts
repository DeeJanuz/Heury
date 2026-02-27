import type { FileDependency } from '@/domain/models/index.js';

export interface IFileDependencyRepository {
  save(dep: FileDependency): void;
  saveBatch(deps: FileDependency[]): void;
  findBySourceFile(sourceFile: string): FileDependency[];
  findByTargetFile(targetFile: string): FileDependency[];
  findAll(): FileDependency[];
  deleteBySourceFile(sourceFile: string): void;
  clear(): void;
}
