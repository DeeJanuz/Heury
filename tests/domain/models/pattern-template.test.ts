import { describe, it, expect } from 'vitest';
import { createPatternTemplate, createPatternTemplateFollower } from '@/domain/models/pattern-template.js';

describe('createPatternTemplate', () => {
  it('should create a pattern template with required fields and generated id', () => {
    const template = createPatternTemplate({
      name: 'Repository Pattern',
      description: 'Data access layer pattern',
      patternTypes: ['repository', 'data-access'],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/repos/base-repo.ts',
      followerCount: 5,
      conventions: ['naming: *Repository', 'extends BaseRepository'],
    });

    expect(template.name).toBe('Repository Pattern');
    expect(template.description).toBe('Data access layer pattern');
    expect(template.patternTypes).toEqual(['repository', 'data-access']);
    expect(template.templateUnitId).toBe('unit-1');
    expect(template.templateFilePath).toBe('src/repos/base-repo.ts');
    expect(template.followerCount).toBe(5);
    expect(template.conventions).toEqual(['naming: *Repository', 'extends BaseRepository']);
    expect(template.id).toBeDefined();
  });

  it('should use provided id when given', () => {
    const template = createPatternTemplate({
      id: 'custom-id',
      name: 'Service Pattern',
      description: 'Service layer pattern',
      patternTypes: ['service'],
      templateUnitId: 'unit-2',
      templateFilePath: 'src/services/base.ts',
      followerCount: 3,
      conventions: [],
    });

    expect(template.id).toBe('custom-id');
  });

  it('should throw when name is empty', () => {
    expect(() =>
      createPatternTemplate({
        name: '',
        description: 'desc',
        patternTypes: [],
        templateUnitId: 'unit-1',
        templateFilePath: 'src/file.ts',
        followerCount: 0,
        conventions: [],
      }),
    ).toThrow('name must not be empty');
  });

  it('should throw when description is empty', () => {
    expect(() =>
      createPatternTemplate({
        name: 'Test',
        description: '',
        patternTypes: [],
        templateUnitId: 'unit-1',
        templateFilePath: 'src/file.ts',
        followerCount: 0,
        conventions: [],
      }),
    ).toThrow('description must not be empty');
  });

  it('should throw when templateUnitId is empty', () => {
    expect(() =>
      createPatternTemplate({
        name: 'Test',
        description: 'desc',
        patternTypes: [],
        templateUnitId: '',
        templateFilePath: 'src/file.ts',
        followerCount: 0,
        conventions: [],
      }),
    ).toThrow('templateUnitId must not be empty');
  });

  it('should throw when templateFilePath is empty', () => {
    expect(() =>
      createPatternTemplate({
        name: 'Test',
        description: 'desc',
        patternTypes: [],
        templateUnitId: 'unit-1',
        templateFilePath: '',
        followerCount: 0,
        conventions: [],
      }),
    ).toThrow('templateFilePath must not be empty');
  });

  it('should throw when followerCount is negative', () => {
    expect(() =>
      createPatternTemplate({
        name: 'Test',
        description: 'desc',
        patternTypes: [],
        templateUnitId: 'unit-1',
        templateFilePath: 'src/file.ts',
        followerCount: -1,
        conventions: [],
      }),
    ).toThrow('followerCount must be >= 0');
  });

  it('should allow followerCount of zero', () => {
    const template = createPatternTemplate({
      name: 'Test',
      description: 'desc',
      patternTypes: [],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/file.ts',
      followerCount: 0,
      conventions: [],
    });

    expect(template.followerCount).toBe(0);
  });

  it('should defensively copy patternTypes array', () => {
    const patternTypes = ['a', 'b'];
    const template = createPatternTemplate({
      name: 'Test',
      description: 'desc',
      patternTypes,
      templateUnitId: 'unit-1',
      templateFilePath: 'src/file.ts',
      followerCount: 0,
      conventions: [],
    });

    patternTypes.push('c');
    expect(template.patternTypes).toEqual(['a', 'b']);
  });

  it('should defensively copy conventions array', () => {
    const conventions = ['conv-1'];
    const template = createPatternTemplate({
      name: 'Test',
      description: 'desc',
      patternTypes: [],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/file.ts',
      followerCount: 0,
      conventions,
    });

    conventions.push('conv-2');
    expect(template.conventions).toEqual(['conv-1']);
  });
});

describe('createPatternTemplateFollower', () => {
  it('should create a follower with required fields', () => {
    const follower = createPatternTemplateFollower({
      templateId: 'template-1',
      filePath: 'src/repos/user-repo.ts',
      unitName: 'UserRepository',
    });

    expect(follower.templateId).toBe('template-1');
    expect(follower.filePath).toBe('src/repos/user-repo.ts');
    expect(follower.unitName).toBe('UserRepository');
  });

  it('should throw when templateId is empty', () => {
    expect(() =>
      createPatternTemplateFollower({
        templateId: '',
        filePath: 'src/file.ts',
        unitName: 'Test',
      }),
    ).toThrow('templateId must not be empty');
  });

  it('should throw when filePath is empty', () => {
    expect(() =>
      createPatternTemplateFollower({
        templateId: 'template-1',
        filePath: '',
        unitName: 'Test',
      }),
    ).toThrow('filePath must not be empty');
  });

  it('should throw when unitName is empty', () => {
    expect(() =>
      createPatternTemplateFollower({
        templateId: 'template-1',
        filePath: 'src/file.ts',
        unitName: '',
      }),
    ).toThrow('unitName must not be empty');
  });
});
