import { describe, it, expect, beforeEach } from 'vitest';
import { createGetDataModelsTool } from '@/adapters/mcp/tools/get-data-models.js';
import { InMemorySchemaModelRepository } from '../../../../tests/helpers/fakes/index.js';
import { createSchemaModel, createSchemaModelField } from '@/domain/models/index.js';

describe('get-data-models tool', () => {
  let schemaModelRepo: InMemorySchemaModelRepository;
  let handler: ReturnType<typeof createGetDataModelsTool>['handler'];

  const userModelId = 'model-user';
  const orderModelId = 'model-order';
  const productModelId = 'model-product';

  beforeEach(() => {
    schemaModelRepo = new InMemorySchemaModelRepository();
    const tool = createGetDataModelsTool({ schemaModelRepo });
    handler = tool.handler;

    const userFields = [
      createSchemaModelField({
        modelId: userModelId,
        name: 'id',
        fieldType: 'Int',
        isPrimaryKey: true,
        isRequired: true,
      }),
      createSchemaModelField({
        modelId: userModelId,
        name: 'email',
        fieldType: 'String',
        isRequired: true,
        isUnique: true,
      }),
      createSchemaModelField({
        modelId: userModelId,
        name: 'name',
        fieldType: 'String',
        isRequired: false,
      }),
    ];

    schemaModelRepo.save(createSchemaModel({
      id: userModelId,
      name: 'User',
      filePath: 'prisma/schema.prisma',
      framework: 'prisma',
      tableName: 'users',
      fields: userFields,
    }));

    const orderFields = [
      createSchemaModelField({
        modelId: orderModelId,
        name: 'id',
        fieldType: 'Int',
        isPrimaryKey: true,
        isRequired: true,
      }),
      createSchemaModelField({
        modelId: orderModelId,
        name: 'userId',
        fieldType: 'Int',
        isRequired: true,
        relationTarget: 'User',
      }),
    ];

    schemaModelRepo.save(createSchemaModel({
      id: orderModelId,
      name: 'Order',
      filePath: 'prisma/schema.prisma',
      framework: 'prisma',
      tableName: 'orders',
      fields: orderFields,
    }));

    schemaModelRepo.save(createSchemaModel({
      id: productModelId,
      name: 'Product',
      filePath: 'src/models/product.ts',
      framework: 'typeorm',
      tableName: 'products',
      fields: [],
    }));
  });

  it('should have correct tool definition', () => {
    const tool = createGetDataModelsTool({ schemaModelRepo });
    expect(tool.definition.name).toBe('get-data-models');
    expect(tool.definition.inputSchema).toBeDefined();
  });

  it('should return all models when no filters', async () => {
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(3);
    expect(parsed.meta.result_count).toBe(3);
  });

  it('should filter by name', async () => {
    const result = await handler({ name: 'User' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe('User');
  });

  it('should filter by framework', async () => {
    const result = await handler({ framework: 'prisma' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(2);
    expect(parsed.data.every((m: any) => m.framework === 'prisma')).toBe(true);
  });

  it('should filter by file_path', async () => {
    const result = await handler({ file_path: 'src/models/product.ts' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe('Product');
  });

  it('should combine multiple filters', async () => {
    const result = await handler({ framework: 'prisma', name: 'Order' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe('Order');
  });

  it('should return empty array when no matches', async () => {
    const result = await handler({ name: 'nonexistent' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(0);
    expect(parsed.meta.result_count).toBe(0);
  });

  it('should include fields in response', async () => {
    const result = await handler({ name: 'User' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data[0].fields).toHaveLength(3);
    expect(parsed.data[0].fields[0].name).toBe('id');
    expect(parsed.data[0].fields[0].isPrimaryKey).toBe(true);
    expect(parsed.data[0].fields[1].name).toBe('email');
    expect(parsed.data[0].fields[1].isUnique).toBe(true);
  });

  it('should include tableName and framework', async () => {
    const result = await handler({ name: 'User' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data[0].tableName).toBe('users');
    expect(parsed.data[0].framework).toBe('prisma');
  });

  it('should include relation targets in fields', async () => {
    const result = await handler({ name: 'Order' });
    const parsed = JSON.parse(result.content[0].text);

    const userIdField = parsed.data[0].fields.find((f: any) => f.name === 'userId');
    expect(userIdField.relationTarget).toBe('User');
  });
});
