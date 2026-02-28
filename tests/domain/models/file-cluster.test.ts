import { describe, it, expect } from 'vitest';
import { createFileCluster, createFileClusterMember } from '@/domain/models/file-cluster.js';

describe('createFileCluster', () => {
  it('should create a file cluster with required fields and generated id', () => {
    const cluster = createFileCluster({
      name: 'auth-module',
      cohesion: 0.85,
      internalEdges: 12,
      externalEdges: 3,
    });

    expect(cluster.name).toBe('auth-module');
    expect(cluster.cohesion).toBe(0.85);
    expect(cluster.internalEdges).toBe(12);
    expect(cluster.externalEdges).toBe(3);
    expect(cluster.id).toBeDefined();
  });

  it('should use provided id when given', () => {
    const cluster = createFileCluster({
      id: 'custom-id',
      name: 'auth-module',
      cohesion: 0.85,
      internalEdges: 12,
      externalEdges: 3,
    });

    expect(cluster.id).toBe('custom-id');
  });

  it('should throw when name is empty', () => {
    expect(() =>
      createFileCluster({
        name: '',
        cohesion: 0.85,
        internalEdges: 12,
        externalEdges: 3,
      }),
    ).toThrow('name must not be empty');
  });

  it('should throw when cohesion is negative', () => {
    expect(() =>
      createFileCluster({
        name: 'auth',
        cohesion: -0.1,
        internalEdges: 12,
        externalEdges: 3,
      }),
    ).toThrow('cohesion must be between 0 and 1');
  });

  it('should throw when cohesion is greater than 1', () => {
    expect(() =>
      createFileCluster({
        name: 'auth',
        cohesion: 1.1,
        internalEdges: 12,
        externalEdges: 3,
      }),
    ).toThrow('cohesion must be between 0 and 1');
  });

  it('should throw when internalEdges is negative', () => {
    expect(() =>
      createFileCluster({
        name: 'auth',
        cohesion: 0.5,
        internalEdges: -1,
        externalEdges: 3,
      }),
    ).toThrow('internalEdges must be >= 0');
  });

  it('should throw when externalEdges is negative', () => {
    expect(() =>
      createFileCluster({
        name: 'auth',
        cohesion: 0.5,
        internalEdges: 12,
        externalEdges: -1,
      }),
    ).toThrow('externalEdges must be >= 0');
  });

  it('should allow cohesion of exactly 0', () => {
    const cluster = createFileCluster({
      name: 'loose-group',
      cohesion: 0,
      internalEdges: 0,
      externalEdges: 5,
    });

    expect(cluster.cohesion).toBe(0);
  });

  it('should allow cohesion of exactly 1', () => {
    const cluster = createFileCluster({
      name: 'tight-group',
      cohesion: 1,
      internalEdges: 10,
      externalEdges: 0,
    });

    expect(cluster.cohesion).toBe(1);
  });
});

describe('createFileClusterMember', () => {
  it('should create a member with required fields', () => {
    const member = createFileClusterMember({
      clusterId: 'cluster-1',
      filePath: 'src/auth/login.ts',
      isEntryPoint: false,
    });

    expect(member.clusterId).toBe('cluster-1');
    expect(member.filePath).toBe('src/auth/login.ts');
    expect(member.isEntryPoint).toBe(false);
  });

  it('should create a member that is an entry point', () => {
    const member = createFileClusterMember({
      clusterId: 'cluster-1',
      filePath: 'src/auth/index.ts',
      isEntryPoint: true,
    });

    expect(member.isEntryPoint).toBe(true);
  });

  it('should throw when clusterId is empty', () => {
    expect(() =>
      createFileClusterMember({
        clusterId: '',
        filePath: 'src/auth/login.ts',
        isEntryPoint: false,
      }),
    ).toThrow('clusterId must not be empty');
  });

  it('should throw when filePath is empty', () => {
    expect(() =>
      createFileClusterMember({
        clusterId: 'cluster-1',
        filePath: '',
        isEntryPoint: false,
      }),
    ).toThrow('filePath must not be empty');
  });
});
