import type { AnalysisResult } from '@/domain/models/index.js';

export interface IAnalysisRepository {
  saveResult(result: AnalysisResult): void;
  getLatestResult(): AnalysisResult | undefined;
  clear(): void;
}
