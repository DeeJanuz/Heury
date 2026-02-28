import { randomUUID } from 'node:crypto';

export interface RepositoryFileCluster {
  readonly id: string;
  readonly name: string;
  readonly cohesion: number;
  readonly internalEdges: number;
  readonly externalEdges: number;
}

export interface RepositoryFileClusterMember {
  readonly clusterId: string;
  readonly filePath: string;
  readonly isEntryPoint: boolean;
}

interface CreateFileClusterParams {
  id?: string;
  name: string;
  cohesion: number;
  internalEdges: number;
  externalEdges: number;
}

interface CreateFileClusterMemberParams {
  clusterId: string;
  filePath: string;
  isEntryPoint: boolean;
}

export function createFileCluster(params: CreateFileClusterParams): RepositoryFileCluster {
  if (!params.name) throw new Error('name must not be empty');
  if (params.cohesion < 0 || params.cohesion > 1) throw new Error('cohesion must be between 0 and 1');
  if (params.internalEdges < 0) throw new Error('internalEdges must be >= 0');
  if (params.externalEdges < 0) throw new Error('externalEdges must be >= 0');
  return {
    id: params.id ?? randomUUID(),
    name: params.name,
    cohesion: params.cohesion,
    internalEdges: params.internalEdges,
    externalEdges: params.externalEdges,
  };
}

export function createFileClusterMember(params: CreateFileClusterMemberParams): RepositoryFileClusterMember {
  if (!params.clusterId) throw new Error('clusterId must not be empty');
  if (!params.filePath) throw new Error('filePath must not be empty');
  return {
    clusterId: params.clusterId,
    filePath: params.filePath,
    isEntryPoint: params.isEntryPoint,
  };
}
