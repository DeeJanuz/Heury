/**
 * Composition root - wires together all dependencies.
 *
 * For now (pre-Phase 6), uses in-memory repository implementations.
 * Phase 6 will replace these with SQLite-backed repositories.
 */

import type { AnalysisDependencies } from '@/application/index.js';
import type {
  ICodeUnitRepository,
  IFileDependencyRepository,
  IEnvVariableRepository,
  IFileSystem,
} from '@/domain/ports/index.js';
import type {
  CodeUnit,
  CodeUnitType,
  FileDependency,
  RepositoryEnvVariable,
} from '@/domain/models/index.js';
import { createLanguageRegistry } from '@/extraction/index.js';

export interface CompositionResult {
  readonly dependencies: AnalysisDependencies;
}

/**
 * Simple in-memory code unit repository (placeholder until Phase 6).
 */
class InMemoryCodeUnitRepo implements ICodeUnitRepository {
  private readonly units: CodeUnit[] = [];

  save(unit: CodeUnit): void {
    this.units.push(unit);
  }

  saveBatch(units: CodeUnit[]): void {
    this.units.push(...units);
  }

  findById(id: string): CodeUnit | undefined {
    return this.units.find((u) => u.id === id);
  }

  findByFilePath(filePath: string): CodeUnit[] {
    return this.units.filter((u) => u.filePath === filePath);
  }

  findByType(unitType: CodeUnitType): CodeUnit[] {
    return this.units.filter((u) => u.unitType === unitType);
  }

  findByLanguage(language: string): CodeUnit[] {
    return this.units.filter((u) => u.language === language);
  }

  findAll(): CodeUnit[] {
    return [...this.units];
  }

  deleteByFilePath(filePath: string): void {
    for (let i = this.units.length - 1; i >= 0; i--) {
      if (this.units[i].filePath === filePath) {
        this.units.splice(i, 1);
      }
    }
  }

  clear(): void {
    this.units.length = 0;
  }
}

/**
 * Simple in-memory file dependency repository (placeholder until Phase 6).
 */
class InMemoryDependencyRepo implements IFileDependencyRepository {
  private readonly deps: FileDependency[] = [];

  save(dep: FileDependency): void {
    this.deps.push(dep);
  }

  saveBatch(deps: FileDependency[]): void {
    this.deps.push(...deps);
  }

  findBySourceFile(sourceFile: string): FileDependency[] {
    return this.deps.filter((d) => d.sourceFile === sourceFile);
  }

  findByTargetFile(targetFile: string): FileDependency[] {
    return this.deps.filter((d) => d.targetFile === targetFile);
  }

  findAll(): FileDependency[] {
    return [...this.deps];
  }

  deleteBySourceFile(sourceFile: string): void {
    for (let i = this.deps.length - 1; i >= 0; i--) {
      if (this.deps[i].sourceFile === sourceFile) {
        this.deps.splice(i, 1);
      }
    }
  }

  clear(): void {
    this.deps.length = 0;
  }
}

/**
 * Simple in-memory env variable repository (placeholder until Phase 6).
 */
class InMemoryEnvVarRepo implements IEnvVariableRepository {
  private readonly vars: RepositoryEnvVariable[] = [];

  save(envVar: RepositoryEnvVariable): void {
    this.vars.push(envVar);
  }

  saveBatch(envVars: RepositoryEnvVariable[]): void {
    this.vars.push(...envVars);
  }

  findByName(name: string): RepositoryEnvVariable | undefined {
    return this.vars.find((v) => v.name === name);
  }

  findAll(): RepositoryEnvVariable[] {
    return [...this.vars];
  }

  clear(): void {
    this.vars.length = 0;
  }
}

export async function createCompositionRoot(
  fileSystem: IFileSystem,
): Promise<CompositionResult> {
  const dependencies: AnalysisDependencies = {
    codeUnitRepo: new InMemoryCodeUnitRepo(),
    dependencyRepo: new InMemoryDependencyRepo(),
    envVarRepo: new InMemoryEnvVarRepo(),
    fileSystem,
    languageRegistry: createLanguageRegistry(),
  };

  return { dependencies };
}
