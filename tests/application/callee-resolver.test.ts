import { describe, it, expect, beforeEach } from 'vitest';

import {
  resolveCallees,
  extractCalleeBaseName,
} from '@/application/callee-resolver.js';
import { createCodeUnit, CodeUnitType, createFunctionCall } from '@/domain/models/index.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryFunctionCallRepository,
} from '../helpers/fakes/index.js';

function makeUnit(
  overrides: Partial<Parameters<typeof createCodeUnit>[0]> & { name: string },
) {
  return createCodeUnit({
    id: overrides.id ?? `unit-${overrides.name}`,
    filePath: overrides.filePath ?? 'src/test.ts',
    name: overrides.name,
    unitType: overrides.unitType ?? CodeUnitType.FUNCTION,
    lineStart: overrides.lineStart ?? 1,
    lineEnd: overrides.lineEnd ?? 10,
    isAsync: overrides.isAsync ?? false,
    isExported: overrides.isExported ?? true,
    language: overrides.language ?? 'typescript',
    children: overrides.children ?? [],
  });
}

function makeCall(
  overrides: Partial<Parameters<typeof createFunctionCall>[0]> & {
    callerUnitId: string;
    calleeName: string;
  },
) {
  return createFunctionCall({
    id: overrides.id,
    callerUnitId: overrides.callerUnitId,
    calleeName: overrides.calleeName,
    calleeFilePath: overrides.calleeFilePath,
    calleeUnitId: overrides.calleeUnitId,
    lineNumber: overrides.lineNumber ?? 1,
    isAsync: overrides.isAsync ?? false,
  });
}

describe('extractCalleeBaseName', () => {
  it('should return the name as-is for a simple identifier', () => {
    expect(extractCalleeBaseName('helper')).toBe('helper');
  });

  it('should return last segment after dot for dotted access', () => {
    expect(extractCalleeBaseName('service.getData')).toBe('getData');
  });

  it('should strip "this." prefix', () => {
    expect(extractCalleeBaseName('this.validate')).toBe('validate');
  });

  it('should strip "new " prefix', () => {
    expect(extractCalleeBaseName('new MyService')).toBe('MyService');
  });

  it('should return last segment for deeply nested dotted access', () => {
    expect(extractCalleeBaseName('a.b.c.foo')).toBe('foo');
  });

  it('should handle "new " with dotted path', () => {
    expect(extractCalleeBaseName('new a.b.MyClass')).toBe('MyClass');
  });

  it('should handle "this." with dotted path', () => {
    expect(extractCalleeBaseName('this.service.run')).toBe('run');
  });
});

