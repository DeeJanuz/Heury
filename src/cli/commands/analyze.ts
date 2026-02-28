/**
 * CLI analyze command - runs codebase analysis.
 */

import type { IFileSystem } from '@/domain/ports/index.js';
import type { LlmProviderConfig } from '@/domain/ports/llm-provider.js';
import { AnalysisOrchestrator, generateManifests, type AnalysisDependencies } from '@/application/index.js';
import { analyzeIncremental } from '@/application/incremental/incremental-analyzer.js';
import { getChangedFilesSinceCommit } from '@/application/incremental/git-diff-parser.js';
import type { HeuryConfig } from '@/domain/ports/config-provider.js';
import { enrichCodeUnits } from '@/application/enrichment-processor.js';
import { loadConfig } from '@/config/loader.js';
import { createCompositionRoot } from '@/composition-root.js';
import { NodeFileSystem } from '@/adapters/filesystem/node-filesystem.js';
import { createLlmProvider } from '@/adapters/llm/llm-provider-factory.js';
import { SqliteUnitSummaryRepository } from '@/adapters/storage/sqlite-unit-summary-repository.js';
import { DatabaseManager } from '@/adapters/storage/database.js';

export interface AnalyzeOptions {
  dir: string;
  full: boolean;
  incremental?: boolean;
  dbPath?: string;
  inMemory?: boolean;
  enrich?: boolean;
  enrichForce?: boolean;
}

