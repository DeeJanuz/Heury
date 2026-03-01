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
  IFunctionCallRepository,
  ITypeFieldRepository,
  IEventFlowRepository,
  ISchemaModelRepository,
  IUnitSummaryRepository,
  IGuardClauseRepository,
  IFileClusterRepository,
  IPatternTemplateRepository,
} from '@/domain/ports/index.js';
import type { FileProcessingResult } from '@/application/file-processor.js';
import { ToolRegistry } from './tool-registry.js';
import { createGetAnalysisStatsTool } from './tools/get-analysis-stats.js';
import { createGetModuleOverviewTool } from './tools/get-module-overview.js';
import { createSearchCodebaseTool } from './tools/search-codebase.js';
import { createGetCodeUnitsTool } from './tools/get-code-units.js';
import { createGetDependenciesTool } from './tools/get-dependencies.js';
import { createGetApiEndpointsTool } from './tools/get-api-endpoints.js';
import { createGetFileContentTool } from './tools/get-file-content.js';
import { createGetEnvVariablesTool } from './tools/get-env-variables.js';
import { createVectorSearchTool } from './tools/vector-search.js';
import { createTraceCallChainTool } from './tools/trace-call-chain.js';
import { createGetEventFlowTool } from './tools/get-event-flow.js';
import { createGetDataModelsTool } from './tools/get-data-models.js';
import { createGetFunctionContextTool } from './tools/get-function-context.js';
import { createGetPatternsByTypeTool } from './tools/get-patterns-by-type.js';
import { createGetUnitSummariesTool } from './tools/get-unit-summaries.js';
import { createGetFunctionGuardsTool } from './tools/get-function-guards.js';
import { createGetFeatureAreaTool } from './tools/get-feature-area.js';
import { createFindImplementationPatternTool } from './tools/find-implementation-pattern.js';
import { createPlanChangeImpactTool } from './tools/plan-change-impact.js';
import { createGetImplementationContextTool } from './tools/get-implementation-context.js';
import { createValidateAgainstPatternsTool } from './tools/validate-against-patterns.js';
import { createGetTestPatternsTool } from './tools/get-test-patterns.js';

export interface McpServerDependencies {
  codeUnitRepo: ICodeUnitRepository;
  dependencyRepo: IFileDependencyRepository;
  envVarRepo: IEnvVariableRepository;
  fileSystem: IFileSystem;
  vectorSearch?: IVectorSearchService;
  // Deep analysis repos (optional)
  functionCallRepo?: IFunctionCallRepository;
  typeFieldRepo?: ITypeFieldRepository;
  eventFlowRepo?: IEventFlowRepository;
  schemaModelRepo?: ISchemaModelRepository;
  unitSummaryRepo?: IUnitSummaryRepository;
  guardClauseRepo?: IGuardClauseRepository;
  fileClusterRepo?: IFileClusterRepository;
  patternTemplateRepo?: IPatternTemplateRepository;
  fileAnalyzer?: (filePath: string, content: string) => FileProcessingResult | null;
}

