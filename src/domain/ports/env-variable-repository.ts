import type { RepositoryEnvVariable } from '@/domain/models/index.js';

export interface IEnvVariableRepository {
  save(envVar: RepositoryEnvVariable): void;
  saveBatch(envVars: RepositoryEnvVariable[]): void;
  findByName(name: string): RepositoryEnvVariable | undefined;
  findAll(): RepositoryEnvVariable[];
  clear(): void;
}
