/**
 * MCP tool: get-analysis-stats
 * Returns high-level analysis stats.
 */

import type { ICodeUnitRepository, IFileDependencyRepository, IEnvVariableRepository } from '@/domain/ports/index.js';
import { buildToolResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  codeUnitRepo: ICodeUnitRepository;
  dependencyRepo: IFileDependencyRepository;
  envVarRepo: IEnvVariableRepository;
}

export function createGetAnalysisStatsTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-analysis-stats',
    description: 'Returns high-level analysis stats: total code units, files, patterns, dependencies, languages, and last analysis time.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  };

  const handler: ToolHandler = async () => {
    const allUnits = deps.codeUnitRepo.findAll();
    const allDeps = deps.dependencyRepo.findAll();
    const allEnvVars = deps.envVarRepo.findAll();

    const files = new Set(allUnits.map((u) => u.filePath));

    const languages: Record<string, number> = {};
    for (const unit of allUnits) {
      languages[unit.language] = (languages[unit.language] ?? 0) + 1;
    }

    const patternCount = allUnits.reduce((sum, u) => sum + u.patterns.length, 0);

    const data = {
      total_code_units: allUnits.length,
      total_files: files.size,
      total_patterns: patternCount,
      total_dependencies: allDeps.length,
      total_env_variables: allEnvVars.length,
      languages,
    };

    return buildToolResponse(data, { resultCount: 1 });
  };

  return { definition, handler };
}
