/**
 * Application layer barrel export.
 */

export { shouldProcessFile, type FileFilterOptions } from './file-filter.js';
export { detectModuleLevelPatterns } from './module-level-detector.js';
export { processFile, type FileProcessingResult } from './file-processor.js';
export {
  AnalysisOrchestrator,
  type AnalysisOptions,
  type AnalysisDependencies,
} from './analysis-orchestrator.js';
export {
  processDeepAnalysis,
  type DeepAnalysisDependencies,
  type DeepAnalysisResult,
} from './deep-analysis-processor.js';
export {
  estimateTokens,
  allocateBudget,
  truncateToTokenBudget,
  generateModulesManifest,
  generatePatternsManifest,
  generateDependenciesManifest,
  generateHotspotsManifest,
  generateSchemaManifest,
  generateManifests,
  type TokenBudget,
  type ManifestDependencies,
  type ManifestOptions,
} from './manifest/index.js';
