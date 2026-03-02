import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Cluster, ClusterRelationships } from '../types';
import type { GroupColor } from '../lib/cluster-colors';
import { buildLayoutedElements } from '../lib/cluster-layout';
import { nodeTypes } from './cluster-nodes';
import { ClusterSearch } from './ClusterSearch';

interface ClusterGraphProps {
  clusters: Cluster[];
  relationships: ClusterRelationships | null;
  selectedClusterId: string | null;
  onClusterClick: (clusterId: string) => void;
}

export const ClusterGraph: React.FC<ClusterGraphProps> = ({
  clusters,
  relationships,
  selectedClusterId,
  onClusterClick,
}) => {
  const { nodes, edges } = useMemo(
    () => buildLayoutedElements(clusters, relationships),
    [clusters, relationships],
  );

  const nodesWithSelection = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedClusterId,
      })),
    [nodes, selectedClusterId],
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === 'groupBackground') return;
      onClusterClick(node.id);
    },
    [onClusterClick],
  );

  if (clusters.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#999',
          fontSize: '14px',
        }}
      >
        No clusters to display
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodesWithSelection}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.3}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <ClusterSearch clusters={clusters} onClusterClick={onClusterClick} />
      <Background color="#e0e0e0" gap={20} />
      <Controls />
      <MiniMap
        nodeColor={(node) => {
          if (node.type === 'groupBackground') return 'transparent';
          const gc = (node.data as { groupColor?: GroupColor | null })?.groupColor;
          return gc?.minimap ?? '#4361ee';
        }}
        style={{ backgroundColor: '#f5f5f5' }}
      />
    </ReactFlow>
  );
};
