/**
 * MCP tool: get-unit-summaries
 * Expose LLM-generated unit summaries joined with code unit context.
 */

import type { IUnitSummaryRepository, ICodeUnitRepository } from '@/domain/ports/index.js';
import { buildToolResponse, stripDefaults } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  unitSummaryRepo: IUnitSummaryRepository;
  codeUnitRepo: ICodeUnitRepository;
}

export function createGetUnitSummariesTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-unit-summaries',
    description:
      'Get LLM-generated summaries for code units, including key behaviors and side effects.',
    inputSchema: {
      type: 'object',
      properties: {
        unit_id: {
          type: 'string',
          description: 'Filter by code unit ID',
        },
        file_path: {
          type: 'string',
          description: 'Filter by file path',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return',
        },
      },
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const unitId = args.unit_id as string | undefined;
    const filePath = args.file_path as string | undefined;
    const limit = args.limit as number | undefined;

    interface SummaryResult {
      name: string;
      filePath: string;
      unitType: string;
      summary: string;
      keyBehaviors: string[];
      sideEffects: string[];
    }

    let results: SummaryResult[];

    if (unitId) {
      // Find summary for a specific unit
      const summary = deps.unitSummaryRepo.findByCodeUnitId(unitId);
      if (!summary) {
        return buildToolResponse([]);
      }
      const unit = deps.codeUnitRepo.findById(unitId);
      if (!unit) {
        return buildToolResponse([]);
      }
      results = [
        {
          name: unit.name,
          filePath: unit.filePath,
          unitType: unit.unitType,
          summary: summary.summary,
          keyBehaviors: summary.keyBehaviors,
          sideEffects: summary.sideEffects,
        },
      ];
    } else if (filePath) {
      // Find code units by file path, then get summaries for each
      const units = deps.codeUnitRepo.findByFilePath(filePath);
      results = [];
      for (const unit of units) {
        const summary = deps.unitSummaryRepo.findByCodeUnitId(unit.id);
        if (summary) {
          results.push({
            name: unit.name,
            filePath: unit.filePath,
            unitType: unit.unitType,
            summary: summary.summary,
            keyBehaviors: summary.keyBehaviors,
            sideEffects: summary.sideEffects,
          });
        }
      }
    } else {
      // Return all summaries joined with code units
      const allSummaries = deps.unitSummaryRepo.findAll();
      const unitMap = new Map(
        deps.codeUnitRepo.findAll().map((u) => [u.id, u]),
      );

      results = [];
      for (const summary of allSummaries) {
        const unit = unitMap.get(summary.codeUnitId);
        if (unit) {
          results.push({
            name: unit.name,
            filePath: unit.filePath,
            unitType: unit.unitType,
            summary: summary.summary,
            keyBehaviors: summary.keyBehaviors,
            sideEffects: summary.sideEffects,
          });
        }
      }
    }

    if (limit !== undefined && limit > 0) {
      results = results.slice(0, limit);
    }

    return buildToolResponse(stripDefaults(results) as unknown[]);
  };

  return { definition, handler };
}