export async function analyzeCommand(
  options: AnalyzeOptions,
  fileSystem?: IFileSystem,
): Promise<void> {
  const fs = fileSystem ?? new NodeFileSystem();

  try {
    const config = await loadConfig(options.dir, fs);
    const dbPath = options.dbPath ?? `${options.dir}/.heury/heury.db`;
    const { dependencies } = await createCompositionRoot(fs, {
      dbPath,
      inMemory: options.inMemory ?? (fileSystem !== undefined),
    });

    if (options.incremental) {
      await runIncrementalAnalysis(options, config, dependencies, fs);
      return;
    }

    const orchestrator = new AnalysisOrchestrator(dependencies);
    const result = await orchestrator.analyze({
      rootDir: config.rootDir,
      include: config.include,
      exclude: config.exclude,
    });

    if (result.success && result.stats) {
      console.log('Analysis complete:');
      console.log(`  Files processed: ${result.stats.filesProcessed}`);
      console.log(`  Code units: ${result.stats.codeUnitsExtracted}`);
      console.log(`  Patterns: ${result.stats.patternsDetected}`);
      console.log(`  Dependencies: ${result.stats.dependenciesFound}`);
      console.log(`  Env variables: ${result.stats.envVariablesFound}`);
      console.log(`  Duration: ${result.stats.duration}ms`);

      await generateManifests(
        {
          codeUnitRepo: dependencies.codeUnitRepo,
          dependencyRepo: dependencies.dependencyRepo,
          envVarRepo: dependencies.envVarRepo,
          fileSystem: fs,
          typeFieldRepo: dependencies.typeFieldRepo,
          eventFlowRepo: dependencies.eventFlowRepo,
          schemaModelRepo: dependencies.schemaModelRepo,
          functionCallRepo: dependencies.functionCallRepo,
          fileClusterRepo: dependencies.fileClusterRepo,
          patternTemplateRepo: dependencies.patternTemplateRepo,
        },
        {
          outputDir: `${options.dir}/${config.outputDir}`,
          totalTokenBudget: config.manifestTokenBudget,
        },
      );

      const manifestList = dependencies.schemaModelRepo
        ? 'MODULES.md, PATTERNS.md, DEPENDENCIES.md, HOTSPOTS.md, SCHEMA.md'
        : 'MODULES.md, PATTERNS.md, DEPENDENCIES.md, HOTSPOTS.md';
      console.log(`  Manifests: ${manifestList}`);

      // Run enrichment if requested
      if (options.enrich || options.enrichForce) {
        await runEnrichment(dbPath, config, options, fileSystem !== undefined);
      }
    } else if (!result.success) {
      console.error(`Analysis failed: ${result.error ?? 'Unknown error'}`);
    }
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function runIncrementalAnalysis(
  options: AnalyzeOptions,
  config: HeuryConfig,
  dependencies: AnalysisDependencies,
  fs: IFileSystem,
): Promise<void> {
  const changedFiles = await getChangedFilesSinceCommit('HEAD~1', config.rootDir);

  const result = await analyzeIncremental(
    changedFiles,
    { rootDir: config.rootDir, include: config.include, exclude: config.exclude },
    {
      fileSystem: fs,
      codeUnitRepo: dependencies.codeUnitRepo,
      dependencyRepo: dependencies.dependencyRepo,
      envVarRepo: dependencies.envVarRepo,
      guardClauseRepo: dependencies.guardClauseRepo,
      languageRegistry: dependencies.languageRegistry,
    },
  );

  if (result.success) {
    console.log(
      `Incremental analysis: ${result.filesAdded} added, ${result.filesModified} modified, ${result.filesDeleted} deleted`,
    );

    await generateManifests(
      {
        codeUnitRepo: dependencies.codeUnitRepo,
        dependencyRepo: dependencies.dependencyRepo,
        envVarRepo: dependencies.envVarRepo,
        fileSystem: fs,
        typeFieldRepo: dependencies.typeFieldRepo,
        eventFlowRepo: dependencies.eventFlowRepo,
        schemaModelRepo: dependencies.schemaModelRepo,
        functionCallRepo: dependencies.functionCallRepo,
        fileClusterRepo: dependencies.fileClusterRepo,
        patternTemplateRepo: dependencies.patternTemplateRepo,
      },
      {
        outputDir: `${options.dir}/${config.outputDir}`,
        totalTokenBudget: config.manifestTokenBudget,
      },
    );
  } else {
    console.error(`Incremental analysis failed: ${result.error ?? 'Unknown error'}`);
  }
}

async function runEnrichment(
  dbPath: string,
  config: { enrichment?: { provider: 'anthropic' | 'openai' | 'gemini'; apiKey?: string; model?: string; baseUrl?: string } },
  options: AnalyzeOptions,
  isTestMode: boolean,
): Promise<void> {
  const enrichmentConfig = config.enrichment;
  const apiKey = enrichmentConfig?.apiKey ?? process.env.HEURY_LLM_API_KEY;

  if (!enrichmentConfig?.provider) {
    console.error('Enrichment: No provider configured. Set enrichment.provider in heury.config.json.');
    return;
  }

  if (!apiKey) {
    console.error(
      'Enrichment: No API key found. Set enrichment.apiKey in config or HEURY_LLM_API_KEY env var.',
    );
    return;
  }

  const llmConfig: LlmProviderConfig = {
    provider: enrichmentConfig.provider,
    apiKey,
    model: enrichmentConfig.model,
    baseUrl: enrichmentConfig.baseUrl,
  };

  const llmProvider = createLlmProvider(llmConfig);

  // Create a separate DB connection for the unit summary repo
  const dbManager = new DatabaseManager({
    path: dbPath,
    inMemory: isTestMode,
  });
  dbManager.initialize();
  const db = dbManager.getDatabase();

  const { SqliteCodeUnitRepository } = await import(
    '@/adapters/storage/sqlite-code-unit-repository.js'
  );
  const codeUnitRepo = new SqliteCodeUnitRepository(db);
  const unitSummaryRepo = new SqliteUnitSummaryRepository(db);

  console.log(`Enrichment: Using ${llmProvider.providerModel}...`);

  const enrichResult = await enrichCodeUnits(
    codeUnitRepo,
    unitSummaryRepo,
    llmProvider,
    { force: options.enrichForce },
  );

  console.log('Enrichment complete:');
  console.log(`  Units enriched: ${enrichResult.unitsProcessed}`);
  console.log(`  Units skipped: ${enrichResult.unitsSkipped}`);
  console.log(`  Units failed: ${enrichResult.unitsFailed}`);
}
