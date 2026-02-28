import type { RepositoryGuardClause } from '@/domain/models/index.js';
import type { IGuardClauseRepository } from '@/domain/ports/index.js';

export class InMemoryGuardClauseRepository implements IGuardClauseRepository {
  private readonly guards = new Map<string, RepositoryGuardClause>();

  save(guard: RepositoryGuardClause): void {
    this.guards.set(guard.id, guard);
  }

  saveBatch(guards: RepositoryGuardClause[]): void {
    for (const guard of guards) {
      this.save(guard);
    }
  }

  findByCodeUnitId(codeUnitId: string): RepositoryGuardClause[] {
    return [...this.guards.values()].filter((g) => g.codeUnitId === codeUnitId);
  }

  findByGuardType(guardType: string): RepositoryGuardClause[] {
    return [...this.guards.values()].filter((g) => g.guardType === guardType);
  }

  findAll(): RepositoryGuardClause[] {
    return [...this.guards.values()];
  }

  deleteByCodeUnitId(codeUnitId: string): void {
    for (const [id, guard] of this.guards) {
      if (guard.codeUnitId === codeUnitId) {
        this.guards.delete(id);
      }
    }
  }

  clear(): void {
    this.guards.clear();
  }
}
