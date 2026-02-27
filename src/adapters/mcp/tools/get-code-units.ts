/**
 * MCP tool: get-code-units
 * Get code units with filtering.
 */

import type { ICodeUnitRepository } from '@/domain/ports/index.js';
import type { CodeUnit } from '@/domain/models/index.js';
import { buildToolResponse } from '../response-builder.js';
import { stripDefaults } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  codeUnitRepo: ICodeUnitRepository;
}

function toCompact(unit: CodeUnit): Record<string, unknown> {
  return {
    name: unit.name,
    unitType: unit.unitType,
    filePath: unit.filePath,
    lineStart: unit.lineStart,
    lineEnd: unit.lineEnd,
    isExported: unit.isExported,
    language: unit.language,
  };
}

function toFull(unit: CodeUnit): Record<string, unknown> {
  return {
    id: unit.id,
    name: unit.name,
    unitType: unit.unitType,
    filePath: unit.filePath,
    lineStart: unit.lineStart,
    lineEnd: unit.lineEnd,
    parentUnitId: unit.parentUnitId,
    signature: unit.signature,
    isAsync: unit.isAsync,
    isExported: unit.isExported,
    language: unit.language,
    complexity: unit.complexity,
    complexityScore: unit.complexityScore,
    patterns: unit.patterns,
    children: unit.children,
  };
}

export function createGetCodeUnitsTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-code-units',
    description: 'Get code units with filtering by file path, name, type, language, complexity, and export status.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Filter by file path' },
        name: { type: 'string', description: 'Filter by name' },
        unit_type: { type: 'string', description: 'Filter by unit type (FUNCTION, CLASS, etc.)' },
        language: { type: 'string', description: 'Filter by language' },
        min_complexity: { type: 'number', description: 'Minimum complexity score' },
        is_exported: { type: 'boolean', description: 'Filter by export status' },
        limit: { type: 'number', description: 'Max results (default 100)' },
        offset: { type: 'number', description: 'Offset for pagination' },
        format: { type: 'string', enum: ['compact', 'full'], description: 'Response format (default: compact)' },
      },
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    let units = deps.codeUnitRepo.findAll();

    if (args.file_path) {
      units = units.filter((u) => u.filePath === args.file_path);
    }
    if (args.name) {
      const name = String(args.name).toLowerCase();
      units = units.filter((u) => u.name.toLowerCase().includes(name));
    }
    if (args.unit_type) {
      units = units.filter((u) => u.unitType === args.unit_type);
    }
    if (args.language) {
      units = units.filter((u) => u.language === args.language);
    }
    if (typeof args.min_complexity === 'number') {
      units = units.filter((u) => u.complexityScore >= (args.min_complexity as number));
    }
    if (typeof args.is_exported === 'boolean') {
      units = units.filter((u) => u.isExported === args.is_exported);
    }

    const totalCount = units.length;
    const offset = typeof args.offset === 'number' ? args.offset : 0;
    const limit = typeof args.limit === 'number' ? args.limit : 100;
    units = units.slice(offset, offset + limit);

    const format = args.format === 'full' ? 'full' : 'compact';
    const mapper = format === 'full' ? toFull : toCompact;
    const data = units.map(mapper);

    return buildToolResponse(data, {
      totalCount,
      hasMore: offset + limit < totalCount,
    });
  };

  return { definition, handler };
}
