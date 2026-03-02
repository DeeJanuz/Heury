import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import { createCodeUnitsRoutes } from '@/adapters/ui/routes/code-units.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryFileSystem,
  InMemoryFunctionCallRepository,
  InMemoryTypeFieldRepository,
} from '../../../helpers/fakes/index.js';
import {
  createCodeUnit,
  CodeUnitType,
  createFunctionCall,
  createTypeField,
} from '@/domain/models/index.js';
import { request } from '../test-helpers.js';

describe('code-units routes', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let functionCallRepo: InMemoryFunctionCallRepository;
  let typeFieldRepo: InMemoryTypeFieldRepository;
  let fileSystem: InMemoryFileSystem;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    functionCallRepo = new InMemoryFunctionCallRepository();
    typeFieldRepo = new InMemoryTypeFieldRepository();
    fileSystem = new InMemoryFileSystem();

    app = express();
    app.use('/api', createCodeUnitsRoutes({ codeUnitRepo, functionCallRepo, typeFieldRepo, fileSystem }));
  });

  describe('GET /api/code-units', () => {
    it('should return all code units when no filters are given', async () => {
      codeUnitRepo.save(createCodeUnit({
        filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
      }));
      codeUnitRepo.save(createCodeUnit({
        filePath: 'src/b.ts', name: 'fnB', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 5, isAsync: false, isExported: false, language: 'python',
      }));

      const resp = await request(app, '/api/code-units');
      const body = resp.body as { total: number; items: unknown[] };

      expect(resp.status).toBe(200);
      expect(body.total).toBe(2);
      expect(body.items).toHaveLength(2);
    });

    it('should filter by file_path', async () => {
      codeUnitRepo.save(createCodeUnit({
        filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
      }));
      codeUnitRepo.save(createCodeUnit({
        filePath: 'src/b.ts', name: 'fnB', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 5, isAsync: false, isExported: true, language: 'typescript',
      }));

      const resp = await request(app, '/api/code-units?file_path=src/a.ts');
      const body = resp.body as { total: number; items: Array<{ name: string }> };

      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe('fnA');
    });

    it('should filter by type', async () => {
      codeUnitRepo.save(createCodeUnit({
        filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
      }));
      codeUnitRepo.save(createCodeUnit({
        filePath: 'src/b.ts', name: 'MyClass', unitType: CodeUnitType.CLASS,
        lineStart: 1, lineEnd: 50, isAsync: false, isExported: true, language: 'typescript',
      }));

      const resp = await request(app, '/api/code-units?type=CLASS');
      const body = resp.body as { total: number; items: Array<{ name: string }> };

      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe('MyClass');
    });

    it('should filter by language', async () => {
      codeUnitRepo.save(createCodeUnit({
        filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
      }));
      codeUnitRepo.save(createCodeUnit({
        filePath: 'src/b.py', name: 'fn_b', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 5, isAsync: false, isExported: true, language: 'python',
      }));

      const resp = await request(app, '/api/code-units?language=python');
      const body = resp.body as { total: number; items: Array<{ name: string }> };

      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe('fn_b');
    });

    it('should filter by exported', async () => {
      codeUnitRepo.save(createCodeUnit({
        filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
      }));
      codeUnitRepo.save(createCodeUnit({
        filePath: 'src/b.ts', name: 'fnB', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 5, isAsync: false, isExported: false, language: 'typescript',
      }));

      const resp = await request(app, '/api/code-units?exported=false');
      const body = resp.body as { total: number; items: Array<{ name: string }> };

      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe('fnB');
    });

    it('should filter by min_complexity', async () => {
      codeUnitRepo.save(createCodeUnit({
        filePath: 'src/a.ts', name: 'simple', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 5, isAsync: false, isExported: true, language: 'typescript',
        complexityScore: 2,
      }));
      codeUnitRepo.save(createCodeUnit({
        filePath: 'src/b.ts', name: 'complex', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 50, isAsync: false, isExported: true, language: 'typescript',
        complexityScore: 15,
      }));

      const resp = await request(app, '/api/code-units?min_complexity=10');
      const body = resp.body as { total: number; items: Array<{ name: string }> };

      expect(body.total).toBe(1);
      expect(body.items[0].name).toBe('complex');
    });

    it('should support pagination with limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        codeUnitRepo.save(createCodeUnit({
          filePath: `src/${i}.ts`, name: `fn${i}`, unitType: CodeUnitType.FUNCTION,
          lineStart: 1, lineEnd: 5, isAsync: false, isExported: true, language: 'typescript',
        }));
      }

      const resp = await request(app, '/api/code-units?limit=2&offset=1');
      const body = resp.body as { total: number; items: unknown[] };

      expect(body.total).toBe(5);
      expect(body.items).toHaveLength(2);
    });

    it('should return empty items for empty repo', async () => {
      const resp = await request(app, '/api/code-units');
      const body = resp.body as { total: number; items: unknown[] };

      expect(body.total).toBe(0);
      expect(body.items).toEqual([]);
    });
  });

  describe('GET /api/code-units/:id', () => {
    it('should return code unit detail with function calls and type fields', async () => {
      const unitId = 'unit-1';
      codeUnitRepo.save(createCodeUnit({
        id: unitId,
        filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
      }));
      functionCallRepo.save(createFunctionCall({
        callerUnitId: unitId, calleeName: 'helper', lineNumber: 5, isAsync: false,
      }));
      functionCallRepo.save(createFunctionCall({
        callerUnitId: 'other-unit', calleeName: 'fnA', calleeUnitId: unitId, lineNumber: 3, isAsync: false,
      }));
      typeFieldRepo.save(createTypeField({
        parentUnitId: unitId, name: 'value', fieldType: 'string',
        isOptional: false, isReadonly: true, lineNumber: 2,
      }));

      const resp = await request(app, `/api/code-units/${unitId}`);
      const body = resp.body as Record<string, unknown>;

      expect(resp.status).toBe(200);
      expect(body.name).toBe('fnA');
      expect((body.functionCalls as Record<string, unknown[]>).callees).toHaveLength(1);
      expect((body.functionCalls as Record<string, unknown[]>).callers).toHaveLength(1);
      expect((body.typeFields as unknown[])).toHaveLength(1);
    });

    it('should return enriched FunctionCallRef data for callees', async () => {
      const unitId = 'unit-1';
      const calleeId = 'unit-2';
      codeUnitRepo.save(createCodeUnit({
        id: unitId,
        filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
      }));
      codeUnitRepo.save(createCodeUnit({
        id: calleeId,
        filePath: 'src/b.ts', name: 'helper', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 5, isAsync: false, isExported: true, language: 'typescript',
      }));
      functionCallRepo.save(createFunctionCall({
        id: 'call-1',
        callerUnitId: unitId, calleeName: 'helper', calleeFilePath: 'src/b.ts',
        calleeUnitId: calleeId, lineNumber: 5, isAsync: false,
      }));

      const resp = await request(app, `/api/code-units/${unitId}`);
      const body = resp.body as Record<string, unknown>;
      const callees = (body.functionCalls as Record<string, unknown[]>).callees;

      expect(callees).toHaveLength(1);
      expect(callees[0]).toEqual({
        id: 'call-1',
        callerUnitId: unitId,
        callerName: 'fnA',
        callerFilePath: 'src/a.ts',
        calleeName: 'helper',
        calleeUnitId: calleeId,
        calleeFilePath: 'src/b.ts',
        lineNumber: 5,
      });
    });

    it('should return enriched FunctionCallRef data for callers', async () => {
      const unitId = 'unit-1';
      const callerId = 'unit-3';
      codeUnitRepo.save(createCodeUnit({
        id: unitId,
        filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
      }));
      codeUnitRepo.save(createCodeUnit({
        id: callerId,
        filePath: 'src/c.ts', name: 'caller', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 20, isAsync: false, isExported: true, language: 'typescript',
      }));
      functionCallRepo.save(createFunctionCall({
        id: 'call-2',
        callerUnitId: callerId, calleeName: 'fnA', calleeUnitId: unitId, lineNumber: 3, isAsync: false,
      }));

      const resp = await request(app, `/api/code-units/${unitId}`);
      const body = resp.body as Record<string, unknown>;
      const callers = (body.functionCalls as Record<string, unknown[]>).callers;

      expect(callers).toHaveLength(1);
      expect(callers[0]).toEqual({
        id: 'call-2',
        callerUnitId: callerId,
        callerName: 'caller',
        callerFilePath: 'src/c.ts',
        calleeName: 'fnA',
        calleeUnitId: unitId,
        calleeFilePath: 'src/a.ts',
        lineNumber: 3,
      });
    });

    it('should default calleeUnitId to null and calleeFilePath to empty string when missing', async () => {
      const unitId = 'unit-1';
      codeUnitRepo.save(createCodeUnit({
        id: unitId,
        filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
      }));
      functionCallRepo.save(createFunctionCall({
        id: 'call-3',
        callerUnitId: unitId, calleeName: 'externalFn', lineNumber: 7, isAsync: false,
      }));

      const resp = await request(app, `/api/code-units/${unitId}`);
      const body = resp.body as Record<string, unknown>;
      const callees = (body.functionCalls as Record<string, unknown[]>).callees;

      expect(callees).toHaveLength(1);
      expect(callees[0]).toEqual({
        id: 'call-3',
        callerUnitId: unitId,
        callerName: 'fnA',
        callerFilePath: 'src/a.ts',
        calleeName: 'externalFn',
        calleeUnitId: null,
        calleeFilePath: '',
        lineNumber: 7,
      });
    });

    it('should use caller code unit name/path even when caller unit is not found', async () => {
      const unitId = 'unit-1';
      codeUnitRepo.save(createCodeUnit({
        id: unitId,
        filePath: 'src/a.ts', name: 'fnA', unitType: CodeUnitType.FUNCTION,
        lineStart: 1, lineEnd: 10, isAsync: false, isExported: true, language: 'typescript',
      }));
      // caller unit 'missing-unit' is NOT in the repo
      functionCallRepo.save(createFunctionCall({
        id: 'call-4',
        callerUnitId: 'missing-unit', calleeName: 'fnA', calleeUnitId: unitId, lineNumber: 10, isAsync: false,
      }));

      const resp = await request(app, `/api/code-units/${unitId}`);
      const body = resp.body as Record<string, unknown>;
      const callers = (body.functionCalls as Record<string, unknown[]>).callers;

      expect(callers).toHaveLength(1);
      expect(callers[0]).toEqual({
        id: 'call-4',
        callerUnitId: 'missing-unit',
        callerName: 'unknown',
        callerFilePath: '',
        calleeName: 'fnA',
        calleeUnitId: unitId,
        calleeFilePath: 'src/a.ts',
        lineNumber: 10,
      });
    });

    it('should return 404 for missing code unit', async () => {
      const resp = await request(app, '/api/code-units/nonexistent');

      expect(resp.status).toBe(404);
      expect(resp.body).toEqual({ error: 'Code unit not found' });
    });
  });
});
