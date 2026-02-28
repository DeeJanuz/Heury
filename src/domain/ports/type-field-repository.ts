import type { TypeField } from '@/domain/models/index.js';

export interface ITypeFieldRepository {
  save(field: TypeField): void;
  saveBatch(fields: TypeField[]): void;
  findByParentUnitId(parentUnitId: string): TypeField[];
  findAll(): TypeField[];
  deleteByParentUnitId(parentUnitId: string): void;
  clear(): void;
}
