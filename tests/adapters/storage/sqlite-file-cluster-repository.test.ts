import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '@/adapters/storage/database.js';
import { SqliteFileClusterRepository } from '@/adapters/storage/sqlite-file-cluster-repository.js';
import { createFileCluster, createFileClusterMember } from '@/domain/models/index.js';

describe('SqliteFileClusterRepository', () => {
  let dbManager: DatabaseManager;
  let repo: SqliteFileClusterRepository;

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:', inMemory: true });
    dbManager.initialize();
    repo = new SqliteFileClusterRepository(dbManager.getDatabase());
  });

  afterEach(() => {
    dbManager.close();
  });

  it('should save and find a cluster by id', () => {
    const cluster = createFileCluster({
      id: 'cluster-1',
      name: 'auth-module',
      cohesion: 0.85,
      internalEdges: 12,
      externalEdges: 3,
    });
    const members = [
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/auth/login.ts', isEntryPoint: false }),
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/auth/index.ts', isEntryPoint: true }),
    ];

    repo.save(cluster, members);

    const found = repo.findById('cluster-1');
    expect(found).toBeDefined();
    expect(found!.cluster.id).toBe('cluster-1');
    expect(found!.cluster.name).toBe('auth-module');
    expect(found!.cluster.cohesion).toBe(0.85);
    expect(found!.cluster.internalEdges).toBe(12);
    expect(found!.cluster.externalEdges).toBe(3);
    expect(found!.members).toHaveLength(2);
  });

  it('should return undefined for non-existent id', () => {
    expect(repo.findById('non-existent')).toBeUndefined();
  });

  it('should save and find cluster by file path', () => {
    const cluster = createFileCluster({
      id: 'cluster-1',
      name: 'auth-module',
      cohesion: 0.85,
      internalEdges: 12,
      externalEdges: 3,
    });
    const members = [
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/auth/login.ts', isEntryPoint: false }),
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/auth/index.ts', isEntryPoint: true }),
    ];

    repo.save(cluster, members);

    const found = repo.findByFilePath('src/auth/login.ts');
    expect(found).toBeDefined();
    expect(found!.cluster.id).toBe('cluster-1');
    expect(found!.members).toHaveLength(2);
  });

  it('should return undefined for non-existent file path', () => {
    expect(repo.findByFilePath('non-existent.ts')).toBeUndefined();
  });

  it('should find clusters by name', () => {
    const cluster1 = createFileCluster({
      id: 'cluster-1',
      name: 'auth-module',
      cohesion: 0.85,
      internalEdges: 12,
      externalEdges: 3,
    });
    const cluster2 = createFileCluster({
      id: 'cluster-2',
      name: 'auth-module',
      cohesion: 0.75,
      internalEdges: 8,
      externalEdges: 5,
    });

    repo.save(cluster1, [
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/auth/login.ts', isEntryPoint: false }),
    ]);
    repo.save(cluster2, [
      createFileClusterMember({ clusterId: 'cluster-2', filePath: 'src/auth/signup.ts', isEntryPoint: false }),
    ]);

    const found = repo.findByName('auth-module');
    expect(found).toHaveLength(2);
  });

  it('should return empty array for non-existent name', () => {
    expect(repo.findByName('non-existent')).toHaveLength(0);
  });

  it('should find all clusters', () => {
    const cluster1 = createFileCluster({
      id: 'cluster-1',
      name: 'auth-module',
      cohesion: 0.85,
      internalEdges: 12,
      externalEdges: 3,
    });
    const cluster2 = createFileCluster({
      id: 'cluster-2',
      name: 'data-layer',
      cohesion: 0.9,
      internalEdges: 15,
      externalEdges: 2,
    });

    repo.save(cluster1, [
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/auth/login.ts', isEntryPoint: false }),
    ]);
    repo.save(cluster2, [
      createFileClusterMember({ clusterId: 'cluster-2', filePath: 'src/data/repo.ts', isEntryPoint: true }),
    ]);

    const all = repo.findAll();
    expect(all).toHaveLength(2);
  });

  it('should batch save multiple clusters', () => {
    const batch = [
      {
        cluster: createFileCluster({ id: 'c-1', name: 'auth', cohesion: 0.8, internalEdges: 10, externalEdges: 2 }),
        members: [
          createFileClusterMember({ clusterId: 'c-1', filePath: 'src/auth/login.ts', isEntryPoint: false }),
          createFileClusterMember({ clusterId: 'c-1', filePath: 'src/auth/index.ts', isEntryPoint: true }),
        ],
      },
      {
        cluster: createFileCluster({ id: 'c-2', name: 'data', cohesion: 0.9, internalEdges: 15, externalEdges: 1 }),
        members: [
          createFileClusterMember({ clusterId: 'c-2', filePath: 'src/data/repo.ts', isEntryPoint: true }),
        ],
      },
    ];

    repo.saveBatch(batch);

    const all = repo.findAll();
    expect(all).toHaveLength(2);
    expect(all[0].members.length + all[1].members.length).toBe(3);
  });

  it('should clear all data', () => {
    const cluster = createFileCluster({
      id: 'cluster-1',
      name: 'auth-module',
      cohesion: 0.85,
      internalEdges: 12,
      externalEdges: 3,
    });
    repo.save(cluster, [
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/auth/login.ts', isEntryPoint: false }),
    ]);

    repo.clear();

    expect(repo.findAll()).toHaveLength(0);
    expect(repo.findById('cluster-1')).toBeUndefined();
  });

  it('should correctly store and retrieve entry point flag', () => {
    const cluster = createFileCluster({
      id: 'cluster-1',
      name: 'auth-module',
      cohesion: 0.85,
      internalEdges: 12,
      externalEdges: 3,
    });
    const members = [
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/auth/login.ts', isEntryPoint: false }),
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/auth/index.ts', isEntryPoint: true }),
    ];

    repo.save(cluster, members);

    const found = repo.findById('cluster-1');
    expect(found).toBeDefined();
    const loginMember = found!.members.find(m => m.filePath === 'src/auth/login.ts');
    const indexMember = found!.members.find(m => m.filePath === 'src/auth/index.ts');
    expect(loginMember!.isEntryPoint).toBe(false);
    expect(indexMember!.isEntryPoint).toBe(true);
  });

  it('should handle multiple files in the same cluster', () => {
    const cluster = createFileCluster({
      id: 'cluster-1',
      name: 'auth-module',
      cohesion: 0.85,
      internalEdges: 12,
      externalEdges: 3,
    });
    const members = [
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/auth/login.ts', isEntryPoint: false }),
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/auth/signup.ts', isEntryPoint: false }),
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/auth/logout.ts', isEntryPoint: false }),
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/auth/index.ts', isEntryPoint: true }),
    ];

    repo.save(cluster, members);

    const found = repo.findById('cluster-1');
    expect(found!.members).toHaveLength(4);
  });

  it('should find the correct cluster when a file belongs to one cluster', () => {
    const cluster1 = createFileCluster({
      id: 'c-1',
      name: 'auth',
      cohesion: 0.8,
      internalEdges: 10,
      externalEdges: 2,
    });
    const cluster2 = createFileCluster({
      id: 'c-2',
      name: 'data',
      cohesion: 0.9,
      internalEdges: 15,
      externalEdges: 1,
    });

    repo.save(cluster1, [
      createFileClusterMember({ clusterId: 'c-1', filePath: 'src/auth/login.ts', isEntryPoint: false }),
    ]);
    repo.save(cluster2, [
      createFileClusterMember({ clusterId: 'c-2', filePath: 'src/data/repo.ts', isEntryPoint: true }),
    ]);

    const found = repo.findByFilePath('src/data/repo.ts');
    expect(found).toBeDefined();
    expect(found!.cluster.id).toBe('c-2');
    expect(found!.cluster.name).toBe('data');
  });

  it('should overwrite existing cluster on save with same id', () => {
    const cluster = createFileCluster({
      id: 'cluster-1',
      name: 'original',
      cohesion: 0.5,
      internalEdges: 5,
      externalEdges: 5,
    });
    repo.save(cluster, [
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/old.ts', isEntryPoint: false }),
    ]);

    const updated = createFileCluster({
      id: 'cluster-1',
      name: 'updated',
      cohesion: 0.9,
      internalEdges: 15,
      externalEdges: 1,
    });
    repo.save(updated, [
      createFileClusterMember({ clusterId: 'cluster-1', filePath: 'src/new.ts', isEntryPoint: true }),
    ]);

    const found = repo.findById('cluster-1');
    expect(found).toBeDefined();
    expect(found!.cluster.name).toBe('updated');
    expect(found!.cluster.cohesion).toBe(0.9);
    expect(found!.members).toHaveLength(1);
    expect(found!.members[0].filePath).toBe('src/new.ts');
  });
});
