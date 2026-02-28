import { describe, it, expect } from 'vitest';
import { createEventFlow } from '@/domain/models/event-flow.js';

describe('createEventFlow', () => {
  it('should create an event flow with all required fields', () => {
    const flow = createEventFlow({
      codeUnitId: 'unit-1',
      eventName: 'user.created',
      direction: 'emit',
      framework: 'EventEmitter',
      lineNumber: 20,
    });

    expect(flow.codeUnitId).toBe('unit-1');
    expect(flow.eventName).toBe('user.created');
    expect(flow.direction).toBe('emit');
    expect(flow.framework).toBe('EventEmitter');
    expect(flow.lineNumber).toBe(20);
    expect(flow.id).toBeDefined();
  });

  it('should use provided id when given', () => {
    const flow = createEventFlow({
      id: 'custom-id',
      codeUnitId: 'unit-1',
      eventName: 'data.updated',
      direction: 'subscribe',
      framework: 'RxJS',
      lineNumber: 15,
    });

    expect(flow.id).toBe('custom-id');
  });

  it('should accept subscribe direction', () => {
    const flow = createEventFlow({
      codeUnitId: 'unit-1',
      eventName: 'order.completed',
      direction: 'subscribe',
      framework: 'Redis',
      lineNumber: 8,
    });

    expect(flow.direction).toBe('subscribe');
  });

  it('should throw when codeUnitId is empty', () => {
    expect(() =>
      createEventFlow({
        codeUnitId: '',
        eventName: 'test.event',
        direction: 'emit',
        framework: 'EventEmitter',
        lineNumber: 1,
      }),
    ).toThrow('codeUnitId must not be empty');
  });

  it('should throw when eventName is empty', () => {
    expect(() =>
      createEventFlow({
        codeUnitId: 'unit-1',
        eventName: '',
        direction: 'emit',
        framework: 'EventEmitter',
        lineNumber: 1,
      }),
    ).toThrow('eventName must not be empty');
  });

  it('should throw when framework is empty', () => {
    expect(() =>
      createEventFlow({
        codeUnitId: 'unit-1',
        eventName: 'test.event',
        direction: 'emit',
        framework: '',
        lineNumber: 1,
      }),
    ).toThrow('framework must not be empty');
  });

  it('should throw when lineNumber is less than 1', () => {
    expect(() =>
      createEventFlow({
        codeUnitId: 'unit-1',
        eventName: 'test.event',
        direction: 'emit',
        framework: 'EventEmitter',
        lineNumber: 0,
      }),
    ).toThrow('lineNumber must be >= 1');
  });
});
