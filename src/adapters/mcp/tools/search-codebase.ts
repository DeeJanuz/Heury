/**
 * MCP tool: search-codebase
 * Text search across code units by name, file path, or pattern value.
 */

import type { ICodeUnitRepository } from '@/domain/ports/index.js';
import { buildToolResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  codeUnitRepo: ICodeUnitRepository;
}

export function createSearchCodebaseTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'search-codebase',
    description: 'Text search across code units by name, file path, or pattern value.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        type: { type: 'string', enum: ['code_unit', 'pattern', 'file'], description: 'Search type (default: code_unit)' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: ['query'],
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const query = String(args.query).toLowerCase();
    const searchType = (args.type as string) ?? 'code_unit';
    const limit = typeof args.limit === 'number' ? args.limit : 20;

    const allUnits = deps.codeUnitRepo.findAll();
    let results;

    switch (searchType) {
      case 'file':
        results = allUnits.filter((u) => u.filePath.toLowerCase().includes(query));
        break;
      case 'pattern':
        results = allUnits.filter((u) =>
          u.patterns.some((p) => p.patternValue.toLowerCase().includes(query)),
        );
        break;
      case 'code_unit':
      default:
        results = allUnits.filter((u) => u.name.toLowerCase().includes(query));
        break;
    }

    const limited = results.slice(0, limit);

    const data = limited.map((u) => ({
      id: u.id,
      name: u.name,
      unitType: u.unitType,
      filePath: u.filePath,
      lineStart: u.lineStart,
      lineEnd: u.lineEnd,
      language: u.language,
    }));

    if (data.length === 0) {
      return buildToolResponse(data, {
        context: { reason: 'no_matches', detail: 'No results found. Try a broader query.' },
      });
    }

    return buildToolResponse(data, {
      totalCount: results.length,
      hasMore: results.length > limit,
    });
  };

  return { definition, handler };
}
