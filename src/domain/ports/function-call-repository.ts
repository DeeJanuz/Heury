import type { FunctionCall } from '@/domain/models/index.js';

export interface IFunctionCallRepository {
  save(call: FunctionCall): void;
  saveBatch(calls: FunctionCall[]): void;
  findByCallerUnitId(callerUnitId: string): FunctionCall[];
  findByCalleeName(calleeName: string): FunctionCall[];
  findByCalleeUnitId(calleeUnitId: string): FunctionCall[];
  findAll(): FunctionCall[];
  deleteByCallerUnitId(callerUnitId: string): void;
  clear(): void;
}
