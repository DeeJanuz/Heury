import type { ICodeUnitRepository, IUnitSummaryRepository } from '@/domain/ports/index.js';
import type { ILlmProvider } from '@/domain/ports/llm-provider.js';
import type { CodeUnit } from '@/domain/models/index.js';
import { createUnitSummary } from '@/domain/models/index.js';

export interface EnrichmentOptions {
  readonly force?: boolean;
  readonly concurrency?: number;
}

export interface EnrichmentResult {
  readonly unitsProcessed: number;
  readonly unitsSkipped: number;
  readonly unitsFailed: number;
}

interface ParsedSummary {
  readonly summary: string;
  readonly keyBehaviors: string[];
  readonly sideEffects: string[];
}

function buildPrompt(unit: CodeUnit): string {
  return `Analyze this code unit and provide a structured summary.

Name: ${unit.name}
Type: ${unit.unitType}
File: ${unit.filePath}
Signature: ${unit.signature ?? 'N/A'}
Exported: ${unit.isExported}
Async: ${unit.isAsync}
Patterns: ${unit.patterns.map((p) => p.patternType).join(', ') || 'none'}

Respond in this exact JSON format:
{
  "summary": "1-3 sentence description of what this code does",
  "keyBehaviors": ["behavior 1", "behavior 2"],
  "sideEffects": ["side effect 1"]
}

Only include actual behaviors and side effects. Use empty arrays if none apply.`;
}

function parseResponse(text: string): ParsedSummary {
  // Try direct JSON parse
  try {
    const parsed = JSON.parse(text) as ParsedSummary;
    if (parsed.summary) {
      return {
        summary: parsed.summary,
        keyBehaviors: parsed.keyBehaviors ?? [],
        sideEffects: parsed.sideEffects ?? [],
      };
    }
  } catch {
    // Not valid JSON, try extracting from markdown code block
  }

  // Try extracting JSON from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]) as ParsedSummary;
      if (parsed.summary) {
        return {
          summary: parsed.summary,
          keyBehaviors: parsed.keyBehaviors ?? [],
          sideEffects: parsed.sideEffects ?? [],
        };
      }
    } catch {
      // Code block content wasn't valid JSON either
    }
  }

  // Fall back to raw text as summary
  return {
    summary: text,
    keyBehaviors: [],
    sideEffects: [],
  };
}

export async function enrichCodeUnits(
  codeUnitRepo: ICodeUnitRepository,
  unitSummaryRepo: IUnitSummaryRepository,
  llmProvider: ILlmProvider,
  options?: EnrichmentOptions,
): Promise<EnrichmentResult> {
  const force = options?.force ?? false;
  const concurrency = options?.concurrency ?? 3;

  const allUnits = codeUnitRepo.findAll();
  const exportedUnits = allUnits.filter((u) => u.isExported);

  let unitsProcessed = 0;
  let unitsSkipped = 0;
  let unitsFailed = 0;

  // Filter units that need processing
  const unitsToProcess: CodeUnit[] = [];
  for (const unit of exportedUnits) {
    if (!force && unitSummaryRepo.findByCodeUnitId(unit.id)) {
      unitsSkipped++;
    } else {
      unitsToProcess.push(unit);
    }
  }

  // Process in chunks of `concurrency`
  for (let i = 0; i < unitsToProcess.length; i += concurrency) {
    const chunk = unitsToProcess.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunk.map(async (unit) => {
        const prompt = buildPrompt(unit);
        const response = await llmProvider.generateSummary(prompt);
        const parsed = parseResponse(response);

        const summary = createUnitSummary({
          codeUnitId: unit.id,
          summary: parsed.summary,
          keyBehaviors: parsed.keyBehaviors,
          sideEffects: parsed.sideEffects,
          providerModel: llmProvider.providerModel,
          generatedAt: new Date().toISOString(),
        });

        unitSummaryRepo.save(summary);
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        unitsProcessed++;
      } else {
        unitsFailed++;
      }
    }
  }

  return { unitsProcessed, unitsSkipped, unitsFailed };
}
