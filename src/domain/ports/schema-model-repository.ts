import type { SchemaModel } from '@/domain/models/index.js';

export interface ISchemaModelRepository {
  save(model: SchemaModel): void;
  saveBatch(models: SchemaModel[]): void;
  findById(id: string): SchemaModel | undefined;
  findByName(name: string): SchemaModel | undefined;
  findByFilePath(filePath: string): SchemaModel[];
  findByFramework(framework: string): SchemaModel[];
  findAll(): SchemaModel[];
  deleteByFilePath(filePath: string): void;
  clear(): void;
}
