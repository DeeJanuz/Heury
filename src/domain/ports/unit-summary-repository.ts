import type { UnitSummary } from '@/domain/models/index.js';

export interface IUnitSummaryRepository {
  save(summary: UnitSummary): void;
  saveBatch(summaries: UnitSummary[]): void;
  findByCodeUnitId(codeUnitId: string): UnitSummary | undefined;
  findAll(): UnitSummary[];
  deleteByCodeUnitId(codeUnitId: string): void;
  clear(): void;
}
