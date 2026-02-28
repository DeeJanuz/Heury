import { describe, it, expect } from 'vitest';
import { extractFunctionCalls } from '@/extraction/call-graph-extractor.js';

describe('extractFunctionCalls', () => {
  it('should extract basic function calls', () => {
    const body = `
const result = doSomething(arg1, arg2);
processData(result);
`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ calleeName: 'doSomething', lineNumber: 2, isAsync: false });
    expect(calls[1]).toMatchObject({ calleeName: 'processData', lineNumber: 3, isAsync: false });
  });

  it('should detect async calls with await', () => {
    const body = `const data = await fetchData(url);`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ calleeName: 'fetchData', isAsync: true, lineNumber: 1 });
  });

  it('should extract method calls on this', () => {
    const body = `this.handleEvent(e);`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(1);
    expect(calls[0].calleeName).toBe('this.handleEvent');
  });

  it('should extract method calls on objects', () => {
    const body = `
const result = service.getData(id);
logger.info(message);
`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(2);
    expect(calls[0].calleeName).toBe('service.getData');
    expect(calls[1].calleeName).toBe('logger.info');
  });

  it('should extract constructor calls with new', () => {
    const body = `
const instance = new MyService(config);
const err = new Error('failed');
`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(2);
    expect(calls[0].calleeName).toBe('new MyService');
    expect(calls[1].calleeName).toBe('new Error');
  });

  it('should skip keyword calls', () => {
    const body = `
if (condition) {
  for (let i = 0; i < 10; i++) {
    while (true) {
      switch (val) {
        case 1: break;
      }
    }
  }
}
return(result);
throw(error);
typeof(x);
`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(0);
  });

  it('should skip import and require', () => {
    const body = `
import('module');
require('lodash');
`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(0);
  });

  it('should skip single-line comment lines', () => {
    const body = `
// doSomething(arg);
realCall(arg);
`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(1);
    expect(calls[0].calleeName).toBe('realCall');
  });

  it('should skip block comment lines', () => {
    const body = `
/*
  fakeCall(arg);
  anotherFake(arg);
*/
realCall(arg);
`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(1);
    expect(calls[0].calleeName).toBe('realCall');
  });

  it('should return empty array for empty input', () => {
    expect(extractFunctionCalls('')).toHaveLength(0);
  });

  it('should return empty array for comments-only input', () => {
    const body = `
// just a comment
/* block comment */
`;
    expect(extractFunctionCalls(body)).toHaveLength(0);
  });

  it('should handle multiple calls on the same line', () => {
    const body = `const x = foo(bar(baz()));`;
    const calls = extractFunctionCalls(body);
    expect(calls.length).toBeGreaterThanOrEqual(3);
    const names = calls.map((c) => c.calleeName);
    expect(names).toContain('foo');
    expect(names).toContain('bar');
    expect(names).toContain('baz');
  });

  it('should track correct line numbers', () => {
    const body = `first(1);
second(2);
third(3);`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(3);
    expect(calls[0].lineNumber).toBe(1);
    expect(calls[1].lineNumber).toBe(2);
    expect(calls[2].lineNumber).toBe(3);
  });

  it('should deduplicate calls by calleeName + lineNumber', () => {
    // Same function call matched multiple ways shouldn't produce duplicates
    const body = `doThing(arg);`;
    const calls = extractFunctionCalls(body);
    const uniqueKeys = new Set(calls.map((c) => `${c.calleeName}:${c.lineNumber}`));
    expect(uniqueKeys.size).toBe(calls.length);
  });

  it('should handle chained method calls', () => {
    const body = `arr.filter(x => x > 0).map(x => x * 2);`;
    const calls = extractFunctionCalls(body);
    const names = calls.map((c) => c.calleeName);
    expect(names).toContain('arr.filter');
  });

  it('should handle await with method calls', () => {
    const body = `const res = await this.service.fetch(url);`;
    const calls = extractFunctionCalls(body);
    const asyncCalls = calls.filter((c) => c.isAsync);
    expect(asyncCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('should not treat catch as a function call', () => {
    const body = `
try {
  doWork();
} catch (error) {
  handleError(error);
}
`;
    const calls = extractFunctionCalls(body);
    const names = calls.map((c) => c.calleeName);
    expect(names).not.toContain('catch');
    expect(names).toContain('doWork');
    expect(names).toContain('handleError');
  });

  it('should handle mixed async and sync calls', () => {
    const body = `
const a = syncCall(1);
const b = await asyncCall(2);
const c = anotherSync(3);
`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(3);
    expect(calls[0].isAsync).toBe(false);
    expect(calls[1].isAsync).toBe(true);
    expect(calls[2].isAsync).toBe(false);
  });

  it('should skip instanceof keyword', () => {
    const body = `instanceof (SomeClass)`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(0);
  });

  it('should return empty array for whitespace-only input', () => {
    expect(extractFunctionCalls('   \n  \n  ')).toHaveLength(0);
  });

  it('should extract real calls on lines with string literals', () => {
    const body = `console.log("hello world")`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(1);
    expect(calls[0].calleeName).toBe('console.log');
  });

  it('should extract new Error inside throw', () => {
    const body = `throw new Error("oops")`;
    const calls = extractFunctionCalls(body);
    const names = calls.map((c) => c.calleeName);
    expect(names).toContain('new Error');
    expect(names).not.toContain('throw');
  });

  it('should handle block comment that starts and ends on same line', () => {
    const body = `/* skip() */ realCall()`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(1);
    expect(calls[0].calleeName).toBe('realCall');
  });

  it('should not deduplicate same calleeName on different lines', () => {
    const body = `foo()\nfoo()`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(2);
    expect(calls[0].lineNumber).toBe(1);
    expect(calls[1].lineNumber).toBe(2);
  });

  it('should return objects with correct shape', () => {
    const body = `await foo()`;
    const calls = extractFunctionCalls(body);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveProperty('calleeName');
    expect(calls[0]).toHaveProperty('lineNumber');
    expect(calls[0]).toHaveProperty('isAsync');
    expect(typeof calls[0].calleeName).toBe('string');
    expect(typeof calls[0].lineNumber).toBe('number');
    expect(typeof calls[0].isAsync).toBe('boolean');
  });
});
