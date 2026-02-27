/**
 * MCP tool: get-dependencies
 * Get file dependency information.
 */

import type { IFileDependencyRepository } from '@/domain/ports/index.js';
import { buildToolResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  dependencyRepo: IFileDependencyRepository;
}

export function createGetDependenciesTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-dependencies',
    description: 'Get file dependency information with optional filtering by source or target file.',
    inputSchema: {
      type: 'object',
      properties: {
        source_file: { type: 'string', description: 'Filter by source file path' },
        target_file: { type: 'string', description: 'Filter by target file path' },
        limit: { type: 'number', description: 'Max results (default 100)' },
      },
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    let allDeps;

    if (args.source_file) {
      allDeps = deps.dependencyRepo.findBySourceFile(String(args.source_file));
    } else if (args.target_file) {
      allDeps = deps.dependencyRepo.findByTargetFile(String(args.target_file));
    } else {
      allDeps = deps.dependencyRepo.findAll();
    }

    const limit = typeof args.limit === 'number' ? args.limit : 100;
    const limited = allDeps.slice(0, limit);

    return buildToolResponse(limited, {
      totalCount: allDeps.length,
      hasMore: allDeps.length > limit,
    });
  };

  return { definition, handler };
}
