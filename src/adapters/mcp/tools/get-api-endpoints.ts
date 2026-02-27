/**
 * MCP tool: get-api-endpoints
 * Get all API endpoint patterns.
 */

import type { ICodeUnitRepository } from '@/domain/ports/index.js';
import { PatternType } from '@/domain/models/index.js';
import { buildToolResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  codeUnitRepo: ICodeUnitRepository;
}

export function createGetApiEndpointsTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-api-endpoints',
    description: 'Get all API endpoint patterns with optional filtering by HTTP method or path pattern.',
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', description: 'Filter by HTTP method (GET, POST, etc.)' },
        path_pattern: { type: 'string', description: 'Filter by path pattern substring' },
        limit: { type: 'number', description: 'Max results (default 100)' },
      },
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const allUnits = deps.codeUnitRepo.findAll();
    let endpoints: Array<{
      patternType: string;
      patternValue: string;
      codeUnitName: string;
      filePath: string;
      lineNumber?: number;
    }> = [];

    for (const unit of allUnits) {
      for (const pattern of unit.patterns) {
        if (pattern.patternType === PatternType.API_ENDPOINT) {
          endpoints.push({
            patternType: pattern.patternType,
            patternValue: pattern.patternValue,
            codeUnitName: unit.name,
            filePath: unit.filePath,
            lineNumber: pattern.lineNumber,
          });
        }
      }
    }

    if (args.method) {
      const method = String(args.method).toUpperCase();
      endpoints = endpoints.filter((e) => e.patternValue.toUpperCase().startsWith(method));
    }

    if (args.path_pattern) {
      const pathPattern = String(args.path_pattern).toLowerCase();
      endpoints = endpoints.filter((e) => e.patternValue.toLowerCase().includes(pathPattern));
    }

    const limit = typeof args.limit === 'number' ? args.limit : 100;
    const limited = endpoints.slice(0, limit);

    return buildToolResponse(limited, {
      totalCount: endpoints.length,
      hasMore: endpoints.length > limit,
    });
  };

  return { definition, handler };
}
