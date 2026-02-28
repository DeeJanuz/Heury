/**
 * MCP tool: get-patterns-by-type
 * Query code unit patterns filtered by pattern type.
 */

import type { ICodeUnitRepository } from '@/domain/ports/index.js';
import { buildToolResponse, buildErrorResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  codeUnitRepo: ICodeUnitRepository;
}

export function createGetPatternsByTypeTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-patterns-by-type',
    description:
      'Query code unit patterns filtered by pattern type (e.g. DATABASE_READ, API_ENDPOINT, DATABASE_WRITE, EXTERNAL_SERVICE, ENV_VARIABLE). Optionally filter by file path.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern_type: {
          type: 'string',
          description:
            'Pattern type to filter by (e.g. API_ENDPOINT, DATABASE_READ, DATABASE_WRITE, EXTERNAL_SERVICE, ENV_VARIABLE, IMPORT, EXPORT, API_CALL)',
        },
        file_path: {
          type: 'string',
          description: 'Optional file path to restrict results to a single file',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 100)',
        },
      },
      required: ['pattern_type'],
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const patternType = args.pattern_type;

    if (!patternType || typeof patternType !== 'string') {
      return buildErrorResponse('pattern_type is required and must be a string');
    }

    const filePath = typeof args.file_path === 'string' ? args.file_path : undefined;

    const units = filePath
      ? deps.codeUnitRepo.findByFilePath(filePath)
      : deps.codeUnitRepo.findAll();

    const results: Array<{
      patternType: string;
      patternValue: string;
      codeUnitName: string;
      filePath: string;
      lineNumber?: number;
      columnAccess?: { read: string[]; write: string[] };
    }> = [];

    for (const unit of units) {
      for (const pattern of unit.patterns) {
        if (pattern.patternType === patternType) {
          const entry: {
            patternType: string;
            patternValue: string;
            codeUnitName: string;
            filePath: string;
            lineNumber?: number;
            columnAccess?: { read: string[]; write: string[] };
          } = {
            patternType: pattern.patternType,
            patternValue: pattern.patternValue,
            codeUnitName: unit.name,
            filePath: unit.filePath,
            lineNumber: pattern.lineNumber,
          };

          if (pattern.columnAccess) {
            entry.columnAccess = pattern.columnAccess;
          }

          results.push(entry);
        }
      }
    }

    const limit = typeof args.limit === 'number' ? args.limit : 100;
    const limited = results.slice(0, limit);

    return buildToolResponse(limited, {
      totalCount: results.length,
      hasMore: results.length > limit,
    });
  };

  return { definition, handler };
}
