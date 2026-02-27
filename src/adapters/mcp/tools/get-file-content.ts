/**
 * MCP tool: get-file-content
 * Read a file's content for LLM inspection.
 */

import type { IFileSystem } from '@/domain/ports/index.js';
import { buildToolResponse, buildErrorResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  fileSystem: IFileSystem;
}

export function createGetFileContentTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-file-content',
    description: 'Read a file\'s content. Optionally specify a line range.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the file' },
        line_start: { type: 'number', description: 'Starting line number (1-based)' },
        line_end: { type: 'number', description: 'Ending line number (inclusive)' },
      },
      required: ['file_path'],
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const filePath = String(args.file_path);

    try {
      let content = await deps.fileSystem.readFile(filePath);

      if (typeof args.line_start === 'number' || typeof args.line_end === 'number') {
        const lines = content.split('\n');
        const start = typeof args.line_start === 'number' ? args.line_start - 1 : 0;
        const end = typeof args.line_end === 'number' ? args.line_end : lines.length;
        content = lines.slice(start, end).join('\n');
      }

      return buildToolResponse({
        file_path: filePath,
        content,
        line_count: content.split('\n').length,
      }, { resultCount: 1 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return buildErrorResponse(`Failed to read file: ${message}`);
    }
  };

  return { definition, handler };
}
