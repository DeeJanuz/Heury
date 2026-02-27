import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '@/adapters/mcp/tool-registry.js';
import type { ToolDefinition, ToolHandler } from '@/adapters/mcp/tool-registry.js';

function makeDefinition(name: string): ToolDefinition {
  return {
    name,
    description: `Test tool ${name}`,
    inputSchema: { type: 'object', properties: {} },
  };
}

function makeHandler(response: string): ToolHandler {
  return async () => ({
    content: [{ type: 'text', text: response }],
  });
}

describe('ToolRegistry', () => {
  it('should register and retrieve a handler', () => {
    const registry = new ToolRegistry();
    const handler = makeHandler('result');

    registry.register(makeDefinition('test-tool'), handler);

    expect(registry.getHandler('test-tool')).toBe(handler);
  });

  it('should return undefined for unknown tool', () => {
    const registry = new ToolRegistry();

    expect(registry.getHandler('nonexistent')).toBeUndefined();
  });

  it('should list all definitions', () => {
    const registry = new ToolRegistry();
    registry.register(makeDefinition('tool-a'), makeHandler('a'));
    registry.register(makeDefinition('tool-b'), makeHandler('b'));

    const defs = registry.getDefinitions();

    expect(defs).toHaveLength(2);
    expect(defs.map((d) => d.name)).toEqual(['tool-a', 'tool-b']);
  });

  it('should delegate handleToolCall to correct handler', async () => {
    const registry = new ToolRegistry();
    registry.register(makeDefinition('greet'), makeHandler('hello'));

    const result = await registry.handleToolCall('greet', {});

    expect(result.content[0].text).toBe('hello');
  });

  it('should return error for unknown tool in handleToolCall', async () => {
    const registry = new ToolRegistry();

    const result = await registry.handleToolCall('missing', {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('missing');
  });
});
