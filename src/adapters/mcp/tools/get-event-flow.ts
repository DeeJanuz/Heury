/**
 * MCP tool: get-event-flow
 * Query event emissions and subscriptions.
 */

import type { IEventFlowRepository, ICodeUnitRepository } from '@/domain/ports/index.js';
import { buildToolResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  eventFlowRepo: IEventFlowRepository;
  codeUnitRepo: ICodeUnitRepository;
}

export function createGetEventFlowTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-event-flow',
    description:
      'Query event emissions and subscriptions by event name, direction, or framework.',
    inputSchema: {
      type: 'object',
      properties: {
        event_name: {
          type: 'string',
          description: 'Filter by event name',
        },
        direction: {
          type: 'string',
          enum: ['emit', 'subscribe'],
          description: 'Filter by direction',
        },
        framework: {
          type: 'string',
          description: 'Filter by framework (node-events, socket.io, etc.)',
        },
        unit_id: {
          type: 'string',
          description: 'Filter by code unit ID',
        },
      },
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const unitId = args.unit_id as string | undefined;
    const eventName = args.event_name as string | undefined;
    const direction = args.direction as string | undefined;
    const framework = args.framework as string | undefined;

    let flows = unitId
      ? deps.eventFlowRepo.findByCodeUnitId(unitId)
      : deps.eventFlowRepo.findAll();

    if (eventName) {
      flows = flows.filter((f) => f.eventName === eventName);
    }
    if (direction) {
      flows = flows.filter((f) => f.direction === direction);
    }
    if (framework) {
      flows = flows.filter((f) => f.framework === framework);
    }

    // Build a unit lookup for enrichment
    const unitMap = new Map(
      deps.codeUnitRepo.findAll().map((u) => [u.id, u]),
    );

    const data = flows.map((flow) => {
      const unit = unitMap.get(flow.codeUnitId);
      return {
        eventName: flow.eventName,
        direction: flow.direction,
        framework: flow.framework,
        lineNumber: flow.lineNumber,
        codeUnitId: flow.codeUnitId,
        functionName: unit?.name,
        filePath: unit?.filePath,
      };
    });

    return buildToolResponse(data, { resultCount: data.length });
  };

  return { definition, handler };
}
