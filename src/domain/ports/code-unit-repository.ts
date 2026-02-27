import type { CodeUnit, CodeUnitType } from '@/domain/models/index.js';

export interface ICodeUnitRepository {
  save(unit: CodeUnit): void;
  saveBatch(units: CodeUnit[]): void;
  findById(id: string): CodeUnit | undefined;
  findByFilePath(filePath: string): CodeUnit[];
  findByType(unitType: CodeUnitType): CodeUnit[];
  findByLanguage(language: string): CodeUnit[];
  findAll(): CodeUnit[];
  deleteByFilePath(filePath: string): void;
  clear(): void;
}
