/**
 * MCP tool: get-feature-area
 * Rich context about a file cluster (feature area): metadata, code units,
 * internal/external dependencies, aggregated patterns, entry points, and summary.
 */

import type {
  IFileClusterRepository,
  ICodeUnitRepository,
  IFileDependencyRepository,
} from '@/domain/ports/index.js';
import type { RepositoryFileCluster, RepositoryFileClusterMember } from '@/domain/models/index.js';
import { buildToolResponse, buildErrorResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  fileClusterRepo: IFileClusterRepository;
  codeUnitRepo: ICodeUnitRepository;
  dependencyRepo: IFileDependencyRepository;
}

interface CodeUnitOutput {
  name: string;
  filePath: string;
  unitType: string;
  lineStart: number;
  lineEnd: number;
  signature?: string;
  complexity?: number;
  patterns: Array<{ patternType: string; patternValue: string }>;
}

interface InternalDep {
  source: string;
  target: string;
}

interface ExternalDep {
  source: string;
  target: string;
  direction: 'inbound' | 'outbound';
}

interface PatternCount {
  patternType: string;
  count: number;
}

export function createGetFeatureAreaTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-feature-area',
    description:
      'Get rich context about a feature area (file cluster): metadata, code units, dependencies, patterns, and summary.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Find the feature area containing this file path',
        },
        cluster_name: {
          type: 'string',
          description: 'Find a feature area by cluster name',
        },
        cluster_id: {
          type: 'string',
          description: 'Find a feature area by cluster ID',
        },
      },
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const clusterId = typeof args.cluster_id === 'string' ? args.cluster_id : undefined;
    const filePath = typeof args.file_path === 'string' ? args.file_path : undefined;
    const clusterName = typeof args.cluster_name === 'string' ? args.cluster_name : undefined;

    if (!clusterId && !filePath && !clusterName) {
      return buildErrorResponse(
        'Provide at least one of: cluster_id, file_path, or cluster_name',
      );
    }

    const resolved = resolveCluster(deps.fileClusterRepo, { clusterId, filePath, clusterName });
    if (!resolved) {
      return buildErrorResponse('Cluster not found');
    }

    const { cluster, members } = resolved;
    const clusterFilePaths = members.map((m) => m.filePath);
    const clusterFileSet = new Set(clusterFilePaths);
    const entryPoints = members.filter((m) => m.isEntryPoint).map((m) => m.filePath);

    // Gather code units for all files in cluster
    const codeUnits = collectCodeUnits(deps.codeUnitRepo, clusterFilePaths);

    // Gather and classify dependencies
    const { internalDeps, externalDeps } = classifyDependencies(
      deps.dependencyRepo,
      clusterFilePaths,
      clusterFileSet,
    );

    // Aggregate patterns
    const patternSummary = aggregatePatterns(codeUnits);

    // Build summary string
    const summary = buildSummary(cluster, clusterFilePaths, codeUnits, patternSummary, entryPoints);

    const data = {
      cluster: {
        id: cluster.id,
        name: cluster.name,
        cohesion: cluster.cohesion,
        internalEdges: cluster.internalEdges,
        externalEdges: cluster.externalEdges,
        files: clusterFilePaths,
        entryPoints,
      },
      codeUnits,
      internalDeps,
      externalDeps,
      patternSummary,
      summary,
    };

    return buildToolResponse(data);
  };

  return { definition, handler };
}

function resolveCluster(
  repo: IFileClusterRepository,
  input: { clusterId?: string; filePath?: string; clusterName?: string },
): { cluster: RepositoryFileCluster; members: RepositoryFileClusterMember[] } | undefined {
  if (input.clusterId) {
    return repo.findById(input.clusterId);
  }
  if (input.filePath) {
    return repo.findByFilePath(input.filePath);
  }
  if (input.clusterName) {
    const matches = repo.findByName(input.clusterName);
    return matches.length > 0 ? matches[0] : undefined;
  }
  return undefined;
}

function collectCodeUnits(
  repo: ICodeUnitRepository,
  filePaths: string[],
): CodeUnitOutput[] {
  const results: CodeUnitOutput[] = [];
  for (const fp of filePaths) {
    const units = repo.findByFilePath(fp);
    for (const unit of units) {
      const output: CodeUnitOutput = {
        name: unit.name,
        filePath: unit.filePath,
        unitType: unit.unitType,
        lineStart: unit.lineStart,
        lineEnd: unit.lineEnd,
        patterns: unit.patterns.map((p) => ({
          patternType: p.patternType,
          patternValue: p.patternValue,
        })),
      };
      if (unit.signature) {
        output.signature = unit.signature;
      }
      if (unit.complexityScore > 0) {
        output.complexity = unit.complexityScore;
      }
      results.push(output);
    }
  }
  return results;
}

function classifyDependencies(
  repo: IFileDependencyRepository,
  filePaths: string[],
  clusterFileSet: Set<string>,
): { internalDeps: InternalDep[]; externalDeps: ExternalDep[] } {
  const internalDeps: InternalDep[] = [];
  const externalDeps: ExternalDep[] = [];
  const seen = new Set<string>();

  for (const fp of filePaths) {
    // Outgoing edges
    const outgoing = repo.findBySourceFile(fp);
    for (const dep of outgoing) {
      const key = `${dep.sourceFile}->${dep.targetFile}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (clusterFileSet.has(dep.targetFile)) {
        internalDeps.push({ source: dep.sourceFile, target: dep.targetFile });
      } else {
        externalDeps.push({
          source: dep.sourceFile,
          target: dep.targetFile,
          direction: 'outbound',
        });
      }
    }

    // Incoming edges
    const incoming = repo.findByTargetFile(fp);
    for (const dep of incoming) {
      const key = `${dep.sourceFile}->${dep.targetFile}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (!clusterFileSet.has(dep.sourceFile)) {
        externalDeps.push({
          source: dep.sourceFile,
          target: dep.targetFile,
          direction: 'inbound',
        });
      }
      // If source is in cluster, it's an internal dep already captured by outgoing
    }
  }

  return { internalDeps, externalDeps };
}

function aggregatePatterns(codeUnits: CodeUnitOutput[]): PatternCount[] {
  const counts = new Map<string, number>();
  for (const unit of codeUnits) {
    for (const pattern of unit.patterns) {
      counts.set(pattern.patternType, (counts.get(pattern.patternType) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([patternType, count]) => ({ patternType, count }))
    .sort((a, b) => b.count - a.count);
}

function buildSummary(
  cluster: RepositoryFileCluster,
  filePaths: string[],
  codeUnits: CodeUnitOutput[],
  patternSummary: PatternCount[],
  entryPoints: string[],
): string {
  const parts: string[] = [];
  parts.push(
    `Feature area '${cluster.name}' contains ${filePaths.length} files with ${codeUnits.length} code units.`,
  );
  parts.push(`Cohesion: ${cluster.cohesion}.`);

  if (patternSummary.length > 0) {
    const topPatterns = patternSummary
      .slice(0, 3)
      .map((p) => `${p.patternType} (${p.count})`)
      .join(', ');
    parts.push(`Top patterns: ${topPatterns}.`);
  }

  if (entryPoints.length > 0) {
    const epNames = entryPoints.map((ep) => ep.split('/').pop()).join(', ');
    parts.push(`Entry points: ${epNames}.`);
  }

  return parts.join(' ');
}
