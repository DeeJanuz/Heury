/**
 * MCP tool: vector-search
 * Semantic search across code units using vector embeddings.
 */

import type { IEmbeddingProvider, IVectorSearchService, ICodeUnitRepository, IFileClusterRepository } from '@/domain/ports/index.js';
import { buildToolResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  vectorSearch?: IVectorSearchService;
  embeddingProvider?: IEmbeddingProvider;
  codeUnitRepo?: ICodeUnitRepository;
  fileClusterRepo?: IFileClusterRepository;
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
        file_path_prefix: { type: 'string', description: 'Only return results whose filePath starts with this prefix (e.g., "src/api/")' },
        pattern_type: { type: 'string', description: 'Only return results that have at least one pattern of this type (e.g., "API_ENDPOINT", "DATABASE_READ")' },
        min_complexity: { type: 'number', description: 'Only return results with complexity score >= this value' },
        cluster_name: { type: 'string', description: 'Only return results that belong to a cluster with this name' },
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
    const filePathPrefix = args['file_path_prefix'] as string | undefined;
    const patternType = args['pattern_type'] as string | undefined;
    const minComplexity = args['min_complexity'] as number | undefined;
    const clusterName = args['cluster_name'] as string | undefined;

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
        _unit: unit,
      };
    });

    // Apply post-filters
    const filtered = enriched.filter((item) => {
      // file_path_prefix: works on enriched filePath (available even without codeUnitRepo)
      if (filePathPrefix !== undefined) {
        const filePath = item.filePath as string | undefined;
        if (!filePath || !filePath.startsWith(filePathPrefix)) {
          return false;
        }
      }

      // Filters that require the full code unit from the repository
      if (item._unit) {
        if (patternType !== undefined) {
          if (!item._unit.patterns.some((p) => p.patternType === patternType)) {
            return false;
          }
        }

        if (minComplexity !== undefined) {
          if (item._unit.complexityScore < minComplexity) {
            return false;
          }
        }

        if (clusterName !== undefined && deps.fileClusterRepo) {
          const clusterInfo = deps.fileClusterRepo.findByFilePath(item._unit.filePath);
          if (!clusterInfo || clusterInfo.cluster.name !== clusterName) {
            return false;
          }
        }
      }

      return true;
    });

    // Strip internal _unit field before returning
    const output = filtered.map(({ _unit, ...rest }) => rest);

    return buildToolResponse(output, {
      resultCount: output.length,
    });
  };

  return { definition, handler };
}
