import { describe, it, expect, beforeEach } from 'vitest';

import { generateSchemaManifest } from '@/application/manifest/schema-generator.js';
import { InMemorySchemaModelRepository } from '../../helpers/fakes/index.js';
import { createSchemaModel, createSchemaModelField } from '@/domain/models/index.js';

describe('generateSchemaManifest', () => {
  let schemaModelRepo: InMemorySchemaModelRepository;

  beforeEach(() => {
    schemaModelRepo = new InMemorySchemaModelRepository();
  });

  it('should return header only when no models exist', () => {
    const result = generateSchemaManifest(schemaModelRepo, Infinity);

    expect(result).toContain('# Schema');
    expect(result.split('\n').filter((l) => l.startsWith('##')).length).toBe(0);
  });

  it('should generate a single Prisma model with fields', () => {
    const modelId = 'model-1';
    schemaModelRepo.save(
      createSchemaModel({
        id: modelId,
        name: 'User',
        filePath: 'prisma/schema.prisma',
        framework: 'prisma',
        tableName: 'users',
        fields: [
          createSchemaModelField({
            modelId,
            name: 'id',
            fieldType: 'Int',
            isPrimaryKey: true,
            isRequired: true,
            hasDefault: true,
          }),
          createSchemaModelField({
            modelId,
            name: 'email',
            fieldType: 'String',
            isRequired: true,
            isUnique: true,
          }),
          createSchemaModelField({
            modelId,
            name: 'name',
            fieldType: 'String',
            isRequired: false,
          }),
        ],
      }),
    );

    const result = generateSchemaManifest(schemaModelRepo, Infinity);

    expect(result).toContain('# Schema');
    expect(result).toContain('## User (prisma)');
    expect(result).toContain('Table: users');
    expect(result).toContain('- id: Int (PK, required, default)');
    expect(result).toContain('- email: String (required, unique)');
    expect(result).toContain('- name: String');
    // name has no flags, so it should just be "- name: String" with no parenthesized flags
    const nameLine = result.split('\n').find((l) => l.includes('- name: String'));
    expect(nameLine).toBe('- name: String');
  });

  it('should generate multiple models sorted by field count (descending)', () => {
    const model1Id = 'model-1';
    const model2Id = 'model-2';

    schemaModelRepo.save(
      createSchemaModel({
        id: model1Id,
        name: 'Post',
        filePath: 'prisma/schema.prisma',
        framework: 'prisma',
        tableName: 'posts',
        fields: [
          createSchemaModelField({
            modelId: model1Id,
            name: 'id',
            fieldType: 'Int',
            isPrimaryKey: true,
            isRequired: true,
            hasDefault: true,
          }),
          createSchemaModelField({
            modelId: model1Id,
            name: 'title',
            fieldType: 'String',
            isRequired: true,
          }),
          createSchemaModelField({
            modelId: model1Id,
            name: 'authorId',
            fieldType: 'Int',
            isRequired: true,
            relationTarget: 'User',
          }),
        ],
      }),
    );

    schemaModelRepo.save(
      createSchemaModel({
        id: model2Id,
        name: 'Tag',
        filePath: 'prisma/schema.prisma',
        framework: 'prisma',
        fields: [
          createSchemaModelField({
            modelId: model2Id,
            name: 'id',
            fieldType: 'Int',
            isPrimaryKey: true,
            isRequired: true,
            hasDefault: true,
          }),
        ],
      }),
    );

    const result = generateSchemaManifest(schemaModelRepo, Infinity);

    // Post has 3 fields, Tag has 1 - Post should appear first (higher score)
    expect(result.indexOf('Post')).toBeLessThan(result.indexOf('Tag'));
  });

  it('should format field flags correctly', () => {
    const modelId = 'model-flags';
    schemaModelRepo.save(
      createSchemaModel({
        id: modelId,
        name: 'FullModel',
        filePath: 'schema.prisma',
        framework: 'prisma',
        fields: [
          createSchemaModelField({
            modelId,
            name: 'allFlags',
            fieldType: 'Int',
            isPrimaryKey: true,
            isRequired: true,
            isUnique: true,
            hasDefault: true,
          }),
        ],
      }),
    );

    const result = generateSchemaManifest(schemaModelRepo, Infinity);

    expect(result).toContain('- allFlags: Int (PK, required, unique, default)');
  });

  it('should show relation arrow when field has relationTarget', () => {
    const modelId = 'model-rel';
    schemaModelRepo.save(
      createSchemaModel({
        id: modelId,
        name: 'Post',
        filePath: 'schema.prisma',
        framework: 'prisma',
        fields: [
          createSchemaModelField({
            modelId,
            name: 'authorId',
            fieldType: 'Int',
            isRequired: true,
            relationTarget: 'User',
          }),
          createSchemaModelField({
            modelId,
            name: 'comments',
            fieldType: 'Comment[]',
            relationTarget: 'Comment',
          }),
        ],
      }),
    );

    const result = generateSchemaManifest(schemaModelRepo, Infinity);

    expect(result).toContain('authorId: Int (required, \u2192 User)');
    expect(result).toContain('comments: Comment[] (\u2192 Comment)');
  });

  it('should omit table name line when tableName is not set', () => {
    const modelId = 'model-no-table';
    schemaModelRepo.save(
      createSchemaModel({
        id: modelId,
        name: 'Config',
        filePath: 'schema.prisma',
        framework: 'prisma',
        fields: [
          createSchemaModelField({
            modelId,
            name: 'key',
            fieldType: 'String',
            isRequired: true,
          }),
        ],
      }),
    );

    const result = generateSchemaManifest(schemaModelRepo, Infinity);

    expect(result).toContain('## Config (prisma)');
    expect(result).not.toContain('Table:');
  });

  it('should respect token budget', () => {
    // Create many models to exceed a small budget
    for (let i = 0; i < 20; i++) {
      const modelId = `model-${i}`;
      schemaModelRepo.save(
        createSchemaModel({
          id: modelId,
          name: `Model${i}`,
          filePath: 'schema.prisma',
          framework: 'prisma',
          fields: [
            createSchemaModelField({
              modelId,
              name: 'id',
              fieldType: 'Int',
              isPrimaryKey: true,
              isRequired: true,
            }),
            createSchemaModelField({
              modelId,
              name: 'value',
              fieldType: 'String',
              isRequired: true,
            }),
          ],
        }),
      );
    }

    const result = generateSchemaManifest(schemaModelRepo, 50);

    // With a very small budget, not all models should fit
    expect(result.length).toBeLessThan(400);
  });
});
