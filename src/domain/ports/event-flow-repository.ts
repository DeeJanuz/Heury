import type { EventFlow } from '@/domain/models/index.js';

export interface IEventFlowRepository {
  save(flow: EventFlow): void;
  saveBatch(flows: EventFlow[]): void;
  findByCodeUnitId(codeUnitId: string): EventFlow[];
  findByEventName(eventName: string): EventFlow[];
  findAll(): EventFlow[];
  deleteByCodeUnitId(codeUnitId: string): void;
  clear(): void;
}
