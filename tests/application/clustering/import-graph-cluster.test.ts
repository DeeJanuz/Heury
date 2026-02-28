import { describe, it, expect } from 'vitest';

import { computeFileClusters } from '@/application/clustering/import-graph-cluster.js';
import { createFileDependency, ImportType } from '@/domain/models/index.js';
import type { FileDependency } from '@/domain/models/index.js';
import type { FileCluster } from '@/application/clustering/import-graph-cluster.js';

function dep(source: string, target: string): FileDependency {
  return createFileDependency({
    sourceFile: source,
    targetFile: target,
    importType: ImportType.NAMED,
    importedNames: ['default'],
  });
}

describe('computeFileClusters', () => {
  describe('empty and trivial inputs', () => {
    it('should return empty array for empty input', () => {
      const result = computeFileClusters([]);
      expect(result).toEqual([]);
    });

    it('should create a single cluster for one dependency between two files', () => {
      const deps = [dep('src/a.ts', 'src/b.ts')];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(1);
      expect(result[0].files).toHaveLength(2);
      expect(result[0].files).toContain('src/a.ts');
      expect(result[0].files).toContain('src/b.ts');
    });
  });

  describe('connected components', () => {
    it('should group connected files into one cluster', () => {
      const deps = [
        dep('src/a.ts', 'src/b.ts'),
        dep('src/b.ts', 'src/c.ts'),
      ];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(1);
      expect(result[0].files).toHaveLength(3);
      expect(result[0].files).toContain('src/a.ts');
      expect(result[0].files).toContain('src/b.ts');
      expect(result[0].files).toContain('src/c.ts');
    });

    it('should create separate clusters for disconnected groups', () => {
      const deps = [
        dep('src/api/handler.ts', 'src/api/routes.ts'),
        dep('src/db/model.ts', 'src/db/connection.ts'),
      ];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(2);

      const apiCluster = result.find(c => c.files.includes('src/api/handler.ts'));
      const dbCluster = result.find(c => c.files.includes('src/db/model.ts'));

      expect(apiCluster).toBeDefined();
      expect(dbCluster).toBeDefined();
      expect(apiCluster!.files).toHaveLength(2);
      expect(dbCluster!.files).toHaveLength(2);
    });

    it('should handle transitive connections forming one cluster', () => {
      const deps = [
        dep('a.ts', 'b.ts'),
        dep('b.ts', 'c.ts'),
        dep('c.ts', 'd.ts'),
      ];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(1);
      expect(result[0].files).toHaveLength(4);
    });
  });

  describe('self-referencing dependencies', () => {
    it('should handle a file importing itself', () => {
      const deps = [dep('src/a.ts', 'src/a.ts')];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(1);
      expect(result[0].files).toEqual(['src/a.ts']);
    });

    it('should handle self-reference mixed with other deps', () => {
      const deps = [
        dep('src/a.ts', 'src/a.ts'),
        dep('src/a.ts', 'src/b.ts'),
      ];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(1);
      expect(result[0].files).toHaveLength(2);
    });
  });

  describe('cohesion calculation', () => {
    it('should have cohesion of 1.0 when all edges are internal', () => {
      const deps = [
        dep('src/api/a.ts', 'src/api/b.ts'),
        dep('src/api/b.ts', 'src/api/c.ts'),
      ];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(1);
      expect(result[0].cohesion).toBe(1.0);
      expect(result[0].internalEdges).toBe(2);
      expect(result[0].externalEdges).toBe(0);
    });

    it('should compute cohesion correctly when clusters have cross-edges', () => {
      // Two clusters connected by a bridge edge.
      // Cluster 1: api/a -> api/b  (internal to cluster with api files)
      // Cluster 2: db/c -> db/d    (internal to cluster with db files)
      // Bridge: api/b -> db/c      (connects them into one component)
      const deps = [
        dep('src/api/a.ts', 'src/api/b.ts'),
        dep('src/api/b.ts', 'src/db/c.ts'),
        dep('src/db/c.ts', 'src/db/d.ts'),
      ];
      const result = computeFileClusters(deps);

      // These are all connected, forming one cluster
      expect(result).toHaveLength(1);
      expect(result[0].cohesion).toBe(1.0); // single cluster = all edges internal
    });

    it('should compute external edges for separate clusters', () => {
      // When files are in separate clusters but the original deps include cross-cluster references,
      // we need to have a scenario where the graph naturally splits into multiple components.
      // Since connected components are by definition... connected, externalEdges only matter
      // when large clusters get split. Let's test a simple two-component scenario.
      const deps = [
        dep('src/api/a.ts', 'src/api/b.ts'),
        dep('src/db/c.ts', 'src/db/d.ts'),
      ];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(2);
      // Each cluster is self-contained with no cross references
      for (const cluster of result) {
        expect(cluster.cohesion).toBe(1.0);
        expect(cluster.externalEdges).toBe(0);
      }
    });
  });

  describe('cluster naming', () => {
    it('should name cluster from common directory prefix', () => {
      const deps = [
        dep('src/api/handler.ts', 'src/api/routes.ts'),
        dep('src/api/routes.ts', 'src/api/middleware.ts'),
      ];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('api');
    });

    it('should use deeper common prefix for nested paths', () => {
      const deps = [
        dep('src/domain/models/user.ts', 'src/domain/models/account.ts'),
      ];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('domain/models');
    });

    it('should use root-level name when files share no common directory', () => {
      const deps = [dep('a.ts', 'b.ts')];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(1);
      // Files at root level have no directory prefix
      expect(result[0].name).toBe('root');
    });

    it('should strip leading common prefix like src/', () => {
      const deps = [
        dep('src/utils/helpers.ts', 'src/utils/format.ts'),
      ];
      const result = computeFileClusters(deps);

      expect(result[0].name).toBe('utils');
    });
  });

  describe('entry point identification', () => {
    it('should identify files most imported from outside the cluster', () => {
      // Cluster 1: api files
      // Cluster 2: db files
      // api/handler imports db/connection (cross-cluster reference makes them connected,
      // but let's design a test with separate components + no cross references)
      // For entry points to matter, we need multiple clusters where
      // the ORIGINAL deps have cross-cluster edges.
      // Since connected components merge everything connected,
      // entry points are relevant after large-component splitting.

      // Simpler test: single cluster, identify which files are entry points
      // based on how many external imports they receive.
      // With only one cluster and no external deps, entry points should be empty or
      // based on total import count.

      // Actually, for a single connected component with no external edges,
      // there are no files imported from "outside the cluster", so entryPoints = [].
      const deps = [
        dep('src/api/a.ts', 'src/api/b.ts'),
        dep('src/api/b.ts', 'src/api/c.ts'),
      ];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(1);
      // No external imports, so no entry points
      expect(result[0].entryPoints).toEqual([]);
    });

    it('should rank entry points by external import count after splitting', () => {
      // Build a large component (>20 files) that gets split.
      // After splitting, files at cluster boundaries become entry points.
      const deps: FileDependency[] = [];

      // Group 1: src/api/ - 12 files, tightly connected
      for (let i = 0; i < 11; i++) {
        deps.push(dep(`src/api/file${i}.ts`, `src/api/file${i + 1}.ts`));
      }

      // Group 2: src/db/ - 12 files, tightly connected
      for (let i = 0; i < 11; i++) {
        deps.push(dep(`src/db/file${i}.ts`, `src/db/file${i + 1}.ts`));
      }

      // Bridge edges: connect the two groups (making one big component)
      // Multiple api files import db/file0 to make it a clear entry point
      deps.push(dep('src/api/file0.ts', 'src/db/file0.ts'));
      deps.push(dep('src/api/file1.ts', 'src/db/file0.ts'));
      deps.push(dep('src/api/file2.ts', 'src/db/file0.ts'));

      const result = computeFileClusters(deps);

      // Should be split into 2 clusters (api and db groups)
      expect(result.length).toBeGreaterThanOrEqual(2);

      const dbCluster = result.find(c => c.files.includes('src/db/file0.ts'));
      expect(dbCluster).toBeDefined();
      // db/file0.ts should be an entry point since it's imported from api cluster
      expect(dbCluster!.entryPoints).toContain('src/db/file0.ts');
    });
  });

  describe('large component splitting', () => {
    it('should split components with more than 20 files at directory boundaries', () => {
      const deps: FileDependency[] = [];

      // Group 1: 15 files in src/api/
      for (let i = 0; i < 14; i++) {
        deps.push(dep(`src/api/file${i}.ts`, `src/api/file${i + 1}.ts`));
      }

      // Group 2: 15 files in src/db/
      for (let i = 0; i < 14; i++) {
        deps.push(dep(`src/db/file${i}.ts`, `src/db/file${i + 1}.ts`));
      }

      // Single bridge connection to make it one component
      deps.push(dep('src/api/file0.ts', 'src/db/file0.ts'));

      const result = computeFileClusters(deps);

      // 30 files total > 20, should be split
      expect(result.length).toBeGreaterThanOrEqual(2);

      const apiCluster = result.find(c => c.files.includes('src/api/file0.ts'));
      const dbCluster = result.find(c => c.files.includes('src/db/file0.ts'));

      expect(apiCluster).toBeDefined();
      expect(dbCluster).toBeDefined();
      // They should be in different clusters
      expect(apiCluster!.id).not.toBe(dbCluster!.id);
    });

    it('should not split components with 20 or fewer files', () => {
      const deps: FileDependency[] = [];

      // 10 files in src/api/, 10 in src/db/ = 20 total (not > 20)
      for (let i = 0; i < 9; i++) {
        deps.push(dep(`src/api/file${i}.ts`, `src/api/file${i + 1}.ts`));
      }
      for (let i = 0; i < 9; i++) {
        deps.push(dep(`src/db/file${i}.ts`, `src/db/file${i + 1}.ts`));
      }
      deps.push(dep('src/api/file0.ts', 'src/db/file0.ts'));

      const result = computeFileClusters(deps);

      expect(result).toHaveLength(1);
      expect(result[0].files).toHaveLength(20);
    });

    it('should compute cohesion correctly for split clusters', () => {
      const deps: FileDependency[] = [];

      // 15 files in src/api/ with dense internal connections
      for (let i = 0; i < 14; i++) {
        deps.push(dep(`src/api/file${i}.ts`, `src/api/file${i + 1}.ts`));
      }

      // 15 files in src/db/ with dense internal connections
      for (let i = 0; i < 14; i++) {
        deps.push(dep(`src/db/file${i}.ts`, `src/db/file${i + 1}.ts`));
      }

      // One bridge edge
      deps.push(dep('src/api/file0.ts', 'src/db/file0.ts'));

      const result = computeFileClusters(deps);

      expect(result.length).toBeGreaterThanOrEqual(2);

      for (const cluster of result) {
        // Cohesion should be high since most edges are internal
        expect(cluster.cohesion).toBeGreaterThan(0.8);
        expect(cluster.internalEdges).toBeGreaterThan(0);
      }
    });
  });

  describe('cluster IDs', () => {
    it('should assign unique IDs to each cluster', () => {
      const deps = [
        dep('src/api/a.ts', 'src/api/b.ts'),
        dep('src/db/c.ts', 'src/db/d.ts'),
      ];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBeTruthy();
      expect(result[1].id).toBeTruthy();
      expect(result[0].id).not.toBe(result[1].id);
    });
  });

  describe('FileCluster interface compliance', () => {
    it('should return clusters with all required fields', () => {
      const deps = [dep('src/api/a.ts', 'src/api/b.ts')];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(1);
      const cluster = result[0];

      expect(cluster).toHaveProperty('id');
      expect(cluster).toHaveProperty('name');
      expect(cluster).toHaveProperty('files');
      expect(cluster).toHaveProperty('cohesion');
      expect(cluster).toHaveProperty('entryPoints');
      expect(cluster).toHaveProperty('internalEdges');
      expect(cluster).toHaveProperty('externalEdges');

      expect(typeof cluster.id).toBe('string');
      expect(typeof cluster.name).toBe('string');
      expect(Array.isArray(cluster.files)).toBe(true);
      expect(typeof cluster.cohesion).toBe('number');
      expect(Array.isArray(cluster.entryPoints)).toBe(true);
      expect(typeof cluster.internalEdges).toBe('number');
      expect(typeof cluster.externalEdges).toBe('number');
    });
  });

  describe('duplicate dependencies', () => {
    it('should handle duplicate dependency entries gracefully', () => {
      const deps = [
        dep('src/a.ts', 'src/b.ts'),
        dep('src/a.ts', 'src/b.ts'),
      ];
      const result = computeFileClusters(deps);

      expect(result).toHaveLength(1);
      expect(result[0].files).toHaveLength(2);
    });
  });

  describe('entry points limited to top 3', () => {
    it('should return at most 3 entry points per cluster', () => {
      const deps: FileDependency[] = [];

      // Group 1: src/api/ - 15 files
      for (let i = 0; i < 14; i++) {
        deps.push(dep(`src/api/file${i}.ts`, `src/api/file${i + 1}.ts`));
      }

      // Group 2: src/db/ - 15 files
      for (let i = 0; i < 14; i++) {
        deps.push(dep(`src/db/file${i}.ts`, `src/db/file${i + 1}.ts`));
      }

      // Many bridge edges to create multiple potential entry points in db cluster
      deps.push(dep('src/api/file0.ts', 'src/db/file0.ts'));
      deps.push(dep('src/api/file1.ts', 'src/db/file1.ts'));
      deps.push(dep('src/api/file2.ts', 'src/db/file2.ts'));
      deps.push(dep('src/api/file3.ts', 'src/db/file3.ts'));
      deps.push(dep('src/api/file4.ts', 'src/db/file4.ts'));

      const result = computeFileClusters(deps);

      for (const cluster of result) {
        expect(cluster.entryPoints.length).toBeLessThanOrEqual(3);
      }
    });
  });
});
