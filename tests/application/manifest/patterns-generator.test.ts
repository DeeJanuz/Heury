import { describe, it, expect, beforeEach } from 'vitest';

import { generatePatternsManifest } from '@/application/manifest/patterns-generator.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryEnvVariableRepository,
} from '../../helpers/fakes/index.js';
import {
  createCodeUnit,
  createCodeUnitPattern,
  createEnvVariable,
  CodeUnitType,
  PatternType,
} from '@/domain/models/index.js';

describe('generatePatternsManifest', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let envVarRepo: InMemoryEnvVariableRepository;

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    envVarRepo = new InMemoryEnvVariableRepository();
  });

  it('should group patterns by type', () => {
    codeUnitRepo.save(
      createCodeUnit({
        id: 'unit-1',
        filePath: 'src/routes/users.ts',
        name: 'getUsers',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 20,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 5,
        patterns: [
          createCodeUnitPattern({
            codeUnitId: 'unit-1',
            patternType: PatternType.API_ENDPOINT,
            patternValue: 'GET /api/users',
          }),
        ],
      }),
    );
    codeUnitRepo.save(
      createCodeUnit({
        id: 'unit-2',
        filePath: 'src/services/user.ts',
        name: 'findUsers',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 15,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 3,
        patterns: [
          createCodeUnitPattern({
            codeUnitId: 'unit-2',
            patternType: PatternType.DATABASE_READ,
            patternValue: 'prisma.user.findMany',
          }),
        ],
      }),
    );

    const result = generatePatternsManifest(codeUnitRepo, envVarRepo, 5000);

    expect(result).toContain('# Patterns');
    expect(result).toContain('API Endpoints');
    expect(result).toContain('Database');
  });

  it('should show API endpoints with values', () => {
    codeUnitRepo.save(
      createCodeUnit({
        id: 'unit-1',
        filePath: 'src/routes/users.ts',
        name: 'getUsers',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 20,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 5,
        patterns: [
          createCodeUnitPattern({
            codeUnitId: 'unit-1',
            patternType: PatternType.API_ENDPOINT,
            patternValue: 'GET /api/users',
          }),
          createCodeUnitPattern({
            codeUnitId: 'unit-1',
            patternType: PatternType.API_ENDPOINT,
            patternValue: 'POST /api/users',
          }),
        ],
      }),
    );

    const result = generatePatternsManifest(codeUnitRepo, envVarRepo, 5000);

    expect(result).toContain('GET /api/users');
    expect(result).toContain('POST /api/users');
    expect(result).toContain('src/routes/users.ts');
    expect(result).toContain('getUsers');
  });

  it('should show database operations', () => {
    codeUnitRepo.save(
      createCodeUnit({
        id: 'unit-1',
        filePath: 'src/services/user.ts',
        name: 'createUser',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 30,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 10,
        patterns: [
          createCodeUnitPattern({
            codeUnitId: 'unit-1',
            patternType: PatternType.DATABASE_WRITE,
            patternValue: 'prisma.user.create',
          }),
        ],
      }),
    );

    const result = generatePatternsManifest(codeUnitRepo, envVarRepo, 5000);

    expect(result).toContain('Database');
    expect(result).toContain('prisma.user.create');
    expect(result).toContain('createUser');
  });

  it('should show environment variables from env var repo', () => {
    envVarRepo.save(
      createEnvVariable({
        name: 'DATABASE_URL',
        description: 'Database connection string',
        lineNumber: 1,
      }),
    );
    envVarRepo.save(
      createEnvVariable({
        name: 'STRIPE_SECRET_KEY',
        description: 'Stripe API key',
        lineNumber: 2,
      }),
    );

    const result = generatePatternsManifest(codeUnitRepo, envVarRepo, 5000);

    expect(result).toContain('Environment Variables');
    expect(result).toContain('DATABASE_URL');
    expect(result).toContain('Database connection string');
    expect(result).toContain('STRIPE_SECRET_KEY');
  });

  it('should handle no patterns', () => {
    const result = generatePatternsManifest(codeUnitRepo, envVarRepo, 5000);

    expect(result).toContain('# Patterns');
  });

  it('should respect token budget', () => {
    for (let i = 0; i < 50; i++) {
      codeUnitRepo.save(
        createCodeUnit({
          id: `unit-${i}`,
          filePath: `src/routes/route-${i}.ts`,
          name: `handler${i}`,
          unitType: CodeUnitType.FUNCTION,
          lineStart: 1,
          lineEnd: 10,
          isAsync: true,
          isExported: true,
          language: 'typescript',
          complexityScore: 5,
          patterns: [
            createCodeUnitPattern({
              codeUnitId: `unit-${i}`,
              patternType: PatternType.API_ENDPOINT,
              patternValue: `GET /api/resource-${i}`,
            }),
          ],
        }),
      );
    }

    const result = generatePatternsManifest(codeUnitRepo, envVarRepo, 50);
    expect(result.length).toBeLessThan(300);
  });
});
