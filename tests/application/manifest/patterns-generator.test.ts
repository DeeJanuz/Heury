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

  it('should include sections with more entries first when budget is limited', () => {
    // 1 API endpoint (small section)
    codeUnitRepo.save(
      createCodeUnit({
        id: 'unit-api-1',
        filePath: 'src/routes/users.ts',
        name: 'getUsers',
        unitType: CodeUnitType.FUNCTION,
        lineStart: 1,
        lineEnd: 10,
        isAsync: true,
        isExported: true,
        language: 'typescript',
        complexityScore: 5,
        patterns: [
          createCodeUnitPattern({
            codeUnitId: 'unit-api-1',
            patternType: PatternType.API_ENDPOINT,
            patternValue: 'GET /api/users',
          }),
        ],
      }),
    );

    // 5 external services (large section, score=5)
    for (let i = 0; i < 5; i++) {
      codeUnitRepo.save(
        createCodeUnit({
          id: `unit-ext-${i}`,
          filePath: `src/services/ext-${i}.ts`,
          name: `callExt${i}`,
          unitType: CodeUnitType.FUNCTION,
          lineStart: 1,
          lineEnd: 10,
          isAsync: true,
          isExported: true,
          language: 'typescript',
          complexityScore: 3,
          patterns: [
            createCodeUnitPattern({
              codeUnitId: `unit-ext-${i}`,
              patternType: PatternType.EXTERNAL_SERVICE,
              patternValue: `service-${i}.example.com`,
            }),
          ],
        }),
      );
    }

    // Use a budget that fits the header + the larger section but not both sections
    // External Services section has 5 entries (score=5, ~74 tokens), API Endpoints has 1 (score=1, ~16 tokens)
    // Header is ~3 tokens. Budget of 85 fits header + External Services (77) but not both (93).
    // External Services should be included first due to higher score.
    const result = generatePatternsManifest(codeUnitRepo, envVarRepo, 85);

    expect(result).toContain('External Services');
    expect(result).not.toContain('API Endpoints');
  });

  it('should not include partial sections — a section is fully included or fully omitted', () => {
    // Create 10 API endpoints to make a large section
    for (let i = 0; i < 10; i++) {
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

    // Budget too small for all 10 entries but large enough for the header
    const result = generatePatternsManifest(codeUnitRepo, envVarRepo, 20);

    // Either the entire API Endpoints section is present or none of it is
    if (result.includes('## API Endpoints')) {
      // All 10 entries must be present
      for (let i = 0; i < 10; i++) {
        expect(result).toContain(`GET /api/resource-${i}`);
      }
    } else {
      // None of the entries should be present
      for (let i = 0; i < 10; i++) {
        expect(result).not.toContain(`GET /api/resource-${i}`);
      }
    }
  });

  it('should show omission summary when sections are cut', () => {
    // Create a large section that won't fit in a small budget
    for (let i = 0; i < 20; i++) {
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

    const result = generatePatternsManifest(codeUnitRepo, envVarRepo, 20);

    expect(result).toContain('more files available via MCP tools');
  });

  it('should include all sections when budget is sufficient — backward compat', () => {
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
    envVarRepo.save(
      createEnvVariable({
        name: 'DATABASE_URL',
        description: 'Database connection string',
        lineNumber: 1,
      }),
    );

    const result = generatePatternsManifest(codeUnitRepo, envVarRepo, 5000);

    expect(result).toContain('# Patterns');
    expect(result).toContain('## API Endpoints');
    expect(result).toContain('GET /api/users');
    expect(result).toContain('## Database Operations');
    expect(result).toContain('prisma.user.findMany');
    expect(result).toContain('## Environment Variables');
    expect(result).toContain('DATABASE_URL');
    expect(result).not.toContain('more files available via MCP tools');
  });
});
