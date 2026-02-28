/**
 * MCP tool: get-function-context
 * Aggregated view of a single function — everything an LLM needs about it.
 */

import type {
  ICodeUnitRepository,
  IFunctionCallRepository,
  ITypeFieldRepository,
  IEventFlowRepository,
  IUnitSummaryRepository,
} from '@/domain/ports/index.js';
import type { CodeUnit } from '@/domain/models/index.js';
import { buildToolResponse, buildErrorResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  codeUnitRepo: ICodeUnitRepository;
  functionCallRepo: IFunctionCallRepository;
  typeFieldRepo: ITypeFieldRepository;
  eventFlowRepo: IEventFlowRepository;
  unitSummaryRepo?: IUnitSummaryRepository;
}

export function createGetFunctionContextTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-function-context',
    description:
      'Complete context for a function: signature, calls, callers, events, types, summary.',
    inputSchema: {
      type: 'object',
      properties: {
        unit_id: {
          type: 'string',
          description: 'Code unit ID',
        },
        function_name: {
          type: 'string',
          description: 'Function name (alternative to unit_id)',
        },
        file_path: {
          type: 'string',
          description: 'File path to disambiguate function_name',
        },
      },
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const unitId = args.unit_id as string | undefined;
    const functionName = args.function_name as string | undefined;
    const filePath = args.file_path as string | undefined;

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
      let matches = deps.codeUnitRepo
        .findAll()
        .filter((u) => u.name === functionName);

      if (filePath) {
        matches = matches.filter((u) => u.filePath === filePath);
      }

      if (matches.length === 0) {
        return buildErrorResponse(
          `No code unit with name "${functionName}" not found.`,
        );
      }
      unit = matches[0];
    }

    // Outgoing calls (this unit calls others)
    const outgoingCalls = deps.functionCallRepo
      .findByCallerUnitId(unit!.id)
      .map((call) => ({
        calleeName: call.calleeName,
        calleeFilePath: call.calleeFilePath,
        calleeUnitId: call.calleeUnitId,
        isAsync: call.isAsync,
        lineNumber: call.lineNumber,
      }));

    // Incoming calls (others call this unit)
    const byUnitId = deps.functionCallRepo.findByCalleeUnitId(unit!.id);
    const byName = deps.functionCallRepo.findByCalleeName(unit!.name);

    // Deduplicate
    const seenCallIds = new Set<string>();
    const incomingCallsRaw = [...byUnitId, ...byName].filter((call) => {
      if (seenCallIds.has(call.id)) return false;
      seenCallIds.add(call.id);
      return true;
    });

    const unitMap = new Map(
      deps.codeUnitRepo.findAll().map((u) => [u.id, u]),
    );

    const incomingCalls = incomingCallsRaw.map((call) => {
      const callerUnit = unitMap.get(call.callerUnitId);
      return {
        callerName: callerUnit?.name ?? call.callerUnitId,
        callerFilePath: callerUnit?.filePath,
        callerUnitId: call.callerUnitId,
        isAsync: call.isAsync,
        lineNumber: call.lineNumber,
      };
    });

    // Event flows
    const eventFlows = deps.eventFlowRepo
      .findByCodeUnitId(unit!.id)
      .map((flow) => ({
        eventName: flow.eventName,
        direction: flow.direction,
        framework: flow.framework,
        lineNumber: flow.lineNumber,
      }));

    // Type fields
    const typeFields = deps.typeFieldRepo
      .findByParentUnitId(unit!.id)
      .map((field) => ({
        name: field.name,
        fieldType: field.fieldType,
        isOptional: field.isOptional,
        isReadonly: field.isReadonly,
        lineNumber: field.lineNumber,
      }));

    // Summary
    const summary = deps.unitSummaryRepo
      ? deps.unitSummaryRepo.findByCodeUnitId(unit!.id) ?? null
      : null;

    const summaryData = summary
      ? {
          summary: summary.summary,
          keyBehaviors: summary.keyBehaviors,
          sideEffects: summary.sideEffects,
          providerModel: summary.providerModel,
          generatedAt: summary.generatedAt,
        }
      : null;

    const data = {
      unit: {
        id: unit!.id,
        name: unit!.name,
        unitType: unit!.unitType,
        filePath: unit!.filePath,
        lineStart: unit!.lineStart,
        lineEnd: unit!.lineEnd,
        signature: unit!.signature,
        isAsync: unit!.isAsync,
        isExported: unit!.isExported,
        language: unit!.language,
        complexityScore: unit!.complexityScore,
      },
      outgoingCalls,
      incomingCalls,
      eventFlows,
      typeFields,
      summary: summaryData,
    };

    return buildToolResponse(data);
  };

  return { definition, handler };
}
