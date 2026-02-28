import type { RepositoryFileCluster, RepositoryFileClusterMember } from '@/domain/models/index.js';
import type { IFileClusterRepository } from '@/domain/ports/index.js';

export class InMemoryFileClusterRepository implements IFileClusterRepository {
  private readonly clusters = new Map<string, RepositoryFileCluster>();
  private readonly members = new Map<string, RepositoryFileClusterMember[]>();

  save(cluster: RepositoryFileCluster, clusterMembers: RepositoryFileClusterMember[]): void {
    this.clusters.set(cluster.id, cluster);
    this.members.set(cluster.id, clusterMembers);
  }

  saveBatch(items: Array<{ cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] }>): void {
    for (const item of items) {
      this.save(item.cluster, item.members);
    }
  }

  findById(id: string): { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] } | undefined {
    const cluster = this.clusters.get(id);
    if (!cluster) return undefined;
    return { cluster, members: this.members.get(id) ?? [] };
  }

  findByFilePath(filePath: string): { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] } | undefined {
    for (const [clusterId, clusterMembers] of this.members) {
      if (clusterMembers.some(m => m.filePath === filePath)) {
        const cluster = this.clusters.get(clusterId);
        if (cluster) return { cluster, members: clusterMembers };
      }
    }
    return undefined;
  }

  findByName(name: string): { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] }[] {
    const results: { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] }[] = [];
    for (const cluster of this.clusters.values()) {
      if (cluster.name === name) {
        results.push({ cluster, members: this.members.get(cluster.id) ?? [] });
      }
    }
    return results;
  }

  findAll(): { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] }[] {
    const results: { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] }[] = [];
    for (const cluster of this.clusters.values()) {
      results.push({ cluster, members: this.members.get(cluster.id) ?? [] });
    }
    return results;
  }

  clear(): void {
    this.clusters.clear();
    this.members.clear();
  }
}
