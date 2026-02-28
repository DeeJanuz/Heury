import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '@/adapters/storage/database.js';
import { SqliteSchemaModelRepository } from '@/adapters/storage/sqlite-schema-model-repository.js';
import { createSchemaModel, createSchemaModelField } from '@/domain/models/index.js';

describe('SqliteSchemaModelRepository', () => {
  let dbManager: DatabaseManager;
  let repo: SqliteSchemaModelRepository;

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:', inMemory: true });
    dbManager.initialize();
    repo = new SqliteSchemaModelRepository(dbManager.getDatabase());
  });

  afterEach(() => {
    dbManager.close();
  });

  it('should save and find a schema model by id', () => {
    const model = createSchemaModel({
      id: 'sm-1',
      name: 'User',
      filePath: 'prisma/schema.prisma',
      framework: 'prisma',
      tableName: 'users',
    });
    repo.save(model);

    const found = repo.findById('sm-1');
    expect(found).toBeDefined();
    expect(found!.id).toBe('sm-1');
    expect(found!.name).toBe('User');
    expect(found!.filePath).toBe('prisma/schema.prisma');
    expect(found!.framework).toBe('prisma');
    expect(found!.tableName).toBe('users');
    expect(found!.fields).toEqual([]);
  });

  it('should return undefined for non-existent id', () => {
    expect(repo.findById('non-existent')).toBeUndefined();
  });

  it('should save model with fields and retrieve them', () => {
    const modelId = 'sm-1';
    const fields = [
      createSchemaModelField({
        id: 'f-1',
        modelId,
        name: 'id',
        fieldType: 'Int',
        isPrimaryKey: true,
        isRequired: true,
        isUnique: true,
        hasDefault: true,
      }),
      createSchemaModelField({
        id: 'f-2',
        modelId,
        name: 'email',
        fieldType: 'String',
        isRequired: true,
        isUnique: true,
      }),
      createSchemaModelField({
        id: 'f-3',
        modelId,
        name: 'profileId',
        fieldType: 'Int',
        relationTarget: 'Profile',
      }),
    ];

    const model = createSchemaModel({
      id: modelId,
      name: 'User',
      filePath: 'prisma/schema.prisma',
      framework: 'prisma',
      fields,
    });
    repo.save(model);

    const found = repo.findById(modelId);
    expect(found).toBeDefined();
    expect(found!.fields).toHaveLength(3);

    const idField = found!.fields.find(f => f.name === 'id');
    expect(idField!.isPrimaryKey).toBe(true);
    expect(idField!.isRequired).toBe(true);
    expect(idField!.isUnique).toBe(true);
    expect(idField!.hasDefault).toBe(true);

    const emailField = found!.fields.find(f => f.name === 'email');
    expect(emailField!.isRequired).toBe(true);
    expect(emailField!.isUnique).toBe(true);
    expect(emailField!.isPrimaryKey).toBe(false);

    const profileField = found!.fields.find(f => f.name === 'profileId');
    expect(profileField!.relationTarget).toBe('Profile');
  });

  it('should find by name', () => {
    repo.save(createSchemaModel({ id: 'sm-1', name: 'User', filePath: 'schema.prisma', framework: 'prisma' }));
    repo.save(createSchemaModel({ id: 'sm-2', name: 'Post', filePath: 'schema.prisma', framework: 'prisma' }));

    const found = repo.findByName('User');
    expect(found).toBeDefined();
    expect(found!.id).toBe('sm-1');

    expect(repo.findByName('NonExistent')).toBeUndefined();
  });

  it('should find by file path', () => {
    repo.save(createSchemaModel({ id: 'sm-1', name: 'User', filePath: 'prisma/schema.prisma', framework: 'prisma' }));
    repo.save(createSchemaModel({ id: 'sm-2', name: 'Post', filePath: 'prisma/schema.prisma', framework: 'prisma' }));
    repo.save(createSchemaModel({ id: 'sm-3', name: 'Config', filePath: 'models/config.ts', framework: 'typeorm' }));

    expect(repo.findByFilePath('prisma/schema.prisma')).toHaveLength(2);
    expect(repo.findByFilePath('models/config.ts')).toHaveLength(1);
    expect(repo.findByFilePath('non-existent.ts')).toHaveLength(0);
  });

  it('should find by framework', () => {
    repo.save(createSchemaModel({ id: 'sm-1', name: 'User', filePath: 'schema.prisma', framework: 'prisma' }));
    repo.save(createSchemaModel({ id: 'sm-2', name: 'Config', filePath: 'config.ts', framework: 'typeorm' }));

    expect(repo.findByFramework('prisma')).toHaveLength(1);
    expect(repo.findByFramework('typeorm')).toHaveLength(1);
    expect(repo.findByFramework('sequelize')).toHaveLength(0);
  });

  it('should save batch in transaction', () => {
    const models = [
      createSchemaModel({ id: 'sm-1', name: 'User', filePath: 'schema.prisma', framework: 'prisma' }),
      createSchemaModel({ id: 'sm-2', name: 'Post', filePath: 'schema.prisma', framework: 'prisma' }),
      createSchemaModel({ id: 'sm-3', name: 'Comment', filePath: 'schema.prisma', framework: 'prisma' }),
    ];
    repo.saveBatch(models);
    expect(repo.findAll()).toHaveLength(3);
  });

  it('should delete by file path and cascade to fields', () => {
    const field = createSchemaModelField({
      id: 'f-1',
      modelId: 'sm-1',
      name: 'id',
      fieldType: 'Int',
    });
    repo.save(createSchemaModel({
      id: 'sm-1',
      name: 'User',
      filePath: 'prisma/schema.prisma',
      framework: 'prisma',
      fields: [field],
    }));
    repo.save(createSchemaModel({ id: 'sm-2', name: 'Config', filePath: 'config.ts', framework: 'typeorm' }));

    repo.deleteByFilePath('prisma/schema.prisma');
    expect(repo.findAll()).toHaveLength(1);
    expect(repo.findById('sm-1')).toBeUndefined();
  });

  it('should clear all models and fields', () => {
    const field = createSchemaModelField({ id: 'f-1', modelId: 'sm-1', name: 'id', fieldType: 'Int' });
    repo.save(createSchemaModel({ id: 'sm-1', name: 'User', filePath: 'schema.prisma', framework: 'prisma', fields: [field] }));
    repo.save(createSchemaModel({ id: 'sm-2', name: 'Post', filePath: 'schema.prisma', framework: 'prisma' }));

    repo.clear();
    expect(repo.findAll()).toHaveLength(0);
  });

  it('should overwrite existing model on save with same id', () => {
    repo.save(createSchemaModel({ id: 'sm-1', name: 'Original', filePath: 'schema.prisma', framework: 'prisma' }));
    repo.save(createSchemaModel({ id: 'sm-1', name: 'Updated', filePath: 'schema.prisma', framework: 'prisma' }));

    const all = repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Updated');
  });

  it('should replace fields when model is re-saved', () => {
    const field1 = createSchemaModelField({ id: 'f-1', modelId: 'sm-1', name: 'id', fieldType: 'Int' });
    repo.save(createSchemaModel({ id: 'sm-1', name: 'User', filePath: 'schema.prisma', framework: 'prisma', fields: [field1] }));

    const field2 = createSchemaModelField({ id: 'f-2', modelId: 'sm-1', name: 'email', fieldType: 'String' });
    repo.save(createSchemaModel({ id: 'sm-1', name: 'User', filePath: 'schema.prisma', framework: 'prisma', fields: [field2] }));

    const found = repo.findById('sm-1');
    expect(found!.fields).toHaveLength(1);
    expect(found!.fields[0].name).toBe('email');
  });

  it('should handle model without tableName', () => {
    repo.save(createSchemaModel({ id: 'sm-1', name: 'User', filePath: 'schema.prisma', framework: 'prisma' }));

    const found = repo.findById('sm-1');
    expect(found!.tableName).toBeUndefined();
  });

  it('should handle field without relationTarget', () => {
    const field = createSchemaModelField({ id: 'f-1', modelId: 'sm-1', name: 'id', fieldType: 'Int' });
    repo.save(createSchemaModel({ id: 'sm-1', name: 'User', filePath: 'schema.prisma', framework: 'prisma', fields: [field] }));

    const found = repo.findById('sm-1');
    expect(found!.fields[0].relationTarget).toBeUndefined();
  });
});
