import type { RepositoryEnvVariable } from '@/domain/models/index.js';
import type { IEnvVariableRepository } from '@/domain/ports/index.js';

export class InMemoryEnvVariableRepository implements IEnvVariableRepository {
  private readonly vars = new Map<string, RepositoryEnvVariable>();

  save(envVar: RepositoryEnvVariable): void {
    this.vars.set(envVar.name, envVar);
  }

  saveBatch(envVars: RepositoryEnvVariable[]): void {
    for (const envVar of envVars) {
      this.save(envVar);
    }
  }

  findByName(name: string): RepositoryEnvVariable | undefined {
    return this.vars.get(name);
  }

  findAll(): RepositoryEnvVariable[] {
    return [...this.vars.values()];
  }

  clear(): void {
    this.vars.clear();
  }
}
