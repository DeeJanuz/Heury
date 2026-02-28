import { describe, it, expect } from 'vitest';
import { createSchemaModel, createSchemaModelField } from '@/domain/models/schema-model.js';

describe('createSchemaModelField', () => {
  it('should create a field with required params and defaults', () => {
    const field = createSchemaModelField({
      modelId: 'model-1',
      name: 'id',
      fieldType: 'Int',
    });

    expect(field.modelId).toBe('model-1');
    expect(field.name).toBe('id');
    expect(field.fieldType).toBe('Int');
    expect(field.isPrimaryKey).toBe(false);
    expect(field.isRequired).toBe(false);
    expect(field.isUnique).toBe(false);
    expect(field.hasDefault).toBe(false);
    expect(field.relationTarget).toBeUndefined();
    expect(field.id).toBeDefined();
  });

  it('should use provided id when given', () => {
    const field = createSchemaModelField({
      id: 'custom-field-id',
      modelId: 'model-1',
      name: 'email',
      fieldType: 'String',
    });

    expect(field.id).toBe('custom-field-id');
  });

  it('should include all optional boolean flags', () => {
    const field = createSchemaModelField({
      modelId: 'model-1',
      name: 'id',
      fieldType: 'Int',
      isPrimaryKey: true,
      isRequired: true,
      isUnique: true,
      hasDefault: true,
    });

    expect(field.isPrimaryKey).toBe(true);
    expect(field.isRequired).toBe(true);
    expect(field.isUnique).toBe(true);
    expect(field.hasDefault).toBe(true);
  });

  it('should include relationTarget when provided', () => {
    const field = createSchemaModelField({
      modelId: 'model-1',
      name: 'userId',
      fieldType: 'Int',
      relationTarget: 'User',
    });

    expect(field.relationTarget).toBe('User');
  });

  it('should throw when modelId is empty', () => {
    expect(() =>
      createSchemaModelField({
        modelId: '',
        name: 'id',
        fieldType: 'Int',
      }),
    ).toThrow('modelId must not be empty');
  });

  it('should throw when name is empty', () => {
    expect(() =>
      createSchemaModelField({
        modelId: 'model-1',
        name: '',
        fieldType: 'Int',
      }),
    ).toThrow('name must not be empty');
  });

  it('should throw when fieldType is empty', () => {
    expect(() =>
      createSchemaModelField({
        modelId: 'model-1',
        name: 'id',
        fieldType: '',
      }),
    ).toThrow('fieldType must not be empty');
  });
});

describe('createSchemaModel', () => {
  it('should create a schema model with required fields and defaults', () => {
    const model = createSchemaModel({
      name: 'User',
      filePath: 'prisma/schema.prisma',
      framework: 'prisma',
    });

    expect(model.name).toBe('User');
    expect(model.filePath).toBe('prisma/schema.prisma');
    expect(model.framework).toBe('prisma');
    expect(model.tableName).toBeUndefined();
    expect(model.fields).toEqual([]);
    expect(model.id).toBeDefined();
  });

  it('should use provided id when given', () => {
    const model = createSchemaModel({
      id: 'custom-model-id',
      name: 'User',
      filePath: 'prisma/schema.prisma',
      framework: 'prisma',
    });

    expect(model.id).toBe('custom-model-id');
  });

  it('should include optional fields when provided', () => {
    const field = createSchemaModelField({
      modelId: 'model-1',
      name: 'id',
      fieldType: 'Int',
      isPrimaryKey: true,
    });

    const model = createSchemaModel({
      id: 'model-1',
      name: 'User',
      filePath: 'prisma/schema.prisma',
      framework: 'prisma',
      tableName: 'users',
      fields: [field],
    });

    expect(model.tableName).toBe('users');
    expect(model.fields).toHaveLength(1);
    expect(model.fields[0].name).toBe('id');
  });

  it('should throw when name is empty', () => {
    expect(() =>
      createSchemaModel({
        name: '',
        filePath: 'prisma/schema.prisma',
        framework: 'prisma',
      }),
    ).toThrow('name must not be empty');
  });

  it('should throw when filePath is empty', () => {
    expect(() =>
      createSchemaModel({
        name: 'User',
        filePath: '',
        framework: 'prisma',
      }),
    ).toThrow('filePath must not be empty');
  });

  it('should throw when framework is empty', () => {
    expect(() =>
      createSchemaModel({
        name: 'User',
        filePath: 'prisma/schema.prisma',
        framework: '',
      }),
    ).toThrow('framework must not be empty');
  });
});
