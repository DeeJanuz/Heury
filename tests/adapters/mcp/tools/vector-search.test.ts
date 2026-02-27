import { describe, it, expect } from 'vitest';
import { createVectorSearchTool } from '@/adapters/mcp/tools/vector-search.js';

describe('vector-search tool', () => {
  it('should return not configured when no vector search service', async () => {
    const tool = createVectorSearchTool({});
    const result = await tool.handler({ query: 'test query' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.meta.context.reason).toBe('not_configured');
    expect(parsed.meta.context.detail).toContain('not yet configured');
  });

  it('should accept query parameter', async () => {
    const tool = createVectorSearchTool({});
    const result = await tool.handler({ query: 'authentication flow' });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
  });
});
