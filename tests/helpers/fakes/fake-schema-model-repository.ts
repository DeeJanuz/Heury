import type { SchemaModel } from '@/domain/models/index.js';
import type { ISchemaModelRepository } from '@/domain/ports/index.js';

export class InMemorySchemaModelRepository implements ISchemaModelRepository {
  private readonly models = new Map<string, SchemaModel>();

  save(model: SchemaModel): void {
    this.models.set(model.id, model);
  }

  saveBatch(models: SchemaModel[]): void {
    for (const model of models) {
      this.save(model);
    }
  }

  findById(id: string): SchemaModel | undefined {
    return this.models.get(id);
  }

  findByName(name: string): SchemaModel | undefined {
    return [...this.models.values()].find((m) => m.name === name);
  }

  findByFilePath(filePath: string): SchemaModel[] {
    return [...this.models.values()].filter((m) => m.filePath === filePath);
  }

  findByFramework(framework: string): SchemaModel[] {
    return [...this.models.values()].filter((m) => m.framework === framework);
  }

  findAll(): SchemaModel[] {
    return [...this.models.values()];
  }

  deleteByFilePath(filePath: string): void {
    for (const [id, model] of this.models) {
      if (model.filePath === filePath) {
        this.models.delete(id);
      }
    }
  }

  clear(): void {
    this.models.clear();
  }
}
