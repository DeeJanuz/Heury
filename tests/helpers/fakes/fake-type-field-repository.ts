import type { TypeField } from '@/domain/models/index.js';
import type { ITypeFieldRepository } from '@/domain/ports/index.js';

export class InMemoryTypeFieldRepository implements ITypeFieldRepository {
  private readonly fields = new Map<string, TypeField>();

  save(field: TypeField): void {
    this.fields.set(field.id, field);
  }

  saveBatch(fields: TypeField[]): void {
    for (const field of fields) {
      this.save(field);
    }
  }

  findByParentUnitId(parentUnitId: string): TypeField[] {
    return [...this.fields.values()].filter((f) => f.parentUnitId === parentUnitId);
  }

  findAll(): TypeField[] {
    return [...this.fields.values()];
  }

  deleteByParentUnitId(parentUnitId: string): void {
    for (const [id, field] of this.fields) {
      if (field.parentUnitId === parentUnitId) {
        this.fields.delete(id);
      }
    }
  }

  clear(): void {
    this.fields.clear();
  }
}
