/**
 * MCP tool registry for managing tool definitions and handlers.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

export class ToolRegistry {
  private readonly definitions: ToolDefinition[] = [];
  private readonly handlers = new Map<string, ToolHandler>();

  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.definitions.push(definition);
    this.handlers.set(definition.name, handler);
  }

  getHandler(name: string): ToolHandler | undefined {
    return this.handlers.get(name);
  }

  getDefinitions(): ToolDefinition[] {
    return [...this.definitions];
  }

  async handleToolCall(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    const handler = this.handlers.get(name);
    if (!handler) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    return handler(args);
  }
}
