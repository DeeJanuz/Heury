/**
 * MCP tool: get-function-guards
 * Query guard clauses detected in functions, enriched with function name and file path.
 */

import type { IGuardClauseRepository, ICodeUnitRepository } from '@/domain/ports/index.js';
import { buildToolResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  guardClauseRepo: IGuardClauseRepository;
  codeUnitRepo: ICodeUnitRepository;
}

interface GuardOutput {
  functionName: string;
  filePath: string;
  guardType: string;
  condition: string;
  lineNumber: number;
}

export function createGetFunctionGuardsTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-function-guards',
    description:
      'Query guard clauses detected in functions. Filter by code unit ID, file path, or guard type.',
    inputSchema: {
      type: 'object',
      properties: {
        unit_id: {
          type: 'string',
          description: 'Filter guards by a specific code unit ID',
        },
        file_path: {
          type: 'string',
          description: 'Filter guards by file path (matches code units in that file)',
        },
        guard_type: {
          type: 'string',
          description:
            'Filter by guard type (e.g. null_check, type_check, validation)',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 100)',
        },
      },
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const unitId = typeof args.unit_id === 'string' ? args.unit_id : undefined;
    const filePath = typeof args.file_path === 'string' ? args.file_path : undefined;
    const guardType = typeof args.guard_type === 'string' ? args.guard_type : undefined;
    const limit = typeof args.limit === 'number' ? args.limit : 100;

    let guards;

    if (unitId) {
      guards = deps.guardClauseRepo.findByCodeUnitId(unitId);
    } else if (guardType) {
      guards = deps.guardClauseRepo.findByGuardType(guardType);
    } else if (filePath) {
      const units = deps.codeUnitRepo.findByFilePath(filePath);
      guards = units.flatMap((u) => deps.guardClauseRepo.findByCodeUnitId(u.id));
    } else {
      guards = deps.guardClauseRepo.findAll();
    }

    // Enrich with code unit context, skip orphan guards
    const results: GuardOutput[] = [];
    for (const guard of guards) {
      const unit = deps.codeUnitRepo.findById(guard.codeUnitId);
      if (!unit) continue;

      results.push({
        functionName: unit.name,
        filePath: unit.filePath,
        guardType: guard.guardType,
        condition: guard.condition,
        lineNumber: guard.lineNumber,
      });
    }

    const limited = results.slice(0, limit);

    return buildToolResponse(limited, {
      totalCount: results.length,
      hasMore: results.length > limit,
    });
  };

  return { definition, handler };
}
