/**
 * MCP tool: set-unit-summaries
 * Accept batch of summaries from the calling agent (which IS the LLM).
 */

import type { IUnitSummaryRepository } from '@/domain/ports/index.js';
import { createUnitSummary } from '@/domain/models/index.js';
import { buildToolResponse, buildErrorResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  unitSummaryRepo: IUnitSummaryRepository;
}

export function createSetUnitSummariesTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'set-unit-summaries',
    description:
      'Submit LLM-generated summaries for code units. The calling agent analyzes code units and submits structured summaries including key behaviors and side effects.',
    inputSchema: {
      type: 'object',
      properties: {
        summaries: {
          type: 'array',
          description: 'Array of summaries to save',
          items: {
            type: 'object',
            properties: {
              code_unit_id: { type: 'string', description: 'ID of the code unit' },
              summary: { type: 'string', description: '1-3 sentence description' },
              key_behaviors: {
                type: 'array',
                items: { type: 'string' },
                description: 'Key behaviors of the code unit',
              },
              side_effects: {
                type: 'array',
                items: { type: 'string' },
                description: 'Side effects of the code unit',
              },
            },
            required: ['code_unit_id', 'summary'],
          },
        },
      },
      required: ['summaries'],
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const summaries = args.summaries as Array<{
      code_unit_id: string;
      summary: string;
      key_behaviors?: string[];
      side_effects?: string[];
    }>;

    if (!Array.isArray(summaries) || summaries.length === 0) {
      return buildErrorResponse('summaries must be a non-empty array');
    }

    let saved = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const entry of summaries) {
      try {
        const unitSummary = createUnitSummary({
          codeUnitId: entry.code_unit_id,
          summary: entry.summary,
          keyBehaviors: entry.key_behaviors ?? [],
          sideEffects: entry.side_effects ?? [],
          providerModel: 'mcp-client',
          generatedAt: new Date().toISOString(),
        });
        deps.unitSummaryRepo.save(unitSummary);
        saved++;
      } catch (error) {
        failed++;
        errors.push(
          `${entry.code_unit_id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return buildToolResponse({ saved, failed, errors: errors.length > 0 ? errors : undefined });
  };

  return { definition, handler };
}
