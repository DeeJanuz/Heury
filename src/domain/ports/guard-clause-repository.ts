import type { RepositoryGuardClause } from '@/domain/models/index.js';

export interface IGuardClauseRepository {
  save(guard: RepositoryGuardClause): void;
  saveBatch(guards: RepositoryGuardClause[]): void;
  findByCodeUnitId(codeUnitId: string): RepositoryGuardClause[];
  findByGuardType(guardType: string): RepositoryGuardClause[];
  findAll(): RepositoryGuardClause[];
  deleteByCodeUnitId(codeUnitId: string): void;
  clear(): void;
}
