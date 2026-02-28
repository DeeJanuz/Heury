import { describe, it, expect, beforeEach } from 'vitest';
import { createFindImplementationPatternTool } from '@/adapters/mcp/tools/find-implementation-pattern.js';
import {
  InMemoryPatternTemplateRepository,
  InMemoryCodeUnitRepository,
} from '../../../../tests/helpers/fakes/index.js';
import { createPatternTemplate, createPatternTemplateFollower } from '@/domain/models/index.js';
import { createCodeUnit, CodeUnitType } from '@/domain/models/index.js';

describe('find-implementation-pattern tool', () => {
  let patternTemplateRepo: InMemoryPatternTemplateRepository;
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let handler: ReturnType<typeof createFindImplementationPatternTool>['handler'];
  let definition: ReturnType<typeof createFindImplementationPatternTool>['definition'];

  const templateUnitId = 'unit-1';
  const templateId = 'tmpl-1';

  beforeEach(() => {
    patternTemplateRepo = new InMemoryPatternTemplateRepository();
    codeUnitRepo = new InMemoryCodeUnitRepository();
    const tool = createFindImplementationPatternTool({
      patternTemplateRepo,
      codeUnitRepo,
    });
    handler = tool.handler;
    definition = tool.definition;

    // Seed a code unit for the template
    codeUnitRepo.save(
      createCodeUnit({
        id: templateUnitId,
        filePath: 'src/services/user-service.ts',
        name: 'UserService',
        unitType: CodeUnitType.CLASS,
        lineStart: 10,
        lineEnd: 80,
        signature: 'class UserService implements IUserService',
        isAsync: false,
        isExported: true,
        language: 'typescript',
      }),
    );

    // Seed a pattern template with followers
    const template = createPatternTemplate({
      id: templateId,
      name: 'Service Layer Pattern',
      description: 'Standard service layer with dependency injection and error handling',
      patternTypes: ['SERVICE', 'DEPENDENCY_INJECTION'],
      templateUnitId,
      templateFilePath: 'src/services/user-service.ts',
      followerCount: 3,
      conventions: ['Use constructor injection', 'Return Result types for errors', 'Keep methods focused'],
    });

    const followers = [
      createPatternTemplateFollower({ templateId, filePath: 'src/services/order-service.ts', unitName: 'OrderService' }),
      createPatternTemplateFollower({ templateId, filePath: 'src/services/payment-service.ts', unitName: 'PaymentService' }),
      createPatternTemplateFollower({ templateId, filePath: 'src/services/notification-service.ts', unitName: 'NotificationService' }),
    ];

    patternTemplateRepo.save(template, followers);
  });

  it('should have correct tool definition', () => {
    expect(definition.name).toBe('find-implementation-pattern');
    expect(definition.description).toContain('pattern');
    expect(definition.inputSchema).toEqual({
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: expect.any(String),
        },
        pattern_type: {
          type: 'string',
          description: expect.any(String),
        },
      },
      required: ['query'],
    });
  });

  it('should return error when query is missing', async () => {
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('query');
  });

  it('should return error when no matching pattern found', async () => {
    const result = await handler({ query: 'nonexistent-xyz-pattern' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No matching pattern found');
  });

  it('should find pattern by exact name match', async () => {
    const result = await handler({ query: 'Service Layer Pattern' });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.template.name).toBe('Service Layer Pattern');
  });

  it('should find pattern by partial name match (case-insensitive)', async () => {
    const result = await handler({ query: 'service layer' });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.template.name).toBe('Service Layer Pattern');
  });

  it('should find pattern by convention text match', async () => {
    const result = await handler({ query: 'constructor injection' });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.template.name).toBe('Service Layer Pattern');
  });

  it('should find pattern with pattern_type filter', async () => {
    // Add a second template with different pattern type
    const otherUnit = createCodeUnit({
      id: 'unit-2',
      filePath: 'src/controllers/user-controller.ts',
      name: 'UserController',
      unitType: CodeUnitType.CLASS,
      lineStart: 1,
      lineEnd: 50,
      isAsync: false,
      isExported: true,
      language: 'typescript',
    });
    codeUnitRepo.save(otherUnit);

    const otherTemplate = createPatternTemplate({
      id: 'tmpl-2',
      name: 'Controller Pattern',
      description: 'REST controller with validation',
      patternTypes: ['CONTROLLER', 'VALIDATION'],
      templateUnitId: 'unit-2',
      templateFilePath: 'src/controllers/user-controller.ts',
      followerCount: 2,
      conventions: ['Validate input', 'Return HTTP status codes'],
    });
    patternTemplateRepo.save(otherTemplate, []);

    // Filter by SERVICE pattern type should find only the service template
    const result = await handler({ query: 'pattern', pattern_type: 'SERVICE' });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.template.name).toBe('Service Layer Pattern');
  });

  it('should include template details in response', async () => {
    const result = await handler({ query: 'service layer' });

    const parsed = JSON.parse(result.content[0].text);
    const tmpl = parsed.data.template;
    expect(tmpl.id).toBe(templateId);
    expect(tmpl.name).toBe('Service Layer Pattern');
    expect(tmpl.description).toBe('Standard service layer with dependency injection and error handling');
    expect(tmpl.patternTypes).toEqual(['SERVICE', 'DEPENDENCY_INJECTION']);
    expect(tmpl.conventions).toEqual(['Use constructor injection', 'Return Result types for errors', 'Keep methods focused']);
    expect(tmpl.templateFilePath).toBe('src/services/user-service.ts');
    expect(tmpl.followerCount).toBe(3);
  });

  it('should include example with file path, line range, and signature', async () => {
    const result = await handler({ query: 'service layer' });

    const parsed = JSON.parse(result.content[0].text);
    const example = parsed.data.example;
    expect(example.filePath).toBe('src/services/user-service.ts');
    expect(example.lineStart).toBe(10);
    expect(example.lineEnd).toBe(80);
    expect(example.unitName).toBe('UserService');
    expect(example.signature).toBe('class UserService implements IUserService');
  });

  it('should list followers correctly', async () => {
    const result = await handler({ query: 'service layer' });

    const parsed = JSON.parse(result.content[0].text);
    const followers = parsed.data.followers;
    expect(followers).toHaveLength(3);
    expect(followers).toContainEqual({ filePath: 'src/services/order-service.ts', unitName: 'OrderService' });
    expect(followers).toContainEqual({ filePath: 'src/services/payment-service.ts', unitName: 'PaymentService' });
    expect(followers).toContainEqual({ filePath: 'src/services/notification-service.ts', unitName: 'NotificationService' });
  });

  it('should include correctly formatted instructions string', async () => {
    const result = await handler({ query: 'service layer' });

    const parsed = JSON.parse(result.content[0].text);
    const instructions = parsed.data.instructions;

    expect(instructions).toContain('To implement this pattern:');
    expect(instructions).toContain('src/services/user-service.ts');
    expect(instructions).toContain('lines 10-80');
    expect(instructions).toContain('SERVICE');
    expect(instructions).toContain('DEPENDENCY_INJECTION');
    expect(instructions).toContain('Use constructor injection');
    expect(instructions).toContain('Return Result types for errors');
    expect(instructions).toContain('Keep methods focused');
    expect(instructions).toContain('3 existing implementations');
  });

  it('should return the best match when multiple templates exist', async () => {
    // Add a second template that matches less well
    const otherUnit = createCodeUnit({
      id: 'unit-3',
      filePath: 'src/repos/user-repo.ts',
      name: 'UserRepository',
      unitType: CodeUnitType.CLASS,
      lineStart: 1,
      lineEnd: 60,
      isAsync: false,
      isExported: true,
      language: 'typescript',
    });
    codeUnitRepo.save(otherUnit);

    const otherTemplate = createPatternTemplate({
      id: 'tmpl-3',
      name: 'Repository Pattern',
      description: 'Data access layer with query building',
      patternTypes: ['REPOSITORY', 'DATA_ACCESS'],
      templateUnitId: 'unit-3',
      templateFilePath: 'src/repos/user-repo.ts',
      followerCount: 5,
      conventions: ['Use parameterized queries', 'Handle connection pooling'],
    });
    patternTemplateRepo.save(otherTemplate, []);

    // "service" should match the Service Layer Pattern better
    const result = await handler({ query: 'service' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.template.name).toBe('Service Layer Pattern');
  });

  it('should match against pattern types', async () => {
    const result = await handler({ query: 'DEPENDENCY_INJECTION' });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.template.name).toBe('Service Layer Pattern');
  });

  it('should match against description text', async () => {
    const result = await handler({ query: 'error handling' });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.template.name).toBe('Service Layer Pattern');
  });

  it('should handle template unit not found in code unit repo', async () => {
    // Clear code units so the template unit lookup fails
    codeUnitRepo.clear();

    const result = await handler({ query: 'service layer' });

    // Should still return a result but with minimal example info
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.template.name).toBe('Service Layer Pattern');
    expect(parsed.data.example.filePath).toBe('src/services/user-service.ts');
  });
});
