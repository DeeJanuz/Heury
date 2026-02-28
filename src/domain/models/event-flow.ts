import { randomUUID } from 'node:crypto';

export interface EventFlow {
  readonly id: string;
  readonly codeUnitId: string;
  readonly eventName: string;
  readonly direction: 'emit' | 'subscribe';
  readonly framework: string;
  readonly lineNumber: number;
}

interface CreateEventFlowParams {
  id?: string;
  codeUnitId: string;
  eventName: string;
  direction: 'emit' | 'subscribe';
  framework: string;
  lineNumber: number;
}

export function createEventFlow(params: CreateEventFlowParams): EventFlow {
  if (!params.codeUnitId) throw new Error('codeUnitId must not be empty');
  if (!params.eventName) throw new Error('eventName must not be empty');
  if (!params.framework) throw new Error('framework must not be empty');
  if (params.lineNumber < 1) throw new Error('lineNumber must be >= 1');
  return {
    id: params.id ?? randomUUID(),
    codeUnitId: params.codeUnitId,
    eventName: params.eventName,
    direction: params.direction,
    framework: params.framework,
    lineNumber: params.lineNumber,
  };
}
