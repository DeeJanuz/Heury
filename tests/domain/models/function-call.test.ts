import { describe, it, expect } from 'vitest';
import { createFunctionCall } from '@/domain/models/function-call.js';

describe('createFunctionCall', () => {
  it('should create a function call with required fields and defaults', () => {
    const call = createFunctionCall({
      callerUnitId: 'caller-1',
      calleeName: 'doSomething',
      lineNumber: 10,
      isAsync: false,
    });

    expect(call.callerUnitId).toBe('caller-1');
    expect(call.calleeName).toBe('doSomething');
    expect(call.lineNumber).toBe(10);
    expect(call.isAsync).toBe(false);
    expect(call.id).toBeDefined();
    expect(call.calleeFilePath).toBeUndefined();
    expect(call.calleeUnitId).toBeUndefined();
  });

  it('should use provided id when given', () => {
    const call = createFunctionCall({
      id: 'custom-id',
      callerUnitId: 'caller-1',
      calleeName: 'doSomething',
      lineNumber: 5,
      isAsync: true,
    });

    expect(call.id).toBe('custom-id');
  });

  it('should include optional fields when provided', () => {
    const call = createFunctionCall({
      callerUnitId: 'caller-1',
      calleeName: 'doSomething',
      calleeFilePath: 'src/utils.ts',
      calleeUnitId: 'callee-1',
      lineNumber: 15,
      isAsync: true,
    });

    expect(call.calleeFilePath).toBe('src/utils.ts');
    expect(call.calleeUnitId).toBe('callee-1');
    expect(call.isAsync).toBe(true);
  });

  it('should throw when callerUnitId is empty', () => {
    expect(() =>
      createFunctionCall({
        callerUnitId: '',
        calleeName: 'doSomething',
        lineNumber: 1,
        isAsync: false,
      }),
    ).toThrow('callerUnitId must not be empty');
  });

  it('should throw when calleeName is empty', () => {
    expect(() =>
      createFunctionCall({
        callerUnitId: 'caller-1',
        calleeName: '',
        lineNumber: 1,
        isAsync: false,
      }),
    ).toThrow('calleeName must not be empty');
  });

  it('should throw when lineNumber is less than 1', () => {
    expect(() =>
      createFunctionCall({
        callerUnitId: 'caller-1',
        calleeName: 'doSomething',
        lineNumber: 0,
        isAsync: false,
      }),
    ).toThrow('lineNumber must be >= 1');
  });
});
