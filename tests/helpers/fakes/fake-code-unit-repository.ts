import type { CodeUnit, CodeUnitType } from '@/domain/models/index.js';
import type { ICodeUnitRepository } from '@/domain/ports/index.js';

export class InMemoryCodeUnitRepository implements ICodeUnitRepository {
  private readonly units = new Map<string, CodeUnit>();

  save(unit: CodeUnit): void {
    this.units.set(unit.id, unit);
  }

  saveBatch(units: CodeUnit[]): void {
    for (const unit of units) {
      this.save(unit);
    }
  }

  findById(id: string): CodeUnit | undefined {
    return this.units.get(id);
  }

  findByFilePath(filePath: string): CodeUnit[] {
    return [...this.units.values()].filter((u) => u.filePath === filePath);
  }

  findByType(unitType: CodeUnitType): CodeUnit[] {
    return [...this.units.values()].filter((u) => u.unitType === unitType);
  }

  findByLanguage(language: string): CodeUnit[] {
    return [...this.units.values()].filter((u) => u.language === language);
  }

  findAll(): CodeUnit[] {
    return [...this.units.values()];
  }

  findAllFlat(): CodeUnit[] {
    return [...this.units.values()].map((u) => ({ ...u, children: [] }));
  }

  deleteByFilePath(filePath: string): void {
    for (const [id, unit] of this.units) {
      if (unit.filePath === filePath) {
        this.units.delete(id);
      }
    }
  }

  clear(): void {
    this.units.clear();
  }
}
