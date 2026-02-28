/**
 * MCP tool: find-implementation-pattern
 * Find pattern templates by fuzzy query matching. Returns the template
 * with its canonical example code and follower list.
 */

import type { IPatternTemplateRepository, ICodeUnitRepository } from '@/domain/ports/index.js';
import type { RepositoryPatternTemplate, RepositoryPatternTemplateFollower } from '@/domain/models/index.js';
import { buildToolResponse, buildErrorResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  patternTemplateRepo: IPatternTemplateRepository;
  codeUnitRepo: ICodeUnitRepository;
}

interface TemplateWithFollowers {
  template: RepositoryPatternTemplate;
  followers: RepositoryPatternTemplateFollower[];
}

export function createFindImplementationPatternTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'find-implementation-pattern',
    description:
      'Find implementation pattern templates by fuzzy query. Returns the best-matching template with canonical example code, follower list, and implementation instructions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to match against pattern name, description, conventions, and pattern types',
        },
        pattern_type: {
          type: 'string',
          description: 'Optional filter by pattern type (e.g. SERVICE, CONTROLLER)',
        },
      },
      required: ['query'],
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const query = typeof args.query === 'string' ? args.query : undefined;
    const patternType = typeof args.pattern_type === 'string' ? args.pattern_type : undefined;

    if (!query) {
      return buildErrorResponse('query is required');
    }

    // Get candidate templates
    let candidates: TemplateWithFollowers[];
    if (patternType) {
      candidates = deps.patternTemplateRepo.findByPatternType(patternType);
    } else {
      candidates = deps.patternTemplateRepo.findAll();
    }

    // Fuzzy match and score
    const scored = candidates
      .map((entry) => ({
        entry,
        score: computeMatchScore(query, entry.template),
      }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return buildErrorResponse('No matching pattern found');
    }

    const best = scored[0].entry;
    const { template, followers } = best;

    // Look up the template unit for example details
    const templateUnit = deps.codeUnitRepo.findById(template.templateUnitId);

    const example: Record<string, unknown> = {
      filePath: template.templateFilePath,
    };

    if (templateUnit) {
      example.lineStart = templateUnit.lineStart;
      example.lineEnd = templateUnit.lineEnd;
      example.unitName = templateUnit.name;
      if (templateUnit.signature) {
        example.signature = templateUnit.signature;
      }
    }

    const followersList = followers.map((f) => ({
      filePath: f.filePath,
      unitName: f.unitName,
    }));

    const instructions = buildInstructions(template, example);

    const data = {
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        patternTypes: template.patternTypes,
        conventions: template.conventions,
        templateFilePath: template.templateFilePath,
        followerCount: template.followerCount,
      },
      example,
      followers: followersList,
      instructions,
    };

    return buildToolResponse(data);
  };

  return { definition, handler };
}

function computeMatchScore(query: string, template: RepositoryPatternTemplate): number {
  const queryLower = query.toLowerCase();
  let score = 0;

  // Match against name
  if (template.name.toLowerCase().includes(queryLower)) {
    score += 3;
  }

  // Match against description
  if (template.description.toLowerCase().includes(queryLower)) {
    score += 2;
  }

  // Match against pattern types
  for (const pt of template.patternTypes) {
    if (pt.toLowerCase().includes(queryLower)) {
      score += 2;
    }
  }

  // Match against conventions
  for (const conv of template.conventions) {
    if (conv.toLowerCase().includes(queryLower)) {
      score += 1;
    }
  }

  return score;
}

function buildInstructions(
  template: RepositoryPatternTemplate,
  example: Record<string, unknown>,
): string {
  const parts: string[] = [];
  parts.push('To implement this pattern:');

  const filePath = example.filePath as string;
  const lineStart = example.lineStart as number | undefined;
  const lineEnd = example.lineEnd as number | undefined;

  if (lineStart !== undefined && lineEnd !== undefined) {
    parts.push(`1. Follow the example in ${filePath} (lines ${lineStart}-${lineEnd})`);
  } else {
    parts.push(`1. Follow the example in ${filePath}`);
  }

  parts.push(`2. Include these pattern elements: ${template.patternTypes.join(', ')}`);

  const conventionBullets = template.conventions.map((c) => `- ${c}`).join('\n');
  parts.push(`3. Conventions:\n${conventionBullets}`);

  parts.push(`\nSee ${template.followerCount} existing implementations for reference.`);

  return parts.join('\n');
}
