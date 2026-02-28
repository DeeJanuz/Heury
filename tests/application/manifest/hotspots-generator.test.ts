import { describe, it, expect, beforeEach } from 'vitest';

import { generateHotspotsManifest } from '@/application/manifest/hotspots-generator.js';
import { InMemoryCodeUnitRepository } from '../../helpers/fakes/index.js';
import {
  createCodeUnit,
  createCodeUnitPattern,
  CodeUnitType,
  PatternType,
} from '@/domain/models/index.js';

describe('generateHotspotsManifest', () => {
  let repo: InMemoryCodeUnitRepository;

  beforeEach(() => {
    repo = new InMemoryCodeUnitRepository();
  });

  it('should list most complex functions sorted by score descending', () => {
    repo.save(
      createCodeUnit({
        filePath: 'src/billing/payment.ts',
        name: 'processPayment',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 80,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 45,
      }),
    );
    repo.save(
      createCodeUnit({
        filePath: 'src/inventory/sync.ts',
        name: 'syncInventory',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 60,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 38,
      }),
    );
    repo.save(
      createCodeUnit({
        filePath: 'src/utils.ts',
        name: 'formatDate',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 5,
        isAsync: false,
        isExported: true,
        language: 'typescript',
        complexityScore: 2,
      }),
    );

    const result = generateHotspotsManifest(repo, 5000);

    expect(result).toContain('# Hotspots');
    expect(result).toContain('Most Complex');
    expect(result).toContain('processPayment');
    expect(result).toContain('score: 45');
    expect(result).toContain('syncInventory');
    expect(result).toContain('score: 38');
    // processPayment should come before syncInventory
    expect(result.indexOf('processPayment')).toBeLessThan(
      result.indexOf('syncInventory'),
    );
  });

  it('should show critical paths with 3+ pattern types', () => {
    repo.save(
      createCodeUnit({
        id: 'unit-1',
        filePath: 'src/orders/create.ts',
        name: 'createOrder',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 50,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 25,
        patterns: [
          createCodeUnitPattern({
            codeUnitId: 'unit-1',
            patternType: PatternType.API_ENDPOINT,
            patternValue: 'POST /api/orders',
          }),
          createCodeUnitPattern({
            codeUnitId: 'unit-1',
            patternType: PatternType.DATABASE_WRITE,
            patternValue: 'prisma.order.create',
          }),
          createCodeUnitPattern({
            codeUnitId: 'unit-1',
            patternType: PatternType.EXTERNAL_SERVICE,
            patternValue: 'stripe.checkout',
          }),
        ],
      }),
    );
    // This one has only 2 pattern types - should NOT appear in critical paths
    repo.save(
      createCodeUnit({
        id: 'unit-2',
        filePath: 'src/users/get.ts',
        name: 'getUser',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 20,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 5,
        patterns: [
          createCodeUnitPattern({
            codeUnitId: 'unit-2',
            patternType: PatternType.API_ENDPOINT,
            patternValue: 'GET /api/users/:id',
          }),
          createCodeUnitPattern({
            codeUnitId: 'unit-2',
            patternType: PatternType.DATABASE_READ,
            patternValue: 'prisma.user.findUnique',
          }),
        ],
      }),
    );

    const result = generateHotspotsManifest(repo, 5000);

    expect(result).toContain('Critical Paths');
    expect(result).toContain('createOrder');
    expect(result).toContain('API_ENDPOINT');
    expect(result).toContain('DATABASE_WRITE');
    expect(result).toContain('EXTERNAL_SERVICE');
    // getUser should NOT be in critical paths section
    const criticalSection = result.slice(result.indexOf('Critical Paths'));
    const filesSection = criticalSection.indexOf('Files with Most');
    const criticalContent =
      filesSection > -1
        ? criticalSection.slice(0, filesSection)
        : criticalSection;
    expect(criticalContent).not.toContain('getUser');
  });

  it('should show files with most code units', () => {
    // File with 3 functions
    for (let i = 0; i < 3; i++) {
      repo.save(
        createCodeUnit({
          filePath: 'src/routes/api.ts',
          name: `handler${i}`,
          unitType: CodeUnitType.FUNCTION,
          lineStart: i * 10 + 1,
          lineEnd: i * 10 + 9,
          isAsync: true,
          isExported: true,
          language: 'typescript',
          complexityScore: 5,
        }),
      );
    }
    // File with 1 function
    repo.save(
      createCodeUnit({
        filePath: 'src/utils.ts',
        name: 'helper',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 5,
        isAsync: false,
        isExported: true,
        language: 'typescript',
        complexityScore: 1,
      }),
    );

    const result = generateHotspotsManifest(repo, 5000);

    expect(result).toContain('Files with Most Code Units');
    expect(result).toContain('src/routes/api.ts');
    expect(result).toMatch(/api\.ts.*3/);
  });

  it('should handle empty repository', () => {
    const result = generateHotspotsManifest(repo, 5000);

    expect(result).toContain('# Hotspots');
    // Should not contain any subsection headers
    expect(result).not.toContain('##');
  });

  it('should order sections by priority: complex functions first, then critical paths, then file counts', () => {
    // Add a unit with high complexity AND 3+ patterns so all 3 sections appear
    repo.save(
      createCodeUnit({
        id: 'unit-multi',
        filePath: 'src/core/engine.ts',
        name: 'runEngine',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 100,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 40,
        patterns: [
          createCodeUnitPattern({
            codeUnitId: 'unit-multi',
            patternType: PatternType.API_ENDPOINT,
            patternValue: 'POST /api/run',
          }),
          createCodeUnitPattern({
            codeUnitId: 'unit-multi',
            patternType: PatternType.DATABASE_WRITE,
            patternValue: 'db.write',
          }),
          createCodeUnitPattern({
            codeUnitId: 'unit-multi',
            patternType: PatternType.EXTERNAL_SERVICE,
            patternValue: 'ext.call',
          }),
        ],
      }),
    );

    const result = generateHotspotsManifest(repo, 5000);

    const complexIdx = result.indexOf('## Most Complex Functions');
    const criticalIdx = result.indexOf('## Critical Paths');
    const filesIdx = result.indexOf('## Files with Most Code Units');

    expect(complexIdx).toBeGreaterThan(-1);
    expect(criticalIdx).toBeGreaterThan(-1);
    expect(filesIdx).toBeGreaterThan(-1);
    expect(complexIdx).toBeLessThan(criticalIdx);
    expect(criticalIdx).toBeLessThan(filesIdx);
  });

  it('should include only highest-priority sections when budget is tiny', () => {
    // Create data for all 3 sections
    repo.save(
      createCodeUnit({
        id: 'unit-tight',
        filePath: 'src/core/engine.ts',
        name: 'runEngine',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 100,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 40,
        patterns: [
          createCodeUnitPattern({
            codeUnitId: 'unit-tight',
            patternType: PatternType.API_ENDPOINT,
            patternValue: 'POST /api/run',
          }),
          createCodeUnitPattern({
            codeUnitId: 'unit-tight',
            patternType: PatternType.DATABASE_WRITE,
            patternValue: 'db.write',
          }),
          createCodeUnitPattern({
            codeUnitId: 'unit-tight',
            patternType: PatternType.EXTERNAL_SERVICE,
            patternValue: 'ext.call',
          }),
        ],
      }),
    );

    // Use a budget that fits header + complex functions but not all sections
    // Header "# Hotspots\n" is ~3 tokens. Complex section is small too.
    // We need enough for header + 1 section but not all 3.
    const result = generateHotspotsManifest(repo, 50);

    expect(result).toContain('# Hotspots');
    // Should contain the highest-priority section (complex functions, score=3)
    expect(result).toContain('## Most Complex Functions');
    // Lower-priority sections should be omitted
    // At least one section must be missing
    const hasCritical = result.includes('## Critical Paths');
    const hasFiles = result.includes('## Files with Most Code Units');
    expect(hasCritical && hasFiles).toBe(false);
  });

  it('should not include partial sections', () => {
    // fitSections includes whole sections or omits them entirely
    for (let i = 0; i < 20; i++) {
      repo.save(
        createCodeUnit({
          filePath: `src/modules/mod-${i}.ts`,
          name: `func${i}`,
          unitType: CodeUnitType.FUNCTION,
          lineStart: 1,
          lineEnd: 50,
          isAsync: true,
          isExported: true,
          language: 'typescript',
          complexityScore: 50 - i,
        }),
      );
    }

    const result = generateHotspotsManifest(repo, 50);

    // If "Most Complex Functions" heading appears, all its entries must be present
    if (result.includes('## Most Complex Functions')) {
      // The section should have all 10 entries (MAX_COMPLEX_FUNCTIONS)
      const sectionStart = result.indexOf('## Most Complex Functions');
      const nextSection = result.indexOf('\n##', sectionStart + 1);
      const sectionContent =
        nextSection > -1
          ? result.slice(sectionStart, nextSection)
          : result.slice(sectionStart);
      const entryCount = (sectionContent.match(/^\d+\./gm) ?? []).length;
      expect(entryCount).toBe(10);
    }

    // If "Files with Most Code Units" heading appears, it should have entries
    if (result.includes('## Files with Most Code Units')) {
      const sectionStart = result.indexOf('## Files with Most Code Units');
      const sectionContent = result.slice(sectionStart);
      expect(sectionContent).toContain('units)');
    }
  });

  it('should show omission summary when sections are cut', () => {
    // Create data for all 3 sections
    repo.save(
      createCodeUnit({
        id: 'unit-omit',
        filePath: 'src/core/engine.ts',
        name: 'runEngine',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 100,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 40,
        patterns: [
          createCodeUnitPattern({
            codeUnitId: 'unit-omit',
            patternType: PatternType.API_ENDPOINT,
            patternValue: 'POST /api/run',
          }),
          createCodeUnitPattern({
            codeUnitId: 'unit-omit',
            patternType: PatternType.DATABASE_WRITE,
            patternValue: 'db.write',
          }),
          createCodeUnitPattern({
            codeUnitId: 'unit-omit',
            patternType: PatternType.EXTERNAL_SERVICE,
            patternValue: 'ext.call',
          }),
        ],
      }),
    );

    // Tiny budget so some sections get omitted
    const result = generateHotspotsManifest(repo, 50);

    // If any sections were omitted, we should see the omission summary
    const allSectionsPresent =
      result.includes('## Most Complex Functions') &&
      result.includes('## Critical Paths') &&
      result.includes('## Files with Most Code Units');

    if (!allSectionsPresent) {
      expect(result).toContain('more files available via MCP tools');
    }
  });

  it('should respect token budget', () => {
    for (let i = 0; i < 50; i++) {
      repo.save(
        createCodeUnit({
          filePath: `src/modules/module-${i}.ts`,
          name: `complexFunction${i}`,
          unitType: CodeUnitType.FUNCTION,
          lineStart: 1,
          lineEnd: 100,
          isAsync: true,
          isExported: true,
          language: 'typescript',
          complexityScore: 50 - i,
        }),
      );
    }

    const result = generateHotspotsManifest(repo, 50);
    expect(result.length).toBeLessThan(300);
  });
});
