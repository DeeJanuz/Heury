/**
 * MCP tool: get-data-models
 * List schema models with fields.
 */

import type { ISchemaModelRepository } from '@/domain/ports/index.js';
import { buildToolResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  schemaModelRepo: ISchemaModelRepository;
}

export function createGetDataModelsTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-data-models',
    description:
      'List schema/data models with their fields, types, and relations.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Filter by model name',
        },
        framework: {
          type: 'string',
          description:
            'Filter by framework (prisma, typeorm, mongoose, drizzle)',
        },
        file_path: {
          type: 'string',
          description: 'Filter by file path',
        },
      },
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const name = args.name as string | undefined;
    const framework = args.framework as string | undefined;
    const filePath = args.file_path as string | undefined;

    let models = deps.schemaModelRepo.findAll();

    if (name) {
      models = models.filter((m) => m.name === name);
    }
    if (framework) {
      models = models.filter((m) => m.framework === framework);
    }
    if (filePath) {
      models = models.filter((m) => m.filePath === filePath);
    }

    const data = models.map((model) => ({
      id: model.id,
      name: model.name,
      filePath: model.filePath,
      framework: model.framework,
      tableName: model.tableName,
      fields: model.fields.map((field) => ({
        name: field.name,
        fieldType: field.fieldType,
        isPrimaryKey: field.isPrimaryKey,
        isRequired: field.isRequired,
        isUnique: field.isUnique,
        hasDefault: field.hasDefault,
        relationTarget: field.relationTarget,
      })),
    }));

    return buildToolResponse(data, { resultCount: data.length });
  };

  return { definition, handler };
}
