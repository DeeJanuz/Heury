/**
 * Custom React Flow node components for the cluster graph.
 */

import React from 'react';
import type { Cluster } from '../types';
import type { GroupColor } from '../lib/cluster-colors';

const BASE_WIDTH = 180;

export interface ClusterNodeData {
  cluster: Cluster;
  width?: number;
  height?: number;
  groupColor: GroupColor | null;
}

export const ClusterNode: React.FC<{
  data: ClusterNodeData;
  selected?: boolean;
}> = ({ data, selected }) => {
  const { cluster, groupColor } = data;
  const width = data.width ?? BASE_WIDTH;
  const cohesionPercent = Math.round(cluster.cohesion * 100);
  const cohesionColor =
    cohesionPercent >= 70 ? '#22c55e' : cohesionPercent >= 40 ? '#f59e0b' : '#ef4444';

  const borderColor = selected
    ? (groupColor?.border ?? '#4361ee')
    : (groupColor?.border ?? '#e0e0e0');
  const bgColor = selected
    ? (groupColor?.bgSelected ?? '#e8eaf6')
    : (groupColor?.bgLight ?? '#fff');
  const shadowColor = groupColor
    ? `0 ${selected ? '4px 12px' : '2px 8px'} hsla(${groupColor.hue}, 55%, 50%, ${selected ? 0.3 : 0.1})`
    : selected ? '0 4px 12px rgba(67, 97, 238, 0.3)' : '0 2px 8px rgba(0,0,0,0.08)';

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: bgColor,
        border: `2px solid ${borderColor}`,
        boxShadow: shadowColor,
        width,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <div
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#1a1a2e',
          marginBottom: '6px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {cluster.name}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#666' }}>
        <span>{cluster.memberCount} units</span>
        <span style={{ color: cohesionColor, fontWeight: 600 }}>{cohesionPercent}% cohesion</span>
      </div>
    </div>
  );
};

export interface GroupBackgroundNodeData {
  width: number;
  height: number;
  color: GroupColor;
}

export const GroupBackgroundNode: React.FC<{
  data: GroupBackgroundNodeData;
}> = ({ data }) => {
  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        borderRadius: '16px',
        backgroundColor: data.color.haloFill,
        border: `2px dashed ${data.color.haloBorder}`,
        pointerEvents: 'none',
      }}
    />
  );
};

export const nodeTypes = {
  clusterNode: ClusterNode,
  groupBackground: GroupBackgroundNode,
};
