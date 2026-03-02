/**
 * D3-force layout engine for cluster graph positioning.
 */

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { type Node, type Edge, Position } from '@xyflow/react';
import type { Cluster, ClusterRelationships } from '../types';
import { findConnectedComponents } from './graph-utils';
import { getGroupColor } from './cluster-colors';

const BASE_WIDTH = 180;
const BASE_HEIGHT = 70;
const HALO_PADDING = 50;

interface SimNode extends SimulationNodeDatum {
  id: string;
  cluster: Cluster;
  width: number;
  height: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  weight: number;
}

export function buildLayoutedElements(
  clusters: Cluster[],
  relationships: ClusterRelationships | null,
): { nodes: Node[]; edges: Edge[] } {
  if (clusters.length === 0) return { nodes: [], edges: [] };

  const maxMemberCount = Math.max(...clusters.map((c) => c.memberCount), 1);

  // Dynamic sizing: scale 0.7x-1.4x of base size relative to max memberCount
  const clusterSizes = new Map<string, { width: number; height: number }>();
  for (const c of clusters) {
    const scale = 0.7 + 0.7 * (c.memberCount / maxMemberCount);
    clusterSizes.set(c.id, {
      width: Math.round(BASE_WIDTH * scale),
      height: Math.round(BASE_HEIGHT * scale),
    });
  }

  const rawEdges = relationships?.edges ?? [];

  // Find connected components for initial positioning
  const components = findConnectedComponents(
    clusters.map((c) => c.id),
    rawEdges,
  );

  const connectedComponents = components.filter((comp) => comp.length > 1);
  const isolatedNodes = components.filter((comp) => comp.length === 1).map((comp) => comp[0]);

  const layoutRadius = Math.max(200, clusters.length * 30);
  const innerRadius = layoutRadius * 0.5;
  const outerRadius = layoutRadius * 0.85;

  // Assign initial positions
  const initialPositions = new Map<string, { x: number; y: number }>();

  // Place connected components at evenly spaced angles on the inner ring
  connectedComponents.forEach((comp, i) => {
    const angle = (2 * Math.PI * i) / Math.max(connectedComponents.length, 1);
    const cx = Math.cos(angle) * innerRadius;
    const cy = Math.sin(angle) * innerRadius;
    comp.forEach((id, j) => {
      // Spread members of a component around its center
      const memberAngle = angle + ((j - (comp.length - 1) / 2) * 0.3);
      const memberRadius = innerRadius + (j * 20 - (comp.length * 10));
      initialPositions.set(id, {
        x: cx + Math.cos(memberAngle) * Math.abs(memberRadius - innerRadius + 30),
        y: cy + Math.sin(memberAngle) * Math.abs(memberRadius - innerRadius + 30),
      });
    });
  });

  // Place isolated nodes on the outer ring with slight random radial variation
  isolatedNodes.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(isolatedNodes.length, 1);
    const radialVariation = (Math.sin(i * 7.3) * 0.15 + 1) * outerRadius; // deterministic pseudo-random
    initialPositions.set(id, {
      x: Math.cos(angle) * radialVariation,
      y: Math.sin(angle) * radialVariation,
    });
  });

  // Build simulation nodes
  const simNodes: SimNode[] = clusters.map((cluster) => {
    const pos = initialPositions.get(cluster.id) ?? { x: 0, y: 0 };
    const size = clusterSizes.get(cluster.id)!;
    return {
      id: cluster.id,
      x: pos.x,
      y: pos.y,
      cluster,
      width: size.width,
      height: size.height,
    };
  });

  const nodeById = new Map(simNodes.map((n) => [n.id, n]));

  // Build simulation links
  const simLinks: SimLink[] = rawEdges
    .filter((e) => nodeById.has(e.sourceClusterId) && nodeById.has(e.targetClusterId))
    .map((e) => ({
      source: e.sourceClusterId,
      target: e.targetClusterId,
      weight: e.weight,
    }));

  // Build edges for React Flow
  const edges: Edge[] = rawEdges
    .filter((e) => nodeById.has(e.sourceClusterId) && nodeById.has(e.targetClusterId))
    .map((rel) => ({
      id: `${rel.sourceClusterId}-${rel.targetClusterId}`,
      source: rel.sourceClusterId,
      target: rel.targetClusterId,
      style: { stroke: '#94a3b8', strokeWidth: Math.min(1 + rel.weight * 0.5, 4) },
      animated: true,
      label: rel.weight > 1 ? String(rel.weight) : undefined,
    }));

  // Configure and run d3-force simulation
  const simulation = forceSimulation<SimNode>(simNodes)
    .force(
      'charge',
      forceManyBody<SimNode>().strength((d) => {
        const radius = Math.sqrt(d.width * d.width + d.height * d.height) / 2;
        return -150 - radius * 2;
      }),
    )
    .force(
      'link',
      forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(200)
        .strength((d) => Math.min(0.1 + d.weight * 0.1, 0.7)),
    )
    .force('center', forceCenter(0, 0).strength(0.05))
    .force(
      'collide',
      forceCollide<SimNode>()
        .radius((d) => {
          const halfDiagonal = Math.sqrt(d.width * d.width + d.height * d.height) / 2;
          return halfDiagonal + 20;
        })
        .iterations(3),
    )
    .force('forceX', forceX<SimNode>(0).strength(0.02))
    .force('forceY', forceY<SimNode>(0).strength(0.02))
    .stop();

  // Run synchronously (no animation)
  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  // Build group color assignments: nodeId -> groupColor (or null for isolated)
  const nodeGroupColor = new Map<string, ReturnType<typeof getGroupColor> | null>();
  let groupIndex = 0;
  for (const comp of components) {
    if (comp.length > 1) {
      const color = getGroupColor(groupIndex);
      for (const id of comp) {
        nodeGroupColor.set(id, color);
      }
      groupIndex++;
    } else {
      nodeGroupColor.set(comp[0], null);
    }
  }

  // Map final positions to React Flow nodes
  const clusterNodes: Node[] = simNodes.map((simNode) => ({
    id: simNode.id,
    position: {
      x: (simNode.x ?? 0) - simNode.width / 2,
      y: (simNode.y ?? 0) - simNode.height / 2,
    },
    data: {
      cluster: simNode.cluster,
      width: simNode.width,
      height: simNode.height,
      groupColor: nodeGroupColor.get(simNode.id) ?? null,
    },
    type: 'clusterNode',
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

  // Build background halo nodes for connected components
  const haloNodes: Node[] = [];
  groupIndex = 0;
  for (const comp of components) {
    if (comp.length <= 1) continue;
    const color = getGroupColor(groupIndex);
    groupIndex++;

    // Compute bounding box from final sim positions
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of comp) {
      const sn = nodeById.get(id)!;
      const cx = sn.x ?? 0;
      const cy = sn.y ?? 0;
      minX = Math.min(minX, cx - sn.width / 2);
      minY = Math.min(minY, cy - sn.height / 2);
      maxX = Math.max(maxX, cx + sn.width / 2);
      maxY = Math.max(maxY, cy + sn.height / 2);
    }

    const haloWidth = (maxX - minX) + HALO_PADDING * 2;
    const haloHeight = (maxY - minY) + HALO_PADDING * 2;

    haloNodes.push({
      id: `group-halo-${comp[0]}`,
      position: {
        x: minX - HALO_PADDING,
        y: minY - HALO_PADDING,
      },
      data: {
        width: haloWidth,
        height: haloHeight,
        color,
      },
      type: 'groupBackground',
      selectable: false,
      draggable: false,
      connectable: false,
      style: { zIndex: -1 },
    });
  }

  // Halo nodes first so they render behind cluster nodes
  const nodes: Node[] = [...haloNodes, ...clusterNodes];

  return { nodes, edges };
}
