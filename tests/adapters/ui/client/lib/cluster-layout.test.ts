import { describe, it, expect } from 'vitest';
import { buildLayoutedElements } from '@/adapters/ui/client/src/lib/cluster-layout.js';
import type { Cluster, ClusterRelationships } from '@/adapters/ui/client/src/types.js';

function makeCluster(overrides: Partial<Cluster> & { id: string }): Cluster {
  return {
    name: `Cluster ${overrides.id}`,
    cohesion: 0.5,
    internalEdges: 1,
    externalEdges: 0,
    memberCount: 3,
    ...overrides,
  };
}

describe('buildLayoutedElements', () => {
  it('should return empty nodes and edges for empty input', () => {
    const result = buildLayoutedElements([], null);

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('should produce a node for a single cluster with no relationships', () => {
    const clusters = [makeCluster({ id: 'c1' })];

    const result = buildLayoutedElements(clusters, null);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);

    const node = result.nodes[0];
    expect(node.id).toBe('c1');
    expect(node.type).toBe('clusterNode');
    expect(node.data.cluster.id).toBe('c1');
    expect(node.position).toHaveProperty('x');
    expect(node.position).toHaveProperty('y');
  });

  it('should produce edges for related clusters', () => {
    const clusters = [
      makeCluster({ id: 'c1' }),
      makeCluster({ id: 'c2' }),
    ];
    const relationships: ClusterRelationships = {
      edges: [{ sourceClusterId: 'c1', targetClusterId: 'c2', weight: 2 }],
    };

    const result = buildLayoutedElements(clusters, relationships);

    const clusterNodes = result.nodes.filter((n) => n.type === 'clusterNode');
    expect(clusterNodes).toHaveLength(2);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('c1');
    expect(result.edges[0].target).toBe('c2');
  });

  it('should create halo nodes for connected components', () => {
    const clusters = [
      makeCluster({ id: 'c1' }),
      makeCluster({ id: 'c2' }),
    ];
    const relationships: ClusterRelationships = {
      edges: [{ sourceClusterId: 'c1', targetClusterId: 'c2', weight: 1 }],
    };

    const result = buildLayoutedElements(clusters, relationships);

    const haloNodes = result.nodes.filter((n) => n.type === 'groupBackground');
    expect(haloNodes).toHaveLength(1);
    expect(haloNodes[0].id).toContain('group-halo-');
    expect(haloNodes[0].data).toHaveProperty('width');
    expect(haloNodes[0].data).toHaveProperty('height');
    expect(haloNodes[0].data).toHaveProperty('color');
  });

  it('should not create halo nodes for isolated clusters', () => {
    const clusters = [
      makeCluster({ id: 'c1' }),
      makeCluster({ id: 'c2' }),
    ];

    const result = buildLayoutedElements(clusters, null);

    const haloNodes = result.nodes.filter((n) => n.type === 'groupBackground');
    expect(haloNodes).toHaveLength(0);
  });

  it('should scale node sizes relative to memberCount', () => {
    const clusters = [
      makeCluster({ id: 'small', memberCount: 1 }),
      makeCluster({ id: 'large', memberCount: 10 }),
    ];

    const result = buildLayoutedElements(clusters, null);

    const smallNode = result.nodes.find((n) => n.id === 'small')!;
    const largeNode = result.nodes.find((n) => n.id === 'large')!;

    expect(smallNode.data.width).toBeLessThan(largeNode.data.width);
    expect(smallNode.data.height).toBeLessThan(largeNode.data.height);
  });

  it('should assign groupColor to connected nodes and null to isolated nodes', () => {
    const clusters = [
      makeCluster({ id: 'c1' }),
      makeCluster({ id: 'c2' }),
      makeCluster({ id: 'isolated' }),
    ];
    const relationships: ClusterRelationships = {
      edges: [{ sourceClusterId: 'c1', targetClusterId: 'c2', weight: 1 }],
    };

    const result = buildLayoutedElements(clusters, relationships);

    const clusterNodes = result.nodes.filter((n) => n.type === 'clusterNode');
    const c1Node = clusterNodes.find((n) => n.id === 'c1')!;
    const c2Node = clusterNodes.find((n) => n.id === 'c2')!;
    const isolatedNode = clusterNodes.find((n) => n.id === 'isolated')!;

    expect(c1Node.data.groupColor).not.toBeNull();
    expect(c2Node.data.groupColor).not.toBeNull();
    expect(c1Node.data.groupColor).toEqual(c2Node.data.groupColor);
    expect(isolatedNode.data.groupColor).toBeNull();
  });

  it('should render halo nodes before cluster nodes in array order', () => {
    const clusters = [
      makeCluster({ id: 'c1' }),
      makeCluster({ id: 'c2' }),
    ];
    const relationships: ClusterRelationships = {
      edges: [{ sourceClusterId: 'c1', targetClusterId: 'c2', weight: 1 }],
    };

    const result = buildLayoutedElements(clusters, relationships);

    const firstHaloIndex = result.nodes.findIndex((n) => n.type === 'groupBackground');
    const firstClusterIndex = result.nodes.findIndex((n) => n.type === 'clusterNode');

    expect(firstHaloIndex).toBeLessThan(firstClusterIndex);
  });

  it('should show edge labels only when weight > 1', () => {
    const clusters = [
      makeCluster({ id: 'c1' }),
      makeCluster({ id: 'c2' }),
      makeCluster({ id: 'c3' }),
    ];
    const relationships: ClusterRelationships = {
      edges: [
        { sourceClusterId: 'c1', targetClusterId: 'c2', weight: 1 },
        { sourceClusterId: 'c2', targetClusterId: 'c3', weight: 3 },
      ],
    };

    const result = buildLayoutedElements(clusters, relationships);

    const edgeW1 = result.edges.find((e) => e.source === 'c1')!;
    const edgeW3 = result.edges.find((e) => e.source === 'c2')!;

    expect(edgeW1.label).toBeUndefined();
    expect(edgeW3.label).toBe('3');
  });
});
