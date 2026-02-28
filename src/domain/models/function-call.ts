import { randomUUID } from 'node:crypto';

export interface FunctionCall {
  readonly id: string;
  readonly callerUnitId: string;
  readonly calleeName: string;
  readonly calleeFilePath?: string;
  readonly calleeUnitId?: string;
  readonly lineNumber: number;
  readonly isAsync: boolean;
}

interface CreateFunctionCallParams {
  id?: string;
  callerUnitId: string;
  calleeName: string;
  calleeFilePath?: string;
  calleeUnitId?: string;
  lineNumber: number;
  isAsync: boolean;
}

export function createFunctionCall(params: CreateFunctionCallParams): FunctionCall {
  if (!params.callerUnitId) throw new Error('callerUnitId must not be empty');
  if (!params.calleeName) throw new Error('calleeName must not be empty');
  if (params.lineNumber < 1) throw new Error('lineNumber must be >= 1');
  return {
    id: params.id ?? randomUUID(),
    callerUnitId: params.callerUnitId,
    calleeName: params.calleeName,
    calleeFilePath: params.calleeFilePath,
    calleeUnitId: params.calleeUnitId,
    lineNumber: params.lineNumber,
    isAsync: params.isAsync,
  };
}
