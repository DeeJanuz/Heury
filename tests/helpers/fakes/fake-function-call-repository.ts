import type { FunctionCall } from '@/domain/models/index.js';
import type { IFunctionCallRepository } from '@/domain/ports/index.js';

export class InMemoryFunctionCallRepository implements IFunctionCallRepository {
  private readonly calls = new Map<string, FunctionCall>();

  save(call: FunctionCall): void {
    this.calls.set(call.id, call);
  }

  saveBatch(calls: FunctionCall[]): void {
    for (const call of calls) {
      this.save(call);
    }
  }

  findByCallerUnitId(callerUnitId: string): FunctionCall[] {
    return [...this.calls.values()].filter((c) => c.callerUnitId === callerUnitId);
  }

  findByCalleeName(calleeName: string): FunctionCall[] {
    return [...this.calls.values()].filter((c) => c.calleeName === calleeName);
  }

  findByCalleeUnitId(calleeUnitId: string): FunctionCall[] {
    return [...this.calls.values()].filter((c) => c.calleeUnitId === calleeUnitId);
  }

  findAll(): FunctionCall[] {
    return [...this.calls.values()];
  }

  deleteByCallerUnitId(callerUnitId: string): void {
    for (const [id, call] of this.calls) {
      if (call.callerUnitId === callerUnitId) {
        this.calls.delete(id);
      }
    }
  }

  clear(): void {
    this.calls.clear();
  }
}
