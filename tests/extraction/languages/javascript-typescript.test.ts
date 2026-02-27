import { describe, it, expect } from 'vitest';
import { PatternType, CodeUnitType } from '@/domain/models/index.js';
import { JavaScriptTypeScriptExtractor } from '@/extraction/languages/javascript-typescript.js';

describe('JavaScriptTypeScriptExtractor', () => {
  const extractor = new JavaScriptTypeScriptExtractor();

  it('should have correct languageId', () => {
    expect(extractor.languageId).toBe('javascript-typescript');
  });

  it('should have correct extensions', () => {
    expect(extractor.extensions).toContain('.js');
    expect(extractor.extensions).toContain('.jsx');
    expect(extractor.extensions).toContain('.ts');
    expect(extractor.extensions).toContain('.tsx');
    expect(extractor.extensions).toContain('.mjs');
    expect(extractor.extensions).toContain('.cjs');
  });

  it('should delegate extractCodeUnits to function-extractor', () => {
    const code = 'export function hello() {\n  return "world";\n}';
    const units = extractor.extractCodeUnits(code, 'test.ts');
    expect(units).toHaveLength(1);
    expect(units[0].name).toBe('hello');
    expect(units[0].unitType).toBe(CodeUnitType.FUNCTION);
    expect(units[0].isExported).toBe(true);
  });

  it('should return empty array for extractDependencies (stubbed)', () => {
    const deps = extractor.extractDependencies('import x from "y"', 'test.ts');
    expect(deps).toEqual([]);
  });

  describe('getPatternRules', () => {
    it('should include Express endpoint patterns', () => {
      const rules = extractor.getPatternRules();
      expect(rules.apiEndpoints.length).toBeGreaterThan(0);

      // Test Express pattern detection
      const expressRule = rules.apiEndpoints[0];
      const code = "app.get('/users', handler)";
      const regex = new RegExp(expressRule.pattern.source, expressRule.pattern.flags);
      const match = regex.exec(code);
      expect(match).not.toBeNull();
      expect(expressRule.patternType).toBe(PatternType.API_ENDPOINT);
    });

    it('should include Prisma database read patterns', () => {
      const rules = extractor.getPatternRules();
      expect(rules.databaseReads.length).toBeGreaterThan(0);

      const prismaRule = rules.databaseReads[0];
      const code = 'prisma.user.findMany({ where: {} })';
      const regex = new RegExp(prismaRule.pattern.source, prismaRule.pattern.flags);
      const match = regex.exec(code);
      expect(match).not.toBeNull();
      expect(prismaRule.patternType).toBe(PatternType.DATABASE_READ);
    });

    it('should include Prisma database write patterns', () => {
      const rules = extractor.getPatternRules();
      expect(rules.databaseWrites.length).toBeGreaterThan(0);

      const prismaRule = rules.databaseWrites[0];
      const code = 'prisma.user.create({ data: { name: "test" } })';
      const regex = new RegExp(prismaRule.pattern.source, prismaRule.pattern.flags);
      const match = regex.exec(code);
      expect(match).not.toBeNull();
      expect(prismaRule.patternType).toBe(PatternType.DATABASE_WRITE);
    });

    it('should include env variable patterns', () => {
      const rules = extractor.getPatternRules();
      expect(rules.envVariables.length).toBeGreaterThan(0);

      const envRule = rules.envVariables[0];
      const code = 'const key = process.env.API_KEY';
      const regex = new RegExp(envRule.pattern.source, envRule.pattern.flags);
      const match = regex.exec(code);
      expect(match).not.toBeNull();
      expect(envRule.patternType).toBe(PatternType.ENV_VARIABLE);
    });

    it('should include external service patterns', () => {
      const rules = extractor.getPatternRules();
      expect(rules.externalServices.length).toBeGreaterThan(0);
    });

    it('should include API call patterns', () => {
      const rules = extractor.getPatternRules();
      expect(rules.apiCalls.length).toBeGreaterThan(0);
    });
  });

  describe('getComplexityPatterns', () => {
    it('should provide conditional patterns', () => {
      const patterns = extractor.getComplexityPatterns();
      expect(patterns.conditionals.length).toBeGreaterThan(0);
    });

    it('should provide loop patterns', () => {
      const patterns = extractor.getComplexityPatterns();
      expect(patterns.loops.length).toBeGreaterThan(0);
    });

    it('should provide error handling patterns', () => {
      const patterns = extractor.getComplexityPatterns();
      expect(patterns.errorHandling.length).toBeGreaterThan(0);
    });

    it('should provide async patterns', () => {
      const patterns = extractor.getComplexityPatterns();
      expect(patterns.asyncPatterns.length).toBeGreaterThan(0);
    });
  });

  it('should provide skip directories including node_modules', () => {
    const dirs = extractor.getSkipDirectories();
    expect(dirs).toContain('node_modules');
    expect(dirs).toContain('.next');
    expect(dirs).toContain('coverage');
  });

  it('should provide test file patterns', () => {
    const patterns = extractor.getTestFilePatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.test('foo.test.ts'))).toBe(true);
    expect(patterns.some(p => p.test('foo.spec.ts'))).toBe(true);
  });
});
