/**
 * Language Registry
 *
 * Provides the interface and registry for multi-language code analysis.
 * Each language extractor implements the LanguageExtractor interface,
 * and the LanguageRegistry maps file extensions to the appropriate extractor.
 *
 * This enables plugging in extractors for Python, Go, Java, Rust, C#, etc.
 * while preserving all existing JS/TS behavior.
 */

import type {
  CodeUnitDeclaration,
  FileDependencyInfo,
  PatternRuleSet,
  LanguageComplexityPatterns,
} from './types.js';

/**
 * Interface that each language extractor must implement.
 */
export interface LanguageExtractor {
  readonly languageId: string;
  readonly extensions: string[];

  extractCodeUnits(content: string, filePath: string): CodeUnitDeclaration[];
  extractDependencies(content: string, filePath: string): FileDependencyInfo[];
  getPatternRules(): PatternRuleSet;
  getComplexityPatterns(): LanguageComplexityPatterns;
  getSkipDirectories(): string[];
  getTestFilePatterns(): RegExp[];
}

/**
 * Universal directories that are always skipped regardless of language.
 */
const UNIVERSAL_SKIP_DIRECTORIES = [
  '.git',
  'dist',
  'build',
  '.cache',
  '__pycache__',
  'vendor',
];

/**
 * Registry that maps file extensions to language extractors.
 * Uses a Map internally keyed by file extension for O(1) lookup.
 */
export class LanguageRegistry {
  private readonly extensionMap = new Map<string, LanguageExtractor>();
  private readonly extractors = new Map<string, LanguageExtractor>();

  /**
   * Register a language extractor. Maps all its extensions for lookup.
   */
  register(extractor: LanguageExtractor): void {
    this.extractors.set(extractor.languageId, extractor);
    for (const ext of extractor.extensions) {
      this.extensionMap.set(ext, extractor);
    }
  }

  /**
   * Get the appropriate extractor for a file path based on its extension.
   */
  getExtractorForFile(filePath: string): LanguageExtractor | undefined {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1) return undefined;
    const ext = filePath.slice(lastDot);
    return this.extensionMap.get(ext);
  }

  /**
   * Get all file extensions that have registered extractors.
   */
  getSupportedExtensions(): string[] {
    return [...this.extensionMap.keys()];
  }

  /**
   * Get all registered language IDs.
   */
  getRegisteredLanguages(): string[] {
    return [...this.extractors.keys()];
  }

  /**
   * Get all directories that should be skipped during analysis.
   * Combines universal skip directories with language-specific ones.
   */
  getAllSkipDirectories(): string[] {
    const dirs = new Set<string>();
    for (const d of UNIVERSAL_SKIP_DIRECTORIES) {
      dirs.add(d);
    }
    for (const extractor of this.extractors.values()) {
      for (const d of extractor.getSkipDirectories()) {
        dirs.add(d);
      }
    }
    return [...dirs];
  }

  /**
   * Check if a file path matches test file patterns for its language.
   */
  isTestFile(filePath: string): boolean {
    for (const extractor of this.extractors.values()) {
      if (extractor.extensions.some(ext => filePath.endsWith(ext))) {
        return extractor.getTestFilePatterns().some(pattern => pattern.test(filePath));
      }
    }
    return false;
  }
}