describe('resolveCallees', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let functionCallRepo: InMemoryFunctionCallRepository;

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    functionCallRepo = new InMemoryFunctionCallRepository();
  });

  it('should resolve a single match correctly', () => {
    const helperUnit = makeUnit({ name: 'helper', id: 'unit-helper', filePath: 'src/helpers.ts' });
    codeUnitRepo.save(helperUnit);

    const call = makeCall({
      id: 'call-1',
      callerUnitId: 'unit-caller',
      calleeName: 'helper',
    });
    functionCallRepo.save(call);

    const result = resolveCallees({ codeUnitRepo, functionCallRepo });

    expect(result.resolved).toBe(1);
    expect(result.noMatch).toBe(0);
    expect(result.ambiguous).toBe(0);

    const updated = functionCallRepo.findAll();
    expect(updated[0].calleeUnitId).toBe('unit-helper');
    expect(updated[0].calleeFilePath).toBe('src/helpers.ts');
  });

  it('should prefer same-file match over different-file match', () => {
    const sameFileUnit = makeUnit({ name: 'helper', id: 'unit-same', filePath: 'src/caller.ts', isExported: false });
    const otherFileUnit = makeUnit({ name: 'helper', id: 'unit-other', filePath: 'src/other.ts', isExported: true });

    // The caller is in src/caller.ts
    const callerUnit = makeUnit({ name: 'caller', id: 'unit-caller', filePath: 'src/caller.ts' });
    codeUnitRepo.save(sameFileUnit);
    codeUnitRepo.save(otherFileUnit);
    codeUnitRepo.save(callerUnit);

    const call = makeCall({
      id: 'call-1',
      callerUnitId: 'unit-caller',
      calleeName: 'helper',
    });
    functionCallRepo.save(call);

    const result = resolveCallees({ codeUnitRepo, functionCallRepo });

    expect(result.resolved).toBe(1);
    const updated = functionCallRepo.findAll();
    expect(updated[0].calleeUnitId).toBe('unit-same');
  });

  it('should prefer exported unit over non-exported when not same-file', () => {
    const exportedUnit = makeUnit({ name: 'helper', id: 'unit-exported', filePath: 'src/a.ts', isExported: true });
    const privateUnit = makeUnit({ name: 'helper', id: 'unit-private', filePath: 'src/b.ts', isExported: false });
    codeUnitRepo.save(exportedUnit);
    codeUnitRepo.save(privateUnit);

    // Caller is in a third file
    const callerUnit = makeUnit({ name: 'caller', id: 'unit-caller', filePath: 'src/caller.ts' });
    codeUnitRepo.save(callerUnit);

    const call = makeCall({
      id: 'call-1',
      callerUnitId: 'unit-caller',
      calleeName: 'helper',
    });
    functionCallRepo.save(call);

    const result = resolveCallees({ codeUnitRepo, functionCallRepo });

    expect(result.resolved).toBe(1);
    const updated = functionCallRepo.findAll();
    expect(updated[0].calleeUnitId).toBe('unit-exported');
  });

  it('should skip ambiguous calls (multiple exported, different files)', () => {
    const unitA = makeUnit({ name: 'helper', id: 'unit-a', filePath: 'src/a.ts', isExported: true });
    const unitB = makeUnit({ name: 'helper', id: 'unit-b', filePath: 'src/b.ts', isExported: true });
    codeUnitRepo.save(unitA);
    codeUnitRepo.save(unitB);

    const call = makeCall({
      id: 'call-1',
      callerUnitId: 'unit-caller',
      calleeName: 'helper',
    });
    functionCallRepo.save(call);

    const result = resolveCallees({ codeUnitRepo, functionCallRepo });

    expect(result.ambiguous).toBe(1);
    expect(result.resolved).toBe(0);
    const updated = functionCallRepo.findAll();
    expect(updated[0].calleeUnitId).toBeUndefined();
  });

  it('should leave unresolved calls when no match found', () => {
    const call = makeCall({
      id: 'call-1',
      callerUnitId: 'unit-caller',
      calleeName: 'nonexistent',
    });
    functionCallRepo.save(call);

    const result = resolveCallees({ codeUnitRepo, functionCallRepo });

    expect(result.noMatch).toBe(1);
    expect(result.resolved).toBe(0);
    const updated = functionCallRepo.findAll();
    expect(updated[0].calleeUnitId).toBeUndefined();
  });

  it('should not re-process already-resolved calls', () => {
    const unit = makeUnit({ name: 'helper', id: 'unit-helper', filePath: 'src/helpers.ts' });
    codeUnitRepo.save(unit);

    const resolvedCall = makeCall({
      id: 'call-1',
      callerUnitId: 'unit-caller',
      calleeName: 'helper',
      calleeUnitId: 'already-resolved',
      calleeFilePath: 'src/already.ts',
    });
    functionCallRepo.save(resolvedCall);

    const result = resolveCallees({ codeUnitRepo, functionCallRepo });

    expect(result.totalUnresolved).toBe(0);
    expect(result.resolved).toBe(0);
    // Original resolution preserved
    const updated = functionCallRepo.findAll();
    expect(updated[0].calleeUnitId).toBe('already-resolved');
  });

  it('should be idempotent (running twice gives same result)', () => {
    const unit = makeUnit({ name: 'helper', id: 'unit-helper', filePath: 'src/helpers.ts' });
    codeUnitRepo.save(unit);

    const call = makeCall({
      id: 'call-1',
      callerUnitId: 'unit-caller',
      calleeName: 'helper',
    });
    functionCallRepo.save(call);

    const result1 = resolveCallees({ codeUnitRepo, functionCallRepo });
    const result2 = resolveCallees({ codeUnitRepo, functionCallRepo });

    expect(result1.resolved).toBe(1);
    expect(result2.totalUnresolved).toBe(0);
    expect(result2.resolved).toBe(0);
  });

  it('should resolve dotted callee names (e.g. service.getData)', () => {
    const unit = makeUnit({ name: 'getData', id: 'unit-getData', filePath: 'src/service.ts' });
    codeUnitRepo.save(unit);

    const call = makeCall({
      id: 'call-1',
      callerUnitId: 'unit-caller',
      calleeName: 'service.getData',
    });
    functionCallRepo.save(call);

    const result = resolveCallees({ codeUnitRepo, functionCallRepo });

    expect(result.resolved).toBe(1);
    const updated = functionCallRepo.findAll();
    expect(updated[0].calleeUnitId).toBe('unit-getData');
  });

  it('should resolve "this.method" callee names', () => {
    const unit = makeUnit({ name: 'validate', id: 'unit-validate', filePath: 'src/validator.ts' });
    codeUnitRepo.save(unit);

    const call = makeCall({
      id: 'call-1',
      callerUnitId: 'unit-caller',
      calleeName: 'this.validate',
    });
    functionCallRepo.save(call);

    const result = resolveCallees({ codeUnitRepo, functionCallRepo });

    expect(result.resolved).toBe(1);
    const updated = functionCallRepo.findAll();
    expect(updated[0].calleeUnitId).toBe('unit-validate');
  });

  it('should resolve "new ClassName" callee names', () => {
    const unit = makeUnit({
      name: 'MyService',
      id: 'unit-MyService',
      filePath: 'src/my-service.ts',
      unitType: CodeUnitType.CLASS,
    });
    codeUnitRepo.save(unit);

    const call = makeCall({
      id: 'call-1',
      callerUnitId: 'unit-caller',
      calleeName: 'new MyService',
    });
    functionCallRepo.save(call);

    const result = resolveCallees({ codeUnitRepo, functionCallRepo });

    expect(result.resolved).toBe(1);
    const updated = functionCallRepo.findAll();
    expect(updated[0].calleeUnitId).toBe('unit-MyService');
  });

  it('should report correct stats with mixed results', () => {
    // One resolvable
    const unitA = makeUnit({ name: 'found', id: 'unit-found', filePath: 'src/a.ts' });
    codeUnitRepo.save(unitA);

    // Two ambiguous targets
    const unitB1 = makeUnit({ name: 'ambig', id: 'unit-b1', filePath: 'src/b1.ts', isExported: true });
    const unitB2 = makeUnit({ name: 'ambig', id: 'unit-b2', filePath: 'src/b2.ts', isExported: true });
    codeUnitRepo.save(unitB1);
    codeUnitRepo.save(unitB2);

    functionCallRepo.save(makeCall({ id: 'c1', callerUnitId: 'x', calleeName: 'found' }));
    functionCallRepo.save(makeCall({ id: 'c2', callerUnitId: 'x', calleeName: 'ambig' }));
    functionCallRepo.save(makeCall({ id: 'c3', callerUnitId: 'x', calleeName: 'missing' }));

    const result = resolveCallees({ codeUnitRepo, functionCallRepo });

    expect(result.totalUnresolved).toBe(3);
    expect(result.resolved).toBe(1);
    expect(result.ambiguous).toBe(1);
    expect(result.noMatch).toBe(1);
  });

  it('should use findAllFlat to include nested/child units', () => {
    // Create a method (child unit) that would be missed by findAll's parent filter
    const methodUnit = makeUnit({
      name: 'doWork',
      id: 'unit-doWork',
      filePath: 'src/service.ts',
      unitType: CodeUnitType.METHOD,
    });
    codeUnitRepo.save(methodUnit);

    const call = makeCall({
      id: 'call-1',
      callerUnitId: 'unit-caller',
      calleeName: 'this.doWork',
    });
    functionCallRepo.save(call);

    const result = resolveCallees({ codeUnitRepo, functionCallRepo });

    expect(result.resolved).toBe(1);
    const updated = functionCallRepo.findAll();
    expect(updated[0].calleeUnitId).toBe('unit-doWork');
  });
});
