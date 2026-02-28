import { describe, it, expect } from 'vitest';

import { computeTransitiveDeps } from '@/application/graph-analysis/transitive-deps.js';
import { createFileDependency, ImportType } from '@/domain/models/index.js';
import type { FileDependency } from '@/domain/models/index.js';
import type { TransitiveDep } from '@/application/graph-analysis/transitive-deps.js';

function dep(source: string, target: string): FileDependency {
  return createFileDependency({
    sourceFile: source,
    targetFile: target,
    importType: ImportType.NAMED,
    importedNames: ['default'],
  });
}

describe('computeTransitiveDeps', () => {
  describe('empty and trivial inputs', () => {
    it('should return empty array for empty deps', () => {
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', []);
      expect(result).toEqual([]);
    });

    it('should return empty array when startFile is not in the graph', () => {
      const deps = [dep('src/b.ts', 'src/c.ts')];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps);
      expect(result).toEqual([]);
    });

    it('should return empty array when maxDepth is 0', () => {
      const deps = [dep('src/a.ts', 'src/b.ts')];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps, 0);
      expect(result).toEqual([]);
    });
  });

  describe('direct dependencies (depth 1)', () => {
    it('should find direct dependencies of a file', () => {
      const deps = [
        dep('src/a.ts', 'src/b.ts'),
        dep('src/a.ts', 'src/c.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { file: 'src/b.ts', depth: 1, path: ['src/a.ts', 'src/b.ts'] },
        { file: 'src/c.ts', depth: 1, path: ['src/a.ts', 'src/c.ts'] },
      ]);
    });

    it('should find direct dependents of a file', () => {
      const deps = [
        dep('src/b.ts', 'src/a.ts'),
        dep('src/c.ts', 'src/a.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependents', deps);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { file: 'src/b.ts', depth: 1, path: ['src/a.ts', 'src/b.ts'] },
        { file: 'src/c.ts', depth: 1, path: ['src/a.ts', 'src/c.ts'] },
      ]);
    });
  });

  describe('transitive chains', () => {
    it('should follow transitive dependency chain A->B->C', () => {
      const deps = [
        dep('src/a.ts', 'src/b.ts'),
        dep('src/b.ts', 'src/c.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps);

      expect(result).toEqual([
        { file: 'src/b.ts', depth: 1, path: ['src/a.ts', 'src/b.ts'] },
        { file: 'src/c.ts', depth: 2, path: ['src/a.ts', 'src/b.ts', 'src/c.ts'] },
      ]);
    });

    it('should follow transitive dependent chain C->B->A (who depends on A)', () => {
      const deps = [
        dep('src/b.ts', 'src/a.ts'),
        dep('src/c.ts', 'src/b.ts'),
      ];
      // A is depended on by B, and B is depended on by C
      const result = computeTransitiveDeps('src/a.ts', 'dependents', deps);

      expect(result).toEqual([
        { file: 'src/b.ts', depth: 1, path: ['src/a.ts', 'src/b.ts'] },
        { file: 'src/c.ts', depth: 2, path: ['src/a.ts', 'src/b.ts', 'src/c.ts'] },
      ]);
    });

    it('should handle deep chains (depth 3+)', () => {
      const deps = [
        dep('src/a.ts', 'src/b.ts'),
        dep('src/b.ts', 'src/c.ts'),
        dep('src/c.ts', 'src/d.ts'),
        dep('src/d.ts', 'src/e.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps);

      expect(result).toEqual([
        { file: 'src/b.ts', depth: 1, path: ['src/a.ts', 'src/b.ts'] },
        { file: 'src/c.ts', depth: 2, path: ['src/a.ts', 'src/b.ts', 'src/c.ts'] },
        { file: 'src/d.ts', depth: 3, path: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'] },
        { file: 'src/e.ts', depth: 4, path: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts'] },
      ]);
    });
  });

  describe('maxDepth limiting', () => {
    it('should limit traversal to maxDepth=1', () => {
      const deps = [
        dep('src/a.ts', 'src/b.ts'),
        dep('src/b.ts', 'src/c.ts'),
        dep('src/c.ts', 'src/d.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps, 1);

      expect(result).toEqual([
        { file: 'src/b.ts', depth: 1, path: ['src/a.ts', 'src/b.ts'] },
      ]);
    });

    it('should limit traversal to maxDepth=2', () => {
      const deps = [
        dep('src/a.ts', 'src/b.ts'),
        dep('src/b.ts', 'src/c.ts'),
        dep('src/c.ts', 'src/d.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps, 2);

      expect(result).toEqual([
        { file: 'src/b.ts', depth: 1, path: ['src/a.ts', 'src/b.ts'] },
        { file: 'src/c.ts', depth: 2, path: ['src/a.ts', 'src/b.ts', 'src/c.ts'] },
      ]);
    });
  });

  describe('cycle handling', () => {
    it('should not loop infinitely on A->B->A cycle', () => {
      const deps = [
        dep('src/a.ts', 'src/b.ts'),
        dep('src/b.ts', 'src/a.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps);

      expect(result).toEqual([
        { file: 'src/b.ts', depth: 1, path: ['src/a.ts', 'src/b.ts'] },
      ]);
    });

    it('should not loop infinitely on A->B->C->A cycle', () => {
      const deps = [
        dep('src/a.ts', 'src/b.ts'),
        dep('src/b.ts', 'src/c.ts'),
        dep('src/c.ts', 'src/a.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps);

      expect(result).toEqual([
        { file: 'src/b.ts', depth: 1, path: ['src/a.ts', 'src/b.ts'] },
        { file: 'src/c.ts', depth: 2, path: ['src/a.ts', 'src/b.ts', 'src/c.ts'] },
      ]);
    });
  });

  describe('fan-out and fan-in', () => {
    it('should handle fan-out: A depends on B, C, D', () => {
      const deps = [
        dep('src/a.ts', 'src/b.ts'),
        dep('src/a.ts', 'src/c.ts'),
        dep('src/a.ts', 'src/d.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps);

      expect(result).toHaveLength(3);
      expect(result).toEqual([
        { file: 'src/b.ts', depth: 1, path: ['src/a.ts', 'src/b.ts'] },
        { file: 'src/c.ts', depth: 1, path: ['src/a.ts', 'src/c.ts'] },
        { file: 'src/d.ts', depth: 1, path: ['src/a.ts', 'src/d.ts'] },
      ]);
    });

    it('should handle fan-in: B, C, D all depend on A', () => {
      const deps = [
        dep('src/b.ts', 'src/a.ts'),
        dep('src/c.ts', 'src/a.ts'),
        dep('src/d.ts', 'src/a.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependents', deps);

      expect(result).toHaveLength(3);
      expect(result).toEqual([
        { file: 'src/b.ts', depth: 1, path: ['src/a.ts', 'src/b.ts'] },
        { file: 'src/c.ts', depth: 1, path: ['src/a.ts', 'src/c.ts'] },
        { file: 'src/d.ts', depth: 1, path: ['src/a.ts', 'src/d.ts'] },
      ]);
    });
  });

  describe('sorting', () => {
    it('should sort results by depth ascending, then file path alphabetically', () => {
      const deps = [
        dep('src/a.ts', 'src/z.ts'),
        dep('src/a.ts', 'src/m.ts'),
        dep('src/z.ts', 'src/y.ts'),
        dep('src/m.ts', 'src/b.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps);

      expect(result).toEqual([
        { file: 'src/m.ts', depth: 1, path: ['src/a.ts', 'src/m.ts'] },
        { file: 'src/z.ts', depth: 1, path: ['src/a.ts', 'src/z.ts'] },
        { file: 'src/b.ts', depth: 2, path: ['src/a.ts', 'src/m.ts', 'src/b.ts'] },
        { file: 'src/y.ts', depth: 2, path: ['src/a.ts', 'src/z.ts', 'src/y.ts'] },
      ]);
    });
  });

  describe('duplicate dependencies', () => {
    it('should handle duplicate dependency edges gracefully', () => {
      const deps = [
        dep('src/a.ts', 'src/b.ts'),
        dep('src/a.ts', 'src/b.ts'),
        dep('src/a.ts', 'src/b.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps);

      expect(result).toEqual([
        { file: 'src/b.ts', depth: 1, path: ['src/a.ts', 'src/b.ts'] },
      ]);
    });
  });

  describe('startFile exclusion', () => {
    it('should not include startFile in results', () => {
      const deps = [
        dep('src/a.ts', 'src/b.ts'),
        dep('src/b.ts', 'src/a.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps);

      const files = result.map(r => r.file);
      expect(files).not.toContain('src/a.ts');
    });
  });

  describe('path tracking', () => {
    it('should track shortest path correctly through diamond pattern', () => {
      // A -> B -> D
      // A -> C -> D
      const deps = [
        dep('src/a.ts', 'src/b.ts'),
        dep('src/a.ts', 'src/c.ts'),
        dep('src/b.ts', 'src/d.ts'),
        dep('src/c.ts', 'src/d.ts'),
      ];
      const result = computeTransitiveDeps('src/a.ts', 'dependencies', deps);

      expect(result).toHaveLength(3);

      // B and C at depth 1
      const depthOne = result.filter(r => r.depth === 1);
      expect(depthOne).toHaveLength(2);

      // D at depth 2, path should be one of the shortest paths
      const d = result.find(r => r.file === 'src/d.ts');
      expect(d).toBeDefined();
      expect(d!.depth).toBe(2);
      expect(d!.path).toHaveLength(3);
      expect(d!.path[0]).toBe('src/a.ts');
      // The intermediate node should be either b or c (whichever BFS finds first)
      expect(['src/b.ts', 'src/c.ts']).toContain(d!.path[1]);
      expect(d!.path[2]).toBe('src/d.ts');
    });
  });
});
