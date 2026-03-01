/**
 * MCP tool: get-unenriched-units
 * Returns exported code units that don't yet have summaries.
 */

import type { IUnitSummaryRepository, ICodeUnitRepository } from '@/domain/ports/index.js';
import { buildToolResponse, stripDefaults } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  unitSummaryRepo: IUnitSummaryRepository;
  codeUnitRepo: ICodeUnitRepository;
}

export function createGetUnenrichedUnitsTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-unenriched-units',
    description:
      'Get exported code units that do not yet have LLM-generated summaries. Use this to discover which units need enrichment, then submit summaries via set-unit-summaries.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Filter by file path' },
        limit: { type: 'number', description: 'Maximum number of results (default: 50)' },
      },
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const filePath = args.file_path as string | undefined;
    const limit = (args.limit as number | undefined) ?? 50;

    let units = deps.codeUnitRepo.findAll().filter((u) => u.isExported);

    if (filePath) {
      units = units.filter((u) => u.filePath === filePath);
    }

    // Filter to only units without summaries
    const unenriched = units.filter((u) => !deps.unitSummaryRepo.findByCodeUnitId(u.id));

    const totalCount = unenriched.length;
    const results = unenriched.slice(0, limit).map((u) => ({
      id: u.id,
      name: u.name,
      unitType: u.unitType,
      filePath: u.filePath,
      signature: u.signature,
      lineStart: u.lineStart,
      lineEnd: u.lineEnd,
    }));

    return buildToolResponse(stripDefaults(results) as unknown[], {
      totalCount,
      hasMore: limit < totalCount,
    });
  };

  return { definition, handler };
}
