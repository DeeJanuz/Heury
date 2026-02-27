/**
 * MCP tool: get-module-overview
 * Returns overview of all modules/files with their code units summarized.
 */

import type { ICodeUnitRepository } from '@/domain/ports/index.js';
import { buildToolResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  codeUnitRepo: ICodeUnitRepository;
}

export function createGetModuleOverviewTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-module-overview',
    description: 'Returns overview of all modules/files with their code units summarized.',
    inputSchema: {
      type: 'object',
      properties: {
        language: { type: 'string', description: 'Filter by language' },
        limit: { type: 'number', description: 'Max files to return (default 50)' },
        offset: { type: 'number', description: 'Offset for pagination' },
      },
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    let units = deps.codeUnitRepo.findAll();

    if (args.language) {
      units = units.filter((u) => u.language === String(args.language));
    }

    // Group by file path
    const fileMap = new Map<string, Array<{ name: string; unitType: string; isExported: boolean; lineStart: number; lineEnd: number }>>();
    for (const unit of units) {
      if (!fileMap.has(unit.filePath)) {
        fileMap.set(unit.filePath, []);
      }
      fileMap.get(unit.filePath)!.push({
        name: unit.name,
        unitType: unit.unitType,
        isExported: unit.isExported,
        lineStart: unit.lineStart,
        lineEnd: unit.lineEnd,
      });
    }

    let files = [...fileMap.entries()].map(([filePath, codeUnits]) => ({
      file_path: filePath,
      code_units: codeUnits,
      code_unit_count: codeUnits.length,
    }));

    const totalCount = files.length;
    const offset = typeof args.offset === 'number' ? args.offset : 0;
    const limit = typeof args.limit === 'number' ? args.limit : 50;
    files = files.slice(offset, offset + limit);

    return buildToolResponse(files, {
      totalCount,
      hasMore: offset + limit < totalCount,
    });
  };

  return { definition, handler };
}
