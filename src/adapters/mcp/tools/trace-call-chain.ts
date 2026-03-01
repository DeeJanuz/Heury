/**
 * MCP tool: trace-call-chain
 * Trace function call chains forward (callees) or backward (callers).
 */

import type { IFunctionCallRepository, ICodeUnitRepository, IFileSystem } from '@/domain/ports/index.js';
import type { CodeUnit } from '@/domain/models/index.js';
import { buildToolResponse, buildErrorResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';
import { extractSourceForUnit } from '../source-extractor.js';

interface Dependencies {
  functionCallRepo: IFunctionCallRepository;
  codeUnitRepo: ICodeUnitRepository;
  fileSystem?: IFileSystem;
}

interface ChainNode {
  name: string;
  filePath: string;
  unitId?: string;
  isAsync: boolean;
  depth: number;
  children: ChainNode[];
  source?: string;
}

function traceCallees(
  unitId: string,
  currentDepth: number,
  maxDepth: number,
  functionCallRepo: IFunctionCallRepository,
  codeUnitRepo: ICodeUnitRepository,
  visited: Set<string>,
): ChainNode[] {
  if (currentDepth >= maxDepth) return [];

  const calls = functionCallRepo.findByCallerUnitId(unitId);
  const nodes: ChainNode[] = [];

  for (const call of calls) {
    const calleeUnit = call.calleeUnitId
      ? codeUnitRepo.findById(call.calleeUnitId)
      : undefined;

    const nodeId = call.calleeUnitId ?? call.calleeName;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const children =
      call.calleeUnitId && currentDepth + 1 < maxDepth
        ? traceCallees(call.calleeUnitId, currentDepth + 1, maxDepth, functionCallRepo, codeUnitRepo, visited)
        : [];

    nodes.push({
      name: calleeUnit?.name ?? call.calleeName,
      filePath: calleeUnit?.filePath ?? call.calleeFilePath ?? '',
      unitId: call.calleeUnitId,
      isAsync: call.isAsync,
      depth: currentDepth + 1,
      children,
    });
  }

  return nodes;
}

function traceCallers(
  unit: CodeUnit,
  currentDepth: number,
  maxDepth: number,
  functionCallRepo: IFunctionCallRepository,
  codeUnitRepo: ICodeUnitRepository,
  visited: Set<string>,
): ChainNode[] {
  if (currentDepth >= maxDepth) return [];

  // Find calls where this unit is the callee (by unitId or name)
  const byUnitId = functionCallRepo.findByCalleeUnitId(unit.id);
  const byName = functionCallRepo.findByCalleeName(unit.name);

  // Deduplicate by caller unit id
  const seen = new Set<string>();
  const allCalls = [...byUnitId, ...byName].filter((call) => {
    if (seen.has(call.id)) return false;
    seen.add(call.id);
    return true;
  });

  const nodes: ChainNode[] = [];

  for (const call of allCalls) {
    if (visited.has(call.callerUnitId)) continue;
    visited.add(call.callerUnitId);

    const callerUnit = codeUnitRepo.findById(call.callerUnitId);

    const children =
      callerUnit && currentDepth + 1 < maxDepth
        ? traceCallers(callerUnit, currentDepth + 1, maxDepth, functionCallRepo, codeUnitRepo, visited)
        : [];

    nodes.push({
      name: callerUnit?.name ?? call.callerUnitId,
      filePath: callerUnit?.filePath ?? '',
      unitId: call.callerUnitId,
      isAsync: call.isAsync,
      depth: currentDepth + 1,
      children,
    });
  }

  return nodes;
}

async function enrichChainWithSource(
  nodes: ChainNode[],
  codeUnitRepo: ICodeUnitRepository,
  fileSystem: IFileSystem,
): Promise<void> {
  for (const node of nodes) {
    if (node.unitId) {
      const codeUnit = codeUnitRepo.findById(node.unitId);
      if (codeUnit) {
        const source = await extractSourceForUnit(fileSystem, {
          filePath: codeUnit.filePath,
          lineStart: codeUnit.lineStart,
          lineEnd: codeUnit.lineEnd,
        });
        if (source !== null) {
          node.source = source;
        }
      }
    }
    if (node.children.length > 0) {
      await enrichChainWithSource(node.children, codeUnitRepo, fileSystem);
    }
  }
}

export function createTraceCallChainTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'trace-call-chain',
    description:
      'Trace function call chains forward (callees) or backward (callers) with configurable depth.',
    inputSchema: {
      type: 'object',
      properties: {
        function_name: {
          type: 'string',
          description: 'Name of the function to trace',
        },
        unit_id: {
          type: 'string',
          description: 'Code unit ID (alternative to function_name)',
        },
        direction: {
          type: 'string',
          enum: ['callers', 'callees'],
          description: 'Trace direction (default: callees)',
        },
        depth: {
          type: 'number',
          description: 'Max depth to trace (default: 3, max: 10)',
        },
        include_source: {
          type: 'boolean',
          description: 'Include source code for each chain node (default: false)',
        },
      },
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const unitId = args.unit_id as string | undefined;
    const functionName = args.function_name as string | undefined;
    const direction = (args.direction as string) ?? 'callees';
    const rawDepth = typeof args.depth === 'number' ? args.depth : 3;
    const maxDepth = Math.min(Math.max(rawDepth, 1), 10);

    if (!unitId && !functionName) {
      return buildErrorResponse(
        'Either unit_id or function_name must be provided.',
      );
    }

    let unit: CodeUnit | undefined;

    if (unitId) {
      unit = deps.codeUnitRepo.findById(unitId);
      if (!unit) {
        return buildErrorResponse(`Code unit with id "${unitId}" not found.`);
      }
    } else if (functionName) {
      const matches = deps.codeUnitRepo
        .findAll()
        .filter((u) => u.name === functionName);
      if (matches.length === 0) {
        return buildErrorResponse(
          `No code unit with name "${functionName}" not found.`,
        );
      }
      unit = matches[0];
    }

    const root = {
      name: unit!.name,
      filePath: unit!.filePath,
      unitId: unit!.id,
    };

    const visited = new Set<string>([unit!.id]);
    const chain =
      direction === 'callers'
        ? traceCallers(unit!, 0, maxDepth, deps.functionCallRepo, deps.codeUnitRepo, visited)
        : traceCallees(unit!.id, 0, maxDepth, deps.functionCallRepo, deps.codeUnitRepo, visited);

    const includeSource = args.include_source === true;
    if (includeSource && deps.fileSystem) {
      await enrichChainWithSource(chain, deps.codeUnitRepo, deps.fileSystem);
    }

    return buildToolResponse({ root, chain });
  };

  return { definition, handler };
}
