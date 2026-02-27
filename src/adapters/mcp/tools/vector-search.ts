/**
 * MCP tool: vector-search
 * Semantic search across code units using vector embeddings.
 */

import type { IEmbeddingProvider, IVectorSearchService, ICodeUnitRepository } from '@/domain/ports/index.js';
import { buildToolResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  vectorSearch?: IVectorSearchService;
  embeddingProvider?: IEmbeddingProvider;
  codeUnitRepo?: ICodeUnitRepository;
}

export function createVectorSearchTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'vector-search',
    description: 'Semantic search across code units using vector embeddings.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    if (!deps.vectorSearch || !deps.embeddingProvider) {
      return buildToolResponse([], {
        context: {
          reason: 'not_configured',
          detail: 'Vector search not yet configured. Run embedding pipeline first.',
        },
      });
    }

    const query = args['query'] as string;
    const limit = (args['limit'] as number) ?? 10;

    const queryEmbedding = await deps.embeddingProvider.generateEmbedding(query);
    const results = await deps.vectorSearch.search(queryEmbedding, limit);

    // Enrich results with code unit data if repository is available
    const enriched = results.map((r) => {
      const unit = deps.codeUnitRepo?.findById(r.metadata['unitId'] as string);
      return {
        id: r.id,
        score: r.score,
        name: unit?.name ?? r.metadata['name'],
        filePath: unit?.filePath ?? r.metadata['filePath'],
        unitType: unit?.unitType ?? r.metadata['unitType'],
      };
    });

    return buildToolResponse(enriched, {
      resultCount: enriched.length,
    });
  };

  return { definition, handler };
}
