import type { UnitSummary } from '@/domain/models/index.js';
import type { IUnitSummaryRepository } from '@/domain/ports/index.js';

export class InMemoryUnitSummaryRepository implements IUnitSummaryRepository {
  private readonly summaries = new Map<string, UnitSummary>();

  save(summary: UnitSummary): void {
    this.summaries.set(summary.id, summary);
  }

  saveBatch(summaries: UnitSummary[]): void {
    for (const summary of summaries) {
      this.save(summary);
    }
  }

  findByCodeUnitId(codeUnitId: string): UnitSummary | undefined {
    return [...this.summaries.values()].find((s) => s.codeUnitId === codeUnitId);
  }

  findAll(): UnitSummary[] {
    return [...this.summaries.values()];
  }

  deleteByCodeUnitId(codeUnitId: string): void {
    for (const [id, summary] of this.summaries) {
      if (summary.codeUnitId === codeUnitId) {
        this.summaries.delete(id);
      }
    }
  }

  clear(): void {
    this.summaries.clear();
  }
}
