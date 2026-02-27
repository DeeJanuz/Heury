/**
 * MCP Server factory for heury.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  ICodeUnitRepository,
  IFileDependencyRepository,
  IEnvVariableRepository,
  IFileSystem,
  IVectorSearchService,
} from '@/domain/ports/index.js';
import { ToolRegistry } from './tool-registry.js';
import { createGetAnalysisStatsTool } from './tools/get-analysis-stats.js';
import { createGetModuleOverviewTool } from './tools/get-module-overview.js';
import { createSearchCodebaseTool } from './tools/search-codebase.js';
import { createGetCodeUnitsTool } from './tools/get-code-units.js';
import { createGetDependenciesTool } from './tools/get-dependencies.js';
import { createGetApiEndpointsTool } from './tools/get-api-endpoints.js';
import { createGetFileContentTool } from './tools/get-file-content.js';
import { createVectorSearchTool } from './tools/vector-search.js';

export interface McpServerDependencies {
  codeUnitRepo: ICodeUnitRepository;
  dependencyRepo: IFileDependencyRepository;
  envVarRepo: IEnvVariableRepository;
  fileSystem: IFileSystem;
  vectorSearch?: IVectorSearchService;
}

export function createMcpServer(deps: McpServerDependencies): Server {
  const server = new Server(
    { name: 'heury', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  const registry = new ToolRegistry();

  // Register all tools
  const tools = [
    createGetAnalysisStatsTool({
      codeUnitRepo: deps.codeUnitRepo,
      dependencyRepo: deps.dependencyRepo,
      envVarRepo: deps.envVarRepo,
    }),
    createGetModuleOverviewTool({ codeUnitRepo: deps.codeUnitRepo }),
    createSearchCodebaseTool({ codeUnitRepo: deps.codeUnitRepo }),
    createGetCodeUnitsTool({ codeUnitRepo: deps.codeUnitRepo }),
    createGetDependenciesTool({ dependencyRepo: deps.dependencyRepo }),
    createGetApiEndpointsTool({ codeUnitRepo: deps.codeUnitRepo }),
    createGetFileContentTool({ fileSystem: deps.fileSystem }),
    createVectorSearchTool({ vectorSearch: deps.vectorSearch }),
  ];

  for (const tool of tools) {
    registry.register(tool.definition, tool.handler);
  }

  // Handle tools/list
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.getDefinitions(),
  }));

  // Handle tools/call
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return registry.handleToolCall(name, args ?? {});
  });

  return server;
}

/** Start stdio transport. */
export async function startStdioServer(deps: McpServerDependencies): Promise<void> {
  const server = createMcpServer(deps);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
