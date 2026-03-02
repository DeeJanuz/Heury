/**
 * Graph algorithm utilities for cluster visualization.
 */

/**
 * Finds connected components in an undirected graph using BFS.
 *
 * @param nodeIds - All node identifiers in the graph
 * @param edges - Edges described as source/target cluster ID pairs
 * @returns An array of components, each being an array of node IDs
 */
export function findConnectedComponents(
  nodeIds: string[],
  edges: { sourceClusterId: string; targetClusterId: string }[],
): string[][] {
  const adj = new Map<string, Set<string>>();
  for (const id of nodeIds) {
    adj.set(id, new Set());
  }
  for (const e of edges) {
    adj.get(e.sourceClusterId)?.add(e.targetClusterId);
    adj.get(e.targetClusterId)?.add(e.sourceClusterId);
  }

  const visited = new Set<string>();
  const components: string[][] = [];

  for (const id of nodeIds) {
    if (visited.has(id)) continue;
    const component: string[] = [];
    const queue = [id];
    visited.add(id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of adj.get(current) ?? []) {
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
