import { describe, it, expect, beforeEach } from 'vitest';

import { generateModulesManifest } from '@/application/manifest/modules-generator.js';
import { InMemoryCodeUnitRepository } from '../../helpers/fakes/index.js';
import {
  createCodeUnit,
  createCodeUnitPattern,
  CodeUnitType,
  PatternType,
} from '@/domain/models/index.js';

describe('generateModulesManifest', () => {
  let repo: InMemoryCodeUnitRepository;

  beforeEach(() => {
    repo = new InMemoryCodeUnitRepository();
  });

  it('should generate markdown with file groupings', () => {
    repo.save(
      createCodeUnit({
        filePath: 'src/auth/login.ts',
        name: 'login',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 20,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 12,
      }),
    );
    repo.save(
      createCodeUnit({
        filePath: 'src/users/service.ts',
        name: 'getUser',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 10,
        isAsync: false,
        isExported: true,
        language: 'typescript',
        complexityScore: 5,
      }),
    );

    const result = generateModulesManifest(repo, 5000);

    expect(result).toContain('# Modules');
    expect(result).toContain('## src/auth/login.ts');
    expect(result).toContain('## src/users/service.ts');
    // auth should come before users (alphabetical)
    expect(result.indexOf('src/auth')).toBeLessThan(result.indexOf('src/users'));
  });

  it('should list code units with type and complexity', () => {
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
        complexityScore: 3,
      }),
    );
    repo.save(
      createCodeUnit({
        filePath: 'src/utils.ts',
        name: 'fetchData',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 10,
        lineEnd: 25,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 8,
      }),
    );

    const result = generateModulesManifest(repo, 5000);

    expect(result).toContain('formatDate');
    expect(result).toContain('function');
    expect(result).toContain('complexity: 3');
    expect(result).toContain('fetchData');
    expect(result).toContain('async');
    expect(result).toContain('complexity: 8');
  });

  it('should show methods as children of classes', () => {
    const classUnit = createCodeUnit({
      id: 'class-1',
      filePath: 'src/services/user.ts',
      name: 'UserService',
      unitType: CodeUnitType.CLASS,
      lineStart: 1,
      lineEnd: 50,
      isAsync: false,
      isExported: true,
      language: 'typescript',
      complexityScore: 0,
    });
    const methodUnit = createCodeUnit({
      filePath: 'src/services/user.ts',
      name: 'getUser',
      unitType: CodeUnitType.METHOD,
      lineStart: 5,
      lineEnd: 15,
      parentUnitId: 'class-1',
      isAsync: true,
      isExported: false,
      language: 'typescript',
      complexityScore: 8,
    });

    repo.save(classUnit);
    repo.save(methodUnit);

    const result = generateModulesManifest(repo, 5000);

    expect(result).toContain('`UserService` - class');
    expect(result).toContain('`getUser`');
    // Method should be indented under class
    const classLine = result.split('\n').find((l) => l.includes('UserService'));
    const methodLine = result.split('\n').find((l) => l.includes('getUser'));
    expect(classLine).toBeDefined();
    expect(methodLine).toBeDefined();
    // Method line should have more indentation
    const classIndent = classLine!.search(/\S/);
    const methodIndent = methodLine!.search(/\S/);
    expect(methodIndent).toBeGreaterThan(classIndent);
  });

  it('should format TYPE_ALIAS units as "type"', () => {
    repo.save(
      createCodeUnit({
        filePath: 'src/types.ts',
        name: 'UserID',
        unitType: CodeUnitType.TYPE_ALIAS,
        lineStart: 1,
        lineEnd: 1,
        isAsync: false,
        isExported: true,
        language: 'typescript',
        complexityScore: 0,
        signature: 'string | number',
      }),
    );

    const result = generateModulesManifest(repo, 5000);

    expect(result).toContain('`UserID` - type');
    expect(result).toContain('string | number');
  });

  it('should handle empty repository', () => {
    const result = generateModulesManifest(repo, 5000);

    expect(result).toContain('# Modules');
    expect(result.split('\n').filter((l) => l.trim()).length).toBeLessThanOrEqual(2);
  });

  it('should summarize patterns per file', () => {
    const unit = createCodeUnit({
      id: 'unit-1',
      filePath: 'src/api/routes.ts',
      name: 'getUsers',
      unitType: CodeUnitType.FUNCTION,
      lineStart: 1,
      lineEnd: 20,
      isAsync: true,
      isExported: true,
      language: 'typescript',
      complexityScore: 10,
      patterns: [
        createCodeUnitPattern({
          codeUnitId: 'unit-1',
          patternType: PatternType.API_ENDPOINT,
          patternValue: 'GET /api/users',
        }),
        createCodeUnitPattern({
          codeUnitId: 'unit-1',
          patternType: PatternType.DATABASE_READ,
          patternValue: 'prisma.user.findMany',
        }),
      ],
    });
    repo.save(unit);

    const result = generateModulesManifest(repo, 5000);

    expect(result).toContain('API_ENDPOINT');
    expect(result).toContain('DATABASE_READ');
  });

  it('should include signature for exported units that have signatures', () => {
    repo.save(
      createCodeUnit({
        filePath: 'src/api/handler.ts',
        name: 'fetchUser',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 20,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 5,
        signature: '(userId: string): Promise<User>',
      }),
    );

    const result = generateModulesManifest(repo, 5000);

    expect(result).toContain(
      '`fetchUser` - async function(userId: string): Promise<User>, complexity: 5',
    );
  });

  it('should not include signature for non-exported units even if they have one', () => {
    repo.save(
      createCodeUnit({
        filePath: 'src/internal/helper.ts',
        name: 'internalHelper',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 10,
        isAsync: false,
        isExported: false,
        language: 'typescript',
        complexityScore: 2,
        signature: '(x: number): number',
      }),
    );

    const result = generateModulesManifest(repo, 5000);

    expect(result).toContain('`internalHelper` - function, complexity: 2');
    expect(result).not.toContain('(x: number): number');
  });

  it('should handle exported units with no signature gracefully', () => {
    repo.save(
      createCodeUnit({
        filePath: 'src/config.ts',
        name: 'AppConfig',
        unitType: CodeUnitType.CLASS,
        lineStart: 1,
        lineEnd: 30,
        isAsync: false,
        isExported: true,
        language: 'typescript',
        complexityScore: 0,
      }),
    );

    const result = generateModulesManifest(repo, 5000);

    expect(result).toContain('`AppConfig` - class');
    expect(result).not.toContain('undefined');
  });

  it('should respect token budget', () => {
    // Add many code units to exceed a small budget
    for (let i = 0; i < 50; i++) {
      repo.save(
        createCodeUnit({
          filePath: `src/modules/module-${i}.ts`,
          name: `function${i}`,
          unitType: CodeUnitType.FUNCTION,
          lineStart: 1,
          lineEnd: 10,
          isAsync: false,
          isExported: true,
          language: 'typescript',
          complexityScore: i,
        }),
      );
    }

    const result = generateModulesManifest(repo, 50); // very small budget
    // Result should be truncated
    expect(result.length).toBeLessThan(300); // 50 tokens * ~4 chars + some buffer
  });
});
