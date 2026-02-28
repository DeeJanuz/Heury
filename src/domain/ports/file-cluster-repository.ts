import type { RepositoryFileCluster, RepositoryFileClusterMember } from '@/domain/models/index.js';

export interface IFileClusterRepository {
  save(cluster: RepositoryFileCluster, members: RepositoryFileClusterMember[]): void;
  saveBatch(clusters: Array<{ cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] }>): void;
  findById(id: string): { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] } | undefined;
  findByFilePath(filePath: string): { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] } | undefined;
  findByName(name: string): { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] }[];
  findAll(): { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] }[];
  clear(): void;
}
