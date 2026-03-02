import { describe, it, expect } from 'vitest';
import { findConnectedComponents } from '@/adapters/ui/client/src/lib/graph-utils.js';

describe('findConnectedComponents', () => {
  it('should return empty array for empty graph', () => {
    const result = findConnectedComponents([], []);

    expect(result).toEqual([]);
  });

  it('should return single node as its own component', () => {
    const result = findConnectedComponents(['a'], []);

    expect(result).toEqual([['a']]);
  });

  it('should return each isolated node as a separate component', () => {
    const result = findConnectedComponents(['a', 'b', 'c'], []);

    expect(result).toHaveLength(3);
    expect(result).toEqual([['a'], ['b'], ['c']]);
  });

  it('should group two connected nodes into one component', () => {
    const result = findConnectedComponents(
      ['a', 'b'],
      [{ sourceClusterId: 'a', targetClusterId: 'b' }],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toContain('a');
    expect(result[0]).toContain('b');
  });

  it('should find multiple disconnected components', () => {
    const result = findConnectedComponents(
      ['a', 'b', 'c', 'd'],
      [
        { sourceClusterId: 'a', targetClusterId: 'b' },
        { sourceClusterId: 'c', targetClusterId: 'd' },
      ],
    );

    expect(result).toHaveLength(2);

    const componentWithA = result.find((c) => c.includes('a'))!;
    const componentWithC = result.find((c) => c.includes('c'))!;

    expect(componentWithA).toContain('b');
    expect(componentWithC).toContain('d');
  });

  it('should group a fully connected graph into one component', () => {
    const result = findConnectedComponents(
      ['a', 'b', 'c'],
      [
        { sourceClusterId: 'a', targetClusterId: 'b' },
        { sourceClusterId: 'b', targetClusterId: 'c' },
        { sourceClusterId: 'a', targetClusterId: 'c' },
      ],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
    expect(result[0]).toContain('a');
    expect(result[0]).toContain('b');
    expect(result[0]).toContain('c');
  });

  it('should handle chain connectivity (a-b-c with no direct a-c edge)', () => {
    const result = findConnectedComponents(
      ['a', 'b', 'c'],
      [
        { sourceClusterId: 'a', targetClusterId: 'b' },
        { sourceClusterId: 'b', targetClusterId: 'c' },
      ],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
  });

  it('should handle mixed connected and isolated nodes', () => {
    const result = findConnectedComponents(
      ['a', 'b', 'c', 'd', 'e'],
      [
        { sourceClusterId: 'a', targetClusterId: 'b' },
        { sourceClusterId: 'a', targetClusterId: 'c' },
      ],
    );

    expect(result).toHaveLength(3); // {a,b,c}, {d}, {e}

    const connectedComp = result.find((c) => c.includes('a'))!;
    expect(connectedComp).toHaveLength(3);
    expect(connectedComp).toContain('b');
    expect(connectedComp).toContain('c');
  });
});
