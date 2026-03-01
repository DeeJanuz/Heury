/**
 * MCP tool: search-codebase
 * Text search across code units by name, file path, or pattern value.
 */

import type { ICodeUnitRepository, IFileSystem } from '@/domain/ports/index.js';
import { buildToolResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';
import { extractSourceForUnits } from '../source-extractor.js';

interface Dependencies {
  codeUnitRepo: ICodeUnitRepository;
  fileSystem?: IFileSystem;
}

export function createSearchCodebaseTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'search-codebase',
    description: 'Text search across code units by name, file path, or pattern value.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        type: { type: 'string', enum: ['code_unit', 'pattern', 'file'], description: 'Search type (default: code_unit)' },
        limit: { type: 'number', description: 'Max results (default 20)' },
        include_source: { type: 'boolean', description: 'Include source code for each result (default: false)' },
      },
      required: ['query'],
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const query = String(args.query).toLowerCase();
    const searchType = (args.type as string) ?? 'code_unit';
    const limit = typeof args.limit === 'number' ? args.limit : 20;
    const includeSource = args.include_source === true;

    const allUnits = deps.codeUnitRepo.findAll();
    let results;

    switch (searchType) {
      case 'file':
        results = allUnits.filter((u) => u.filePath.toLowerCase().includes(query));
        break;
      case 'pattern':
        results = allUnits.filter((u) =>
          u.patterns.some((p) => p.patternValue.toLowerCase().includes(query)),
        );
        break;
      case 'code_unit':
      default:
        results = allUnits.filter((u) => u.name.toLowerCase().includes(query));
        break;
    }

    const limited = results.slice(0, limit);

    let sources: (string | null)[] | undefined;
    if (includeSource && deps.fileSystem) {
      sources = await extractSourceForUnits(
        deps.fileSystem,
        limited.map((u) => ({ filePath: u.filePath, lineStart: u.lineStart, lineEnd: u.lineEnd })),
      );
    }

    const data = limited.map((u, i) => {
      const entry: Record<string, unknown> = {
        id: u.id,
        name: u.name,
        unitType: u.unitType,
        filePath: u.filePath,
        lineStart: u.lineStart,
        lineEnd: u.lineEnd,
        language: u.language,
        signature: u.signature,
      };
      if (sources) {
        entry.source = sources[i];
      }
      return entry;
    });

    if (data.length === 0) {
      return buildToolResponse(data, {
        context: { reason: 'no_matches', detail: 'No results found. Try a broader query.' },
      });
    }

    return buildToolResponse(data, {
      totalCount: results.length,
      hasMore: results.length > limit,
    });
  };

  return { definition, handler };
}
