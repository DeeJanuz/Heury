import type { FileDependency } from '@/domain/models/index.js';
import type { IFileDependencyRepository } from '@/domain/ports/index.js';

export class InMemoryFileDependencyRepository implements IFileDependencyRepository {
  private readonly deps = new Map<string, FileDependency>();

  save(dep: FileDependency): void {
    this.deps.set(dep.id, dep);
  }

  saveBatch(deps: FileDependency[]): void {
    for (const dep of deps) {
      this.save(dep);
    }
  }

  findBySourceFile(sourceFile: string): FileDependency[] {
    return [...this.deps.values()].filter((d) => d.sourceFile === sourceFile);
  }

  findByTargetFile(targetFile: string): FileDependency[] {
    return [...this.deps.values()].filter((d) => d.targetFile === targetFile);
  }

  findAll(): FileDependency[] {
    return [...this.deps.values()];
  }

  deleteBySourceFile(sourceFile: string): void {
    for (const [id, dep] of this.deps) {
      if (dep.sourceFile === sourceFile) {
        this.deps.delete(id);
      }
    }
  }

  clear(): void {
    this.deps.clear();
  }
}
