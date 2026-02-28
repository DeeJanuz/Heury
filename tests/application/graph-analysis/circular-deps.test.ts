import { describe, it, expect } from 'vitest';

import { detectCircularDeps } from '@/application/graph-analysis/circular-deps.js';
import { createFileDependency, ImportType } from '@/domain/models/index.js';
import type { FileDependency } from '@/domain/models/index.js';
import type { CircularDep } from '@/application/graph-analysis/circular-deps.js';

function dep(source: string, target: string): FileDependency {
  return createFileDependency({
    sourceFile: source,
    targetFile: target,
    importType: ImportType.NAMED,
    importedNames: ['default'],
  });
}

describe('detectCircularDeps', () => {
  describe('empty and trivial inputs', () => {
    it('should return empty array for empty deps', () => {
      const result = detectCircularDeps([]);
      expect(result).toEqual([]);
    });

    it('should return empty array when no cycles exist (DAG)', () => {
      const deps = [
        dep('a.ts', 'b.ts'),
        dep('b.ts', 'c.ts'),
        dep('a.ts', 'c.ts'),
      ];
      const result = detectCircularDeps(deps);
      expect(result).toEqual([]);
    });
  });

  describe('self-referencing files', () => {
    it('should detect a file importing itself as a cycle of length 1', () => {
      const deps = [dep('a.ts', 'a.ts')];
      const result = detectCircularDeps(deps);

      expect(result).toHaveLength(1);
      expect(result[0].cycle).toEqual(['a.ts', 'a.ts']);
      expect(result[0].length).toBe(1);
    });
  });

  describe('simple cycles', () => {
    it('should detect a 2-node cycle: A→B→A', () => {
      const deps = [
        dep('a.ts', 'b.ts'),
        dep('b.ts', 'a.ts'),
      ];
      const result = detectCircularDeps(deps);

      expect(result).toHaveLength(1);
      expect(result[0].cycle).toEqual(['a.ts', 'b.ts', 'a.ts']);
      expect(result[0].length).toBe(2);
    });

    it('should detect a 3-node cycle: A→B→C→A', () => {
      const deps = [
        dep('a.ts', 'b.ts'),
        dep('b.ts', 'c.ts'),
        dep('c.ts', 'a.ts'),
      ];
      const result = detectCircularDeps(deps);

      expect(result).toHaveLength(1);
      expect(result[0].cycle).toEqual(['a.ts', 'b.ts', 'c.ts', 'a.ts']);
      expect(result[0].length).toBe(3);
    });
  });

  describe('multiple independent cycles', () => {
    it('should detect multiple independent cycles', () => {
      const deps = [
        dep('a.ts', 'b.ts'),
        dep('b.ts', 'a.ts'),
        dep('x.ts', 'y.ts'),
        dep('y.ts', 'z.ts'),
        dep('z.ts', 'x.ts'),
      ];
      const result = detectCircularDeps(deps);

      expect(result).toHaveLength(2);

      const twoNodeCycle = result.find(r => r.length === 2);
      const threeNodeCycle = result.find(r => r.length === 3);

      expect(twoNodeCycle).toBeDefined();
      expect(threeNodeCycle).toBeDefined();

      expect(twoNodeCycle!.cycle).toEqual(['a.ts', 'b.ts', 'a.ts']);
      expect(threeNodeCycle!.cycle).toEqual(['x.ts', 'y.ts', 'z.ts', 'x.ts']);
    });
  });

  describe('mixed: some nodes in cycles, some not', () => {
    it('should only report cycles, ignoring non-cyclic nodes', () => {
      const deps = [
        dep('a.ts', 'b.ts'),
        dep('b.ts', 'a.ts'),
        dep('c.ts', 'd.ts'),
        dep('d.ts', 'e.ts'),
      ];
      const result = detectCircularDeps(deps);

      expect(result).toHaveLength(1);
      expect(result[0].cycle).toEqual(['a.ts', 'b.ts', 'a.ts']);
      expect(result[0].length).toBe(2);
    });
  });

  describe('large cycles', () => {
    it('should detect a cycle with 4+ nodes', () => {
      const deps = [
        dep('a.ts', 'b.ts'),
        dep('b.ts', 'c.ts'),
        dep('c.ts', 'd.ts'),
        dep('d.ts', 'e.ts'),
        dep('e.ts', 'a.ts'),
      ];
      const result = detectCircularDeps(deps);

      expect(result).toHaveLength(1);
      expect(result[0].cycle).toEqual(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'a.ts']);
      expect(result[0].length).toBe(5);
    });
  });

  describe('sorting', () => {
    it('should sort results by cycle length ascending', () => {
      const deps = [
        dep('x.ts', 'y.ts'),
        dep('y.ts', 'z.ts'),
        dep('z.ts', 'x.ts'),
        dep('a.ts', 'b.ts'),
        dep('b.ts', 'a.ts'),
        dep('self.ts', 'self.ts'),
      ];
      const result = detectCircularDeps(deps);

      expect(result).toHaveLength(3);
      expect(result[0].length).toBe(1);
      expect(result[1].length).toBe(2);
      expect(result[2].length).toBe(3);
    });
  });

  describe('cycle array structure', () => {
    it('should have cycle array starting and ending with the same file', () => {
      const deps = [
        dep('a.ts', 'b.ts'),
        dep('b.ts', 'c.ts'),
        dep('c.ts', 'a.ts'),
      ];
      const result = detectCircularDeps(deps);

      expect(result).toHaveLength(1);
      const cycle = result[0].cycle;
      expect(cycle[0]).toBe(cycle[cycle.length - 1]);
    });

    it('should have length equal to number of unique files in the cycle', () => {
      const deps = [
        dep('a.ts', 'b.ts'),
        dep('b.ts', 'c.ts'),
        dep('c.ts', 'a.ts'),
      ];
      const result = detectCircularDeps(deps);

      expect(result[0].length).toBe(3);
      // cycle array has length + 1 elements (start repeated at end)
      expect(result[0].cycle).toHaveLength(result[0].length + 1);
    });
  });

  describe('duplicate dependencies', () => {
    it('should handle duplicate deps without producing duplicate cycles', () => {
      const deps = [
        dep('a.ts', 'b.ts'),
        dep('a.ts', 'b.ts'),
        dep('b.ts', 'a.ts'),
        dep('b.ts', 'a.ts'),
      ];
      const result = detectCircularDeps(deps);

      expect(result).toHaveLength(1);
      expect(result[0].cycle).toEqual(['a.ts', 'b.ts', 'a.ts']);
    });
  });

  describe('deterministic ordering', () => {
    it('should start cycle from alphabetically first node', () => {
      // Even though the cycle could be represented starting from any node,
      // it should always start from the alphabetically first node
      const deps = [
        dep('c.ts', 'a.ts'),
        dep('a.ts', 'b.ts'),
        dep('b.ts', 'c.ts'),
      ];
      const result = detectCircularDeps(deps);

      expect(result).toHaveLength(1);
      expect(result[0].cycle[0]).toBe('a.ts');
      expect(result[0].cycle).toEqual(['a.ts', 'b.ts', 'c.ts', 'a.ts']);
    });

    it('should produce consistent results regardless of dependency input order', () => {
      const deps1 = [
        dep('b.ts', 'c.ts'),
        dep('c.ts', 'a.ts'),
        dep('a.ts', 'b.ts'),
      ];
      const deps2 = [
        dep('a.ts', 'b.ts'),
        dep('c.ts', 'a.ts'),
        dep('b.ts', 'c.ts'),
      ];
      const result1 = detectCircularDeps(deps1);
      const result2 = detectCircularDeps(deps2);

      expect(result1).toEqual(result2);
    });
  });

  describe('complex graph scenarios', () => {
    it('should handle a graph where one SCC contains multiple sub-cycles', () => {
      // SCC: a→b→c→a and a→b→a are both part of the same SCC {a, b, c}
      // Tarjan should find the entire SCC as one component
      const deps = [
        dep('a.ts', 'b.ts'),
        dep('b.ts', 'c.ts'),
        dep('c.ts', 'a.ts'),
        dep('b.ts', 'a.ts'),
      ];
      const result = detectCircularDeps(deps);

      // The SCC {a, b, c} should be reported once
      expect(result).toHaveLength(1);
      expect(result[0].length).toBe(3);
    });

    it('should handle nodes with no outgoing edges', () => {
      const deps = [
        dep('a.ts', 'b.ts'),
        dep('c.ts', 'a.ts'),
      ];
      const result = detectCircularDeps(deps);
      expect(result).toEqual([]);
    });
  });
});