export function createMcpServer(deps: McpServerDependencies): Server {
  const server = new Server(
    { name: 'heury', version: '0.1.0' },
    {
      capabilities: { tools: {} },
      instructions: `Heury: pre-analyzed codebase intelligence for LLM discovery.

Use heury MCP tools alongside traditional file tools (Glob/Grep/Read). MCP provides structural understanding; traditional tools provide precision for deep reading and edge cases. Neither alone is optimal.

## Workflow

PLANNING PHASE (deep understanding needed):
1. ORIENT: Read .heury/MODULES.md, PATTERNS.md, DEPENDENCIES.md, HOTSPOTS.md (~10K tokens). Relevance-ranked — most important items first, omitted items available via MCP.
2. TARGET: search_codebase or get_code_units (is_exported: true) to find functions/classes. Signatures in compact format are often enough to understand contracts.
3. DEEP READ: For planning, use traditional Read on specific files when you need full context beyond signatures. Use get_dependencies and plan_change_impact to understand blast radius.

IMPLEMENTATION PHASE (MCP accelerates this significantly):
1. get_implementation_context: Single call bundles source, dependencies, patterns, test locations, and feature area. Start here — replaces multiple search+read cycles.
2. get_code_units/search_codebase/get_function_context/trace_call_chain with include_source: true: Get source inline to avoid follow-up file reads.
3. get_test_patterns: Discover test conventions and scaffolding for similar code.
4. validate_against_patterns: Check new code against established codebase patterns.

## Tools by phase

Orientation:
- get_analysis_stats: High-level stats (code units, files, languages, patterns)
- get_module_overview: All files with their code units and signatures

Discovery:
- search_codebase: Search by name, file path, or pattern value. Use include_source: true during implementation.
- get_code_units: Filter by file, type, language, complexity, export status. Use is_exported: true for public API discovery. Use include_source: true during implementation.
- vector_search: Semantic similarity search across code units
- get_api_endpoints: API routes with HTTP methods and handler locations
- get_env_variables: Environment variables from .env.example files
- get_patterns_by_type: Code unit patterns by type (DATABASE_READ, API_ENDPOINT, etc.)
- get_data_models: Schema/data models with fields, types, and relations

Deep analysis:
- get_function_context: Complete function context: signature, calls, callers, events, types, summary. Use include_source: true during implementation.
- trace_call_chain: Trace call chains forward (callees) or backward (callers). Use include_source: true during implementation.
- get_dependencies: Import graph filtered by source or target file
- plan_change_impact: Impact of changing a file/function: transitive dependents, circular deps, affected endpoints, risk level. Use include_source: true to get source for target and affected endpoints.
- get_event_flow: Event emissions and subscriptions by name, direction, or framework
- get_unit_summaries: LLM-generated summaries with key behaviors and side effects
- get_function_guards: Guard clauses by unit ID, file path, or guard type
- get_feature_area: Feature area context: metadata, code units, dependencies, patterns, summary
- find_implementation_pattern: Pattern templates by fuzzy query with canonical example and followers

Implementation:
- get_implementation_context: Single-call bundle — source, dependencies, patterns, test locations, feature area. Source included by default.
- validate_against_patterns: Validate new/modified files against pattern templates in real-time.
- get_test_patterns: Test conventions from similar units — imports, setup, naming patterns, test file locations.

Source access:
- get_file_content: Read source files with optional line ranges. Use when you need a file not returned by other tools.

Key principle: During implementation, always pass include_source: true to avoid separate get_file_content calls. get_implementation_context includes source by default.`,
    },
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
    createSearchCodebaseTool({ codeUnitRepo: deps.codeUnitRepo, fileSystem: deps.fileSystem }),
    createGetCodeUnitsTool({ codeUnitRepo: deps.codeUnitRepo, fileSystem: deps.fileSystem }),
    createGetDependenciesTool({ dependencyRepo: deps.dependencyRepo }),
    createGetApiEndpointsTool({ codeUnitRepo: deps.codeUnitRepo }),
    createGetFileContentTool({ fileSystem: deps.fileSystem }),
    createGetEnvVariablesTool({ envVarRepo: deps.envVarRepo }),
    createGetPatternsByTypeTool({ codeUnitRepo: deps.codeUnitRepo }),
    createVectorSearchTool({ vectorSearch: deps.vectorSearch }),
    createPlanChangeImpactTool({
      dependencyRepo: deps.dependencyRepo,
      codeUnitRepo: deps.codeUnitRepo,
      fileClusterRepo: deps.fileClusterRepo,
      fileSystem: deps.fileSystem,
    }),
  ];

  // Conditionally register deep analysis tools when their deps are available
  if (deps.functionCallRepo) {
    tools.push(
      createTraceCallChainTool({
        functionCallRepo: deps.functionCallRepo,
        codeUnitRepo: deps.codeUnitRepo,
        fileSystem: deps.fileSystem,
      }),
    );
  }
  if (deps.eventFlowRepo) {
    tools.push(
      createGetEventFlowTool({
        eventFlowRepo: deps.eventFlowRepo,
        codeUnitRepo: deps.codeUnitRepo,
      }),
    );
  }
  if (deps.schemaModelRepo) {
    tools.push(
      createGetDataModelsTool({
        schemaModelRepo: deps.schemaModelRepo,
      }),
    );
  }
  if (deps.unitSummaryRepo) {
    tools.push(
      createGetUnitSummariesTool({
        unitSummaryRepo: deps.unitSummaryRepo,
        codeUnitRepo: deps.codeUnitRepo,
      }),
    );
  }
  if (deps.guardClauseRepo) {
    tools.push(
      createGetFunctionGuardsTool({
        guardClauseRepo: deps.guardClauseRepo,
        codeUnitRepo: deps.codeUnitRepo,
      }),
    );
  }
  if (deps.fileClusterRepo) {
    tools.push(
      createGetFeatureAreaTool({
        fileClusterRepo: deps.fileClusterRepo,
        codeUnitRepo: deps.codeUnitRepo,
        dependencyRepo: deps.dependencyRepo,
      }),
    );
  }
  if (deps.patternTemplateRepo) {
    tools.push(
      createFindImplementationPatternTool({
        patternTemplateRepo: deps.patternTemplateRepo,
        codeUnitRepo: deps.codeUnitRepo,
      }),
    );
    tools.push(
      createValidateAgainstPatternsTool({
        fileSystem: deps.fileSystem,
        patternTemplateRepo: deps.patternTemplateRepo,
        codeUnitRepo: deps.codeUnitRepo,
        fileAnalyzer: deps.fileAnalyzer,
      }),
    );
  }
  if (deps.functionCallRepo && deps.typeFieldRepo && deps.eventFlowRepo) {
    tools.push(
      createGetFunctionContextTool({
        codeUnitRepo: deps.codeUnitRepo,
        functionCallRepo: deps.functionCallRepo,
        typeFieldRepo: deps.typeFieldRepo,
        eventFlowRepo: deps.eventFlowRepo,
        unitSummaryRepo: deps.unitSummaryRepo,
        fileSystem: deps.fileSystem,
      }),
    );
  }

  // Implementation-phase tools (always registered, optional deps handled internally)
  tools.push(
    createGetImplementationContextTool({
      codeUnitRepo: deps.codeUnitRepo,
      fileSystem: deps.fileSystem,
      dependencyRepo: deps.dependencyRepo,
      fileClusterRepo: deps.fileClusterRepo,
      patternTemplateRepo: deps.patternTemplateRepo,
      vectorSearch: deps.vectorSearch,
    }),
  );
  tools.push(
    createGetTestPatternsTool({
      fileSystem: deps.fileSystem,
      codeUnitRepo: deps.codeUnitRepo,
      fileClusterRepo: deps.fileClusterRepo,
      patternTemplateRepo: deps.patternTemplateRepo,
    }),
  );

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
