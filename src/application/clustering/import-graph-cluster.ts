import { randomUUID } from 'node:crypto';

import type { FileDependency } from '@/domain/models/index.js';

export interface FileCluster {
  readonly id: string;
  readonly name: string;
  readonly files: string[];
  readonly cohesion: number;
  readonly entryPoints: string[];
  readonly internalEdges: number;
  readonly externalEdges: number;
}

interface Edge {
  readonly source: string;
  readonly target: string;
}

const MAX_COMPONENT_SIZE = 20;
const MAX_ENTRY_POINTS = 3;

export function computeFileClusters(deps: FileDependency[]): FileCluster[] {
  if (deps.length === 0) {
    return [];
  }

  const edges = deduplicateEdges(deps);
  const adjacency = buildAdjacencyGraph(edges);
  const components = findConnectedComponents(adjacency);
  const groups = splitLargeComponents(components);

  return groups.map(files => buildCluster(files, edges));
}

function deduplicateEdges(deps: FileDependency[]): Edge[] {
  const seen = new Set<string>();
  const edges: Edge[] = [];

  for (const dep of deps) {
    const key = `${dep.sourceFile}->${dep.targetFile}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push({ source: dep.sourceFile, target: dep.targetFile });
    }
  }

  return edges;
}

function buildAdjacencyGraph(edges: Edge[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  const ensureNode = (file: string): void => {
    if (!graph.has(file)) {
      graph.set(file, new Set());
    }
  };

  for (const edge of edges) {
    ensureNode(edge.source);
    ensureNode(edge.target);

    if (edge.source !== edge.target) {
      graph.get(edge.source)!.add(edge.target);
      graph.get(edge.target)!.add(edge.source);
    }
  }

  return graph;
}

function findConnectedComponents(adjacency: Map<string, Set<string>>): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of adjacency.keys()) {
    if (visited.has(node)) {
      continue;
    }

    const component: string[] = [];
    const queue = [node];
    visited.add(node);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      for (const neighbor of adjacency.get(current)!) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components;
}

function splitLargeComponents(components: string[][]): string[][] {
  const result: string[][] = [];

  for (const component of components) {
    if (component.length <= MAX_COMPONENT_SIZE) {
      result.push(component);
      continue;
    }

    const subgroups = splitAtDirectoryBoundaries(component);
    result.push(...subgroups);
  }

  return result;
}

function splitAtDirectoryBoundaries(files: string[]): string[][] {
  const directoryGroups = groupByFirstUniqueDirectory(files);

  if (directoryGroups.length <= 1) {
    return [files];
  }

  return directoryGroups.map(group => group.files);
}

function groupByFirstUniqueDirectory(files: string[]): Array<{ dir: string; files: string[] }> {
  const allDirParts = files.map(f => f.split('/').slice(0, -1));
  const commonDepth = findCommonPrefixDepth(allDirParts);

  const groups = new Map<string, string[]>();

  for (const file of files) {
    const dir = getDirectoryGroupKey(file, commonDepth);
    if (!groups.has(dir)) {
      groups.set(dir, []);
    }
    groups.get(dir)!.push(file);
  }

  return Array.from(groups.entries()).map(([dir, groupFiles]) => ({
    dir,
    files: groupFiles,
  }));
}

function getDirectoryGroupKey(file: string, commonDepth: number): string {
  const parts = file.split('/');

  if (parts.length <= 1) {
    return '';
  }

  if (commonDepth < parts.length - 1) {
    return parts[commonDepth];
  }

  return parts.slice(0, -1).join('/');
}

function findCommonPrefixDepth(allDirParts: string[][]): number {
  if (allDirParts.length === 0) {
    return 0;
  }

  let depth = 0;
  const first = allDirParts[0];

  while (depth < first.length) {
    const segment = first[depth];
    if (allDirParts.every(parts => parts[depth] === segment)) {
      depth++;
    } else {
      break;
    }
  }

  return depth;
}

function buildCluster(
  files: string[],
  allEdges: Edge[],
): FileCluster {
  const fileSet = new Set(files);

  let internalEdges = 0;
  let externalEdges = 0;

  for (const edge of allEdges) {
    const sourceIn = fileSet.has(edge.source);
    const targetIn = fileSet.has(edge.target);

    if (sourceIn && targetIn) {
      internalEdges++;
    } else if (sourceIn || targetIn) {
      externalEdges++;
    }
  }

  const totalEdges = internalEdges + externalEdges;
  const cohesion = totalEdges > 0 ? internalEdges / totalEdges : 1.0;

  const entryPoints = identifyEntryPoints(files, fileSet, allEdges);
  const name = computeClusterName(files);

  return {
    id: randomUUID(),
    name,
    files: files.sort(),
    cohesion,
    entryPoints,
    internalEdges,
    externalEdges,
  };
}

function identifyEntryPoints(
  files: string[],
  fileSet: Set<string>,
  allEdges: Edge[],
): string[] {
  const externalImportCount = new Map<string, number>();

  for (const edge of allEdges) {
    // An external import into this cluster: source is outside, target is inside
    if (!fileSet.has(edge.source) && fileSet.has(edge.target)) {
      externalImportCount.set(
        edge.target,
        (externalImportCount.get(edge.target) ?? 0) + 1,
      );
    }
  }

  if (externalImportCount.size === 0) {
    return [];
  }

  return Array.from(externalImportCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ENTRY_POINTS)
    .map(([file]) => file);
}

function computeClusterName(files: string[]): string {
  const dirParts = files.map(f => f.split('/').slice(0, -1));
  const commonDepth = findCommonPrefixDepth(dirParts);

  if (commonDepth === 0) {
    return 'root';
  }

  const commonPrefix = dirParts[0].slice(0, commonDepth);
  const stripped = stripLeadingInfraSegments(commonPrefix);

  if (stripped.length === 0) {
    return commonPrefix.join('/');
  }

  return stripped.join('/');
}

const INFRA_SEGMENTS = new Set(['src', 'lib', 'app', 'packages']);

function stripLeadingInfraSegments(segments: string[]): string[] {
  let start = 0;
  while (start < segments.length && INFRA_SEGMENTS.has(segments[start])) {
    start++;
  }
  return segments.slice(start);
}
