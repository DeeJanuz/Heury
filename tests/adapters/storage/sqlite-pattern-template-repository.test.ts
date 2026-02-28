import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '@/adapters/storage/database.js';
import { SqlitePatternTemplateRepository } from '@/adapters/storage/sqlite-pattern-template-repository.js';
import { SqliteCodeUnitRepository } from '@/adapters/storage/sqlite-code-unit-repository.js';
import { createPatternTemplate, createPatternTemplateFollower } from '@/domain/models/index.js';
import { createCodeUnit, CodeUnitType } from '@/domain/models/code-unit.js';

describe('SqlitePatternTemplateRepository', () => {
  let dbManager: DatabaseManager;
  let repo: SqlitePatternTemplateRepository;
  let codeUnitRepo: SqliteCodeUnitRepository;

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:', inMemory: true });
    dbManager.initialize();
    const db = dbManager.getDatabase();
    repo = new SqlitePatternTemplateRepository(db);
    codeUnitRepo = new SqliteCodeUnitRepository(db);

    // Insert code units that pattern templates reference via foreign key
    const unitDefaults = {
      unitType: CodeUnitType.CLASS,
      isAsync: false,
      isExported: true,
      language: 'typescript',
    };
    codeUnitRepo.save(createCodeUnit({
      id: 'unit-1',
      name: 'BaseRepository',
      filePath: 'src/repos/base-repo.ts',
      lineStart: 1,
      lineEnd: 50,
      ...unitDefaults,
    }));
    codeUnitRepo.save(createCodeUnit({
      id: 'unit-2',
      name: 'BaseService',
      filePath: 'src/services/base.ts',
      lineStart: 1,
      lineEnd: 30,
      ...unitDefaults,
    }));
    codeUnitRepo.save(createCodeUnit({
      id: 'unit-3',
      name: 'BaseController',
      filePath: 'src/controllers/base.ts',
      lineStart: 1,
      lineEnd: 40,
      ...unitDefaults,
    }));
  });

  afterEach(() => {
    dbManager.close();
  });

  it('should save and find a template by id', () => {
    const template = createPatternTemplate({
      id: 'pt-1',
      name: 'Repository Pattern',
      description: 'Data access layer pattern',
      patternTypes: ['repository', 'data-access'],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/repos/base-repo.ts',
      followerCount: 2,
      conventions: ['naming: *Repository'],
    });
    const followers = [
      createPatternTemplateFollower({ templateId: 'pt-1', filePath: 'src/repos/user-repo.ts', unitName: 'UserRepository' }),
      createPatternTemplateFollower({ templateId: 'pt-1', filePath: 'src/repos/order-repo.ts', unitName: 'OrderRepository' }),
    ];

    repo.save(template, followers);

    const found = repo.findById('pt-1');
    expect(found).toBeDefined();
    expect(found!.template.id).toBe('pt-1');
    expect(found!.template.name).toBe('Repository Pattern');
    expect(found!.template.description).toBe('Data access layer pattern');
    expect(found!.template.templateUnitId).toBe('unit-1');
    expect(found!.template.templateFilePath).toBe('src/repos/base-repo.ts');
    expect(found!.template.followerCount).toBe(2);
    expect(found!.followers).toHaveLength(2);
  });

  it('should return undefined for non-existent id', () => {
    expect(repo.findById('non-existent')).toBeUndefined();
  });

  it('should round-trip JSON arrays (patternTypes and conventions)', () => {
    const template = createPatternTemplate({
      id: 'pt-1',
      name: 'Test',
      description: 'Test description',
      patternTypes: ['type-a', 'type-b', 'type-c'],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/repos/base-repo.ts',
      followerCount: 0,
      conventions: ['conv-1', 'conv-2'],
    });

    repo.save(template, []);

    const found = repo.findById('pt-1');
    expect(found!.template.patternTypes).toEqual(['type-a', 'type-b', 'type-c']);
    expect(found!.template.conventions).toEqual(['conv-1', 'conv-2']);
  });

  it('should save and find template by pattern type', () => {
    const template = createPatternTemplate({
      id: 'pt-1',
      name: 'Repository Pattern',
      description: 'Data access layer',
      patternTypes: ['repository', 'data-access'],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/repos/base-repo.ts',
      followerCount: 1,
      conventions: [],
    });
    const followers = [
      createPatternTemplateFollower({ templateId: 'pt-1', filePath: 'src/repos/user-repo.ts', unitName: 'UserRepository' }),
    ];

    repo.save(template, followers);

    const found = repo.findByPatternType('repository');
    expect(found).toHaveLength(1);
    expect(found[0].template.id).toBe('pt-1');
    expect(found[0].followers).toHaveLength(1);
  });

  it('should find by pattern type when template has multiple types (partial match)', () => {
    const template = createPatternTemplate({
      id: 'pt-1',
      name: 'Multi Pattern',
      description: 'Has multiple types',
      patternTypes: ['type-a', 'type-b', 'type-c'],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/repos/base-repo.ts',
      followerCount: 0,
      conventions: [],
    });

    repo.save(template, []);

    // Querying for 'type-b' should match even though the template has [type-a, type-b, type-c]
    const found = repo.findByPatternType('type-b');
    expect(found).toHaveLength(1);
    expect(found[0].template.id).toBe('pt-1');
  });

  it('should return empty array for non-existent pattern type', () => {
    expect(repo.findByPatternType('non-existent')).toHaveLength(0);
  });

  it('should find multiple templates with overlapping pattern types', () => {
    const t1 = createPatternTemplate({
      id: 'pt-1',
      name: 'Repo',
      description: 'Repo pattern',
      patternTypes: ['repository', 'data-access'],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/repos/base-repo.ts',
      followerCount: 0,
      conventions: [],
    });
    const t2 = createPatternTemplate({
      id: 'pt-2',
      name: 'Service',
      description: 'Service pattern',
      patternTypes: ['service', 'data-access'],
      templateUnitId: 'unit-2',
      templateFilePath: 'src/services/base.ts',
      followerCount: 0,
      conventions: [],
    });

    repo.save(t1, []);
    repo.save(t2, []);

    // Both have 'data-access'
    const found = repo.findByPatternType('data-access');
    expect(found).toHaveLength(2);

    // Only t1 has 'repository'
    const repoOnly = repo.findByPatternType('repository');
    expect(repoOnly).toHaveLength(1);
    expect(repoOnly[0].template.id).toBe('pt-1');
  });

  it('should find all templates', () => {
    const t1 = createPatternTemplate({
      id: 'pt-1',
      name: 'Repo',
      description: 'desc',
      patternTypes: ['repository'],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/repos/base-repo.ts',
      followerCount: 1,
      conventions: [],
    });
    const t2 = createPatternTemplate({
      id: 'pt-2',
      name: 'Service',
      description: 'desc',
      patternTypes: ['service'],
      templateUnitId: 'unit-2',
      templateFilePath: 'src/services/base.ts',
      followerCount: 0,
      conventions: [],
    });

    repo.save(t1, [
      createPatternTemplateFollower({ templateId: 'pt-1', filePath: 'src/repos/user-repo.ts', unitName: 'UserRepository' }),
    ]);
    repo.save(t2, []);

    const all = repo.findAll();
    expect(all).toHaveLength(2);
  });

  it('should batch save multiple templates', () => {
    const batch = [
      {
        template: createPatternTemplate({
          id: 'pt-1',
          name: 'Repo',
          description: 'desc',
          patternTypes: ['repository'],
          templateUnitId: 'unit-1',
          templateFilePath: 'src/repos/base-repo.ts',
          followerCount: 2,
          conventions: ['naming: *Repository'],
        }),
        followers: [
          createPatternTemplateFollower({ templateId: 'pt-1', filePath: 'src/repos/user-repo.ts', unitName: 'UserRepository' }),
          createPatternTemplateFollower({ templateId: 'pt-1', filePath: 'src/repos/order-repo.ts', unitName: 'OrderRepository' }),
        ],
      },
      {
        template: createPatternTemplate({
          id: 'pt-2',
          name: 'Service',
          description: 'desc',
          patternTypes: ['service'],
          templateUnitId: 'unit-2',
          templateFilePath: 'src/services/base.ts',
          followerCount: 1,
          conventions: [],
        }),
        followers: [
          createPatternTemplateFollower({ templateId: 'pt-2', filePath: 'src/services/user.ts', unitName: 'UserService' }),
        ],
      },
    ];

    repo.saveBatch(batch);

    const all = repo.findAll();
    expect(all).toHaveLength(2);
    expect(all[0].followers.length + all[1].followers.length).toBe(3);
  });

  it('should clear all data', () => {
    const template = createPatternTemplate({
      id: 'pt-1',
      name: 'Repo',
      description: 'desc',
      patternTypes: ['repository'],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/repos/base-repo.ts',
      followerCount: 1,
      conventions: [],
    });
    repo.save(template, [
      createPatternTemplateFollower({ templateId: 'pt-1', filePath: 'src/repos/user-repo.ts', unitName: 'UserRepository' }),
    ]);

    repo.clear();

    expect(repo.findAll()).toHaveLength(0);
    expect(repo.findById('pt-1')).toBeUndefined();
  });

  it('should correctly store and retrieve followers', () => {
    const template = createPatternTemplate({
      id: 'pt-1',
      name: 'Repo',
      description: 'desc',
      patternTypes: ['repository'],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/repos/base-repo.ts',
      followerCount: 2,
      conventions: [],
    });
    const followers = [
      createPatternTemplateFollower({ templateId: 'pt-1', filePath: 'src/repos/user-repo.ts', unitName: 'UserRepository' }),
      createPatternTemplateFollower({ templateId: 'pt-1', filePath: 'src/repos/order-repo.ts', unitName: 'OrderRepository' }),
    ];

    repo.save(template, followers);

    const found = repo.findById('pt-1');
    expect(found!.followers).toHaveLength(2);
    const userFollower = found!.followers.find(f => f.unitName === 'UserRepository');
    const orderFollower = found!.followers.find(f => f.unitName === 'OrderRepository');
    expect(userFollower!.filePath).toBe('src/repos/user-repo.ts');
    expect(userFollower!.templateId).toBe('pt-1');
    expect(orderFollower!.filePath).toBe('src/repos/order-repo.ts');
    expect(orderFollower!.templateId).toBe('pt-1');
  });

  it('should overwrite existing template on save with same id (upsert)', () => {
    const template = createPatternTemplate({
      id: 'pt-1',
      name: 'Original',
      description: 'original desc',
      patternTypes: ['old-type'],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/repos/base-repo.ts',
      followerCount: 1,
      conventions: ['old-conv'],
    });
    repo.save(template, [
      createPatternTemplateFollower({ templateId: 'pt-1', filePath: 'src/old.ts', unitName: 'OldUnit' }),
    ]);

    const updated = createPatternTemplate({
      id: 'pt-1',
      name: 'Updated',
      description: 'updated desc',
      patternTypes: ['new-type'],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/repos/base-repo.ts',
      followerCount: 2,
      conventions: ['new-conv'],
    });
    repo.save(updated, [
      createPatternTemplateFollower({ templateId: 'pt-1', filePath: 'src/new1.ts', unitName: 'NewUnit1' }),
      createPatternTemplateFollower({ templateId: 'pt-1', filePath: 'src/new2.ts', unitName: 'NewUnit2' }),
    ]);

    const found = repo.findById('pt-1');
    expect(found).toBeDefined();
    expect(found!.template.name).toBe('Updated');
    expect(found!.template.description).toBe('updated desc');
    expect(found!.template.patternTypes).toEqual(['new-type']);
    expect(found!.template.conventions).toEqual(['new-conv']);
    expect(found!.template.followerCount).toBe(2);
    expect(found!.followers).toHaveLength(2);
    expect(found!.followers[0].unitName).not.toBe('OldUnit');
  });

  it('should handle empty patternTypes and conventions arrays', () => {
    const template = createPatternTemplate({
      id: 'pt-1',
      name: 'Minimal',
      description: 'minimal desc',
      patternTypes: [],
      templateUnitId: 'unit-1',
      templateFilePath: 'src/repos/base-repo.ts',
      followerCount: 0,
      conventions: [],
    });

    repo.save(template, []);

    const found = repo.findById('pt-1');
    expect(found!.template.patternTypes).toEqual([]);
    expect(found!.template.conventions).toEqual([]);
  });
});
