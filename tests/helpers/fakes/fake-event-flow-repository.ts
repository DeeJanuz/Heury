import type { EventFlow } from '@/domain/models/index.js';
import type { IEventFlowRepository } from '@/domain/ports/index.js';

export class InMemoryEventFlowRepository implements IEventFlowRepository {
  private readonly flows = new Map<string, EventFlow>();

  save(flow: EventFlow): void {
    this.flows.set(flow.id, flow);
  }

  saveBatch(flows: EventFlow[]): void {
    for (const flow of flows) {
      this.save(flow);
    }
  }

  findByCodeUnitId(codeUnitId: string): EventFlow[] {
    return [...this.flows.values()].filter((f) => f.codeUnitId === codeUnitId);
  }

  findByEventName(eventName: string): EventFlow[] {
    return [...this.flows.values()].filter((f) => f.eventName === eventName);
  }

  findAll(): EventFlow[] {
    return [...this.flows.values()];
  }

  deleteByCodeUnitId(codeUnitId: string): void {
    for (const [id, flow] of this.flows) {
      if (flow.codeUnitId === codeUnitId) {
        this.flows.delete(id);
      }
    }
  }

  clear(): void {
    this.flows.clear();
  }
}
