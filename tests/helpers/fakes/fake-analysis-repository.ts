import type { AnalysisResult } from '@/domain/models/index.js';
import type { IAnalysisRepository } from '@/domain/ports/index.js';

export class InMemoryAnalysisRepository implements IAnalysisRepository {
  private results: AnalysisResult[] = [];

  saveResult(result: AnalysisResult): void {
    this.results.push(result);
  }

  getLatestResult(): AnalysisResult | undefined {
    return this.results.length > 0 ? this.results[this.results.length - 1] : undefined;
  }

  clear(): void {
    this.results = [];
  }
}
