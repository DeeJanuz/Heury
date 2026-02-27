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
