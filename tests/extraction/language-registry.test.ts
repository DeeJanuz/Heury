import { describe, it, expect, beforeEach } from 'vitest';
import { LanguageRegistry, type LanguageExtractor } from '@/extraction/language-registry.js';
import type {
  CodeUnitDeclaration,
  FileDependencyInfo,
  PatternRuleSet,
  LanguageComplexityPatterns,
} from '@/extraction/types.js';

function createMockExtractor(overrides: Partial<LanguageExtractor> = {}): LanguageExtractor {
  return {
    languageId: 'test-lang',
    extensions: ['.test'],
    extractCodeUnits: () => [],
    extractDependencies: () => [],
    getPatternRules: () => ({
      apiEndpoints: [],
      apiCalls: [],
      databaseReads: [],
      databaseWrites: [],
      externalServices: [],
      envVariables: [],
    }),
    getComplexityPatterns: () => ({
      conditionals: [],
      loops: [],
      errorHandling: [],
      asyncPatterns: [],
    }),
    getSkipDirectories: () => [],
    getTestFilePatterns: () => [],
    ...overrides,
  };
}

describe('LanguageRegistry', () => {
  let registry: LanguageRegistry;

  beforeEach(() => {
    registry = new LanguageRegistry();
  });

  it('should register an extractor and retrieve it by file path', () => {
    const extractor = createMockExtractor({
      languageId: 'javascript-typescript',
      extensions: ['.ts', '.js'],
    });
    registry.register(extractor);

    const result = registry.getExtractorForFile('src/index.ts');
    expect(result).toBe(extractor);
  });

  it('should return undefined for unknown extension', () => {
    const extractor = createMockExtractor({
      extensions: ['.ts'],
    });
    registry.register(extractor);

    const result = registry.getExtractorForFile('main.py');
    expect(result).toBeUndefined();
  });

  it('should return undefined for file without extension', () => {
    const result = registry.getExtractorForFile('Makefile');
    expect(result).toBeUndefined();
  });

  it('should list all supported extensions', () => {
    const extractor = createMockExtractor({
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    });
    registry.register(extractor);

    const extensions = registry.getSupportedExtensions();
    expect(extensions).toContain('.ts');
    expect(extensions).toContain('.tsx');
    expect(extensions).toContain('.js');
    expect(extensions).toContain('.jsx');
    expect(extensions).toHaveLength(4);
  });

  it('should list all registered languages', () => {
    const jsExtractor = createMockExtractor({
      languageId: 'javascript-typescript',
      extensions: ['.ts', '.js'],
    });
    const pyExtractor = createMockExtractor({
      languageId: 'python',
      extensions: ['.py'],
    });
    registry.register(jsExtractor);
    registry.register(pyExtractor);

    const languages = registry.getRegisteredLanguages();
    expect(languages).toContain('javascript-typescript');
    expect(languages).toContain('python');
    expect(languages).toHaveLength(2);
  });

  it('should combine universal and language-specific skip directories', () => {
    const extractor = createMockExtractor({
      getSkipDirectories: () => ['node_modules', '.next'],
    });
    registry.register(extractor);

    const dirs = registry.getAllSkipDirectories();
    // Universal dirs
    expect(dirs).toContain('.git');
    expect(dirs).toContain('dist');
    expect(dirs).toContain('build');
    // Language-specific dirs
    expect(dirs).toContain('node_modules');
    expect(dirs).toContain('.next');
  });

  it('should detect test files using registered patterns', () => {
    const extractor = createMockExtractor({
      extensions: ['.ts'],
      getTestFilePatterns: () => [/\.test\.ts$/, /\.spec\.ts$/],
    });
    registry.register(extractor);

    expect(registry.isTestFile('src/foo.test.ts')).toBe(true);
    expect(registry.isTestFile('src/foo.spec.ts')).toBe(true);
    expect(registry.isTestFile('src/foo.ts')).toBe(false);
  });

  it('should handle multiple extractors with different extensions', () => {
    const jsExtractor = createMockExtractor({
      languageId: 'javascript-typescript',
      extensions: ['.ts', '.js'],
    });
    const pyExtractor = createMockExtractor({
      languageId: 'python',
      extensions: ['.py'],
    });
    registry.register(jsExtractor);
    registry.register(pyExtractor);

    expect(registry.getExtractorForFile('src/index.ts')).toBe(jsExtractor);
    expect(registry.getExtractorForFile('main.py')).toBe(pyExtractor);
  });
});
