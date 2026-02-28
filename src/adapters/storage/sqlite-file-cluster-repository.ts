import type Database from 'better-sqlite3';
import type { RepositoryFileCluster, RepositoryFileClusterMember } from '@/domain/models/index.js';
import type { IFileClusterRepository } from '@/domain/ports/index.js';

interface FileClusterRow {
  id: string;
  name: string;
  cohesion: number;
  internal_edges: number;
  external_edges: number;
}

interface FileClusterMemberRow {
  cluster_id: string;
  file_path: string;
  is_entry_point: number;
}

export class SqliteFileClusterRepository implements IFileClusterRepository {
  private readonly insertClusterStmt: Database.Statement;
  private readonly insertMemberStmt: Database.Statement;
  private readonly selectClusterById: Database.Statement;
  private readonly selectMembersByClusterId: Database.Statement;
  private readonly selectClusterByFilePath: Database.Statement;
  private readonly selectClustersByName: Database.Statement;
  private readonly selectAllClusters: Database.Statement;
  private readonly deleteClusterStmt: Database.Statement;
  private readonly deleteMembersByClusterIdStmt: Database.Statement;
  private readonly clearClustersStmt: Database.Statement;
  private readonly clearMembersStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertClusterStmt = db.prepare(`
      INSERT OR REPLACE INTO file_clusters
        (id, name, cohesion, internal_edges, external_edges)
      VALUES
        (@id, @name, @cohesion, @internal_edges, @external_edges)
    `);

    this.insertMemberStmt = db.prepare(`
      INSERT OR REPLACE INTO file_cluster_members
        (cluster_id, file_path, is_entry_point)
      VALUES
        (@cluster_id, @file_path, @is_entry_point)
    `);

    this.selectClusterById = db.prepare(
      'SELECT * FROM file_clusters WHERE id = ?',
    );

    this.selectMembersByClusterId = db.prepare(
      'SELECT * FROM file_cluster_members WHERE cluster_id = ?',
    );

    this.selectClusterByFilePath = db.prepare(`
      SELECT fc.* FROM file_clusters fc
      INNER JOIN file_cluster_members fcm ON fc.id = fcm.cluster_id
      WHERE fcm.file_path = ?
    `);

    this.selectClustersByName = db.prepare(
      'SELECT * FROM file_clusters WHERE name = ?',
    );

    this.selectAllClusters = db.prepare('SELECT * FROM file_clusters');

    this.deleteClusterStmt = db.prepare('DELETE FROM file_clusters WHERE id = ?');

    this.deleteMembersByClusterIdStmt = db.prepare(
      'DELETE FROM file_cluster_members WHERE cluster_id = ?',
    );

    this.clearClustersStmt = db.prepare('DELETE FROM file_clusters');
    this.clearMembersStmt = db.prepare('DELETE FROM file_cluster_members');
  }

  save(cluster: RepositoryFileCluster, members: RepositoryFileClusterMember[]): void {
    const saveTransaction = this.db.transaction(() => {
      // Delete existing members first (for upsert behavior)
      this.deleteMembersByClusterIdStmt.run(cluster.id);

      this.insertClusterStmt.run({
        id: cluster.id,
        name: cluster.name,
        cohesion: cluster.cohesion,
        internal_edges: cluster.internalEdges,
        external_edges: cluster.externalEdges,
      });

      for (const member of members) {
        this.insertMemberStmt.run({
          cluster_id: member.clusterId,
          file_path: member.filePath,
          is_entry_point: member.isEntryPoint ? 1 : 0,
        });
      }
    });
    saveTransaction();
  }

  saveBatch(clusters: Array<{ cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] }>): void {
    const batchTransaction = this.db.transaction(() => {
      for (const item of clusters) {
        this.save(item.cluster, item.members);
      }
    });
    batchTransaction();
  }

  findById(id: string): { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] } | undefined {
    const row = this.selectClusterById.get(id) as FileClusterRow | undefined;
    if (!row) return undefined;
    const memberRows = this.selectMembersByClusterId.all(id) as FileClusterMemberRow[];
    return {
      cluster: this.rowToCluster(row),
      members: memberRows.map(m => this.rowToMember(m)),
    };
  }

  findByFilePath(filePath: string): { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] } | undefined {
    const row = this.selectClusterByFilePath.get(filePath) as FileClusterRow | undefined;
    if (!row) return undefined;
    const memberRows = this.selectMembersByClusterId.all(row.id) as FileClusterMemberRow[];
    return {
      cluster: this.rowToCluster(row),
      members: memberRows.map(m => this.rowToMember(m)),
    };
  }

  findByName(name: string): { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] }[] {
    const rows = this.selectClustersByName.all(name) as FileClusterRow[];
    return rows.map(row => {
      const memberRows = this.selectMembersByClusterId.all(row.id) as FileClusterMemberRow[];
      return {
        cluster: this.rowToCluster(row),
        members: memberRows.map(m => this.rowToMember(m)),
      };
    });
  }

  findAll(): { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] }[] {
    const rows = this.selectAllClusters.all() as FileClusterRow[];
    return rows.map(row => {
      const memberRows = this.selectMembersByClusterId.all(row.id) as FileClusterMemberRow[];
      return {
        cluster: this.rowToCluster(row),
        members: memberRows.map(m => this.rowToMember(m)),
      };
    });
  }

  clear(): void {
    const clearTransaction = this.db.transaction(() => {
      this.clearMembersStmt.run();
      this.clearClustersStmt.run();
    });
    clearTransaction();
  }

  private rowToCluster(row: FileClusterRow): RepositoryFileCluster {
    return {
      id: row.id,
      name: row.name,
      cohesion: row.cohesion,
      internalEdges: row.internal_edges,
      externalEdges: row.external_edges,
    };
  }

  private rowToMember(row: FileClusterMemberRow): RepositoryFileClusterMember {
    return {
      clusterId: row.cluster_id,
      filePath: row.file_path,
      isEntryPoint: row.is_entry_point === 1,
    };
  }
}
