import type { CodeUnit } from '@/domain/models/index.js';
import type {
  ICodeUnitRepository,
  IEmbeddingProvider,
  IVectorSearchService,
  IUnitSummaryRepository,
  IFunctionCallRepository,
  IEventFlowRepository,
  IFileClusterRepository,
} from '@/domain/ports/index.js';
import { buildEmbeddingText, type EmbeddingTextContext } from '@/adapters/embedding/embedding-text-builder.js';

const BATCH_SIZE = 50;

export interface EmbeddingPipelineDependencies {
  readonly codeUnitRepo: ICodeUnitRepository;
  readonly embeddingProvider: IEmbeddingProvider;
  readonly vectorSearch: IVectorSearchService;
  readonly unitSummaryRepo?: IUnitSummaryRepository;
  readonly functionCallRepo?: IFunctionCallRepository;
  readonly eventFlowRepo?: IEventFlowRepository;
  readonly fileClusterRepo?: IFileClusterRepository;
}

/**
 * Pre-loaded enrichment lookup maps for building richer embedding text.
 */
interface EnrichmentMaps {
  readonly summaries: Map<string, string>;
  readonly callers: Map<string, string[]>;
  readonly callees: Map<string, string[]>;
  readonly events: Map<string, string[]>;
  readonly clusters: Map<string, string>;
}

/**
 * Orchestrates generating embeddings for code units and indexing them
 * in the vector search service.
 */
export class EmbeddingPipeline {
  constructor(private readonly deps: EmbeddingPipelineDependencies) {}

  /**
   * Generate embeddings for all code units and index them.
   */
  async indexAll(): Promise<{ indexed: number; errors: number }> {
    const units = this.deps.codeUnitRepo.findAll();
    const enrichment = this.loadEnrichmentMaps(units);
    return this.indexUnits(units, enrichment);
  }

  /**
   * Generate embedding for a single code unit and index it.
   */
  async indexUnit(unitId: string): Promise<void> {
    const unit = this.deps.codeUnitRepo.findById(unitId);
    if (!unit) {
      throw new Error(`Code unit not found: ${unitId}`);
    }
    const enrichment = this.loadEnrichmentMaps([unit]);
    const context = this.buildContext(unit, enrichment);
    const text = buildEmbeddingText(context);
    const embedding = await this.deps.embeddingProvider.generateEmbedding(text);
    await this.deps.vectorSearch.index(unit.id, embedding, {
      unitId: unit.id,
      filePath: unit.filePath,
      name: unit.name,
      unitType: unit.unitType,
    });
  }

  /**
   * Search for code units similar to a query.
   */
  async search(query: string, limit: number = 10): Promise<Array<{ unit: CodeUnit; score: number }>> {
    const queryEmbedding = await this.deps.embeddingProvider.generateEmbedding(query);
    const results = await this.deps.vectorSearch.search(queryEmbedding, limit);

    const matched: Array<{ unit: CodeUnit; score: number }> = [];
    for (const result of results) {
      const unitId = result.metadata['unitId'] as string | undefined;
      if (!unitId) continue;
      const unit = this.deps.codeUnitRepo.findById(unitId);
      if (unit) {
        matched.push({ unit, score: result.score });
      }
    }
    return matched;
  }

  /**
   * Re-index changed units (deletes old entries and re-indexes).
   */
  async reindex(unitIds: string[]): Promise<{ indexed: number; errors: number }> {
    // Delete old entries
    for (const id of unitIds) {
      await this.deps.vectorSearch.delete(id);
    }

    // Find and re-index
    const units: CodeUnit[] = [];
    for (const id of unitIds) {
      const unit = this.deps.codeUnitRepo.findById(id);
      if (unit) {
        units.push(unit);
      }
    }
    const enrichment = this.loadEnrichmentMaps(units);
    return this.indexUnits(units, enrichment);
  }

  /**
   * Pre-load all enrichment data into lookup maps for efficient per-unit access.
   */
  private loadEnrichmentMaps(units: CodeUnit[]): EnrichmentMaps {
    const summaries = new Map<string, string>();
    const callers = new Map<string, string[]>();
    const callees = new Map<string, string[]>();
    const events = new Map<string, string[]>();
    const clusters = new Map<string, string>();

    // Load summaries
    if (this.deps.unitSummaryRepo) {
      for (const unit of units) {
        const summary = this.deps.unitSummaryRepo.findByCodeUnitId(unit.id);
        if (summary) {
          summaries.set(unit.id, summary.summary);
        }
      }
    }

    // Load call graph
    if (this.deps.functionCallRepo) {
      const allCalls = this.deps.functionCallRepo.findAll();

      // Build a map from unitId -> name for resolving callerUnitId to caller name
      const unitNameMap = new Map<string, string>();
      for (const unit of units) {
        unitNameMap.set(unit.id, unit.name);
      }

      for (const unit of units) {
        // Callees: functions this unit calls
        const outgoing = allCalls.filter((c) => c.callerUnitId === unit.id);
        if (outgoing.length > 0) {
          callees.set(unit.id, outgoing.map((c) => c.calleeName));
        }

        // Callers: functions that call this unit
        const incoming = allCalls.filter((c) => c.calleeUnitId === unit.id);
        if (incoming.length > 0) {
          const callerNames = incoming.map((c) => unitNameMap.get(c.callerUnitId) ?? c.callerUnitId);
          callers.set(unit.id, callerNames);
        }
      }
    }

    // Load events
    if (this.deps.eventFlowRepo) {
      for (const unit of units) {
        const unitEvents = this.deps.eventFlowRepo.findByCodeUnitId(unit.id);
        if (unitEvents.length > 0) {
          const eventNames = [...new Set(unitEvents.map((e) => e.eventName))];
          events.set(unit.id, eventNames);
        }
      }
    }

    // Load clusters
    if (this.deps.fileClusterRepo) {
      for (const unit of units) {
        const clusterData = this.deps.fileClusterRepo.findByFilePath(unit.filePath);
        if (clusterData) {
          clusters.set(unit.filePath, clusterData.cluster.name);
        }
      }
    }

    return { summaries, callers, callees, events, clusters };
  }

  /**
   * Build an EmbeddingTextContext for a unit using pre-loaded enrichment maps.
   */
  private buildContext(unit: CodeUnit, enrichment: EnrichmentMaps): EmbeddingTextContext {
    return {
      unit,
      summary: enrichment.summaries.get(unit.id),
      callers: enrichment.callers.get(unit.id),
      callees: enrichment.callees.get(unit.id),
      events: enrichment.events.get(unit.id),
      clusterName: enrichment.clusters.get(unit.filePath),
    };
  }

  /**
   * Index a list of code units in batches.
   */
  private async indexUnits(units: CodeUnit[], enrichment: EnrichmentMaps): Promise<{ indexed: number; errors: number }> {
    let indexed = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < units.length; i += BATCH_SIZE) {
      const batch = units.slice(i, i + BATCH_SIZE);
      const texts = batch.map((u) => {
        const context = this.buildContext(u, enrichment);
        return buildEmbeddingText(context);
      });

      let embeddings: number[][];
      try {
        embeddings = await this.deps.embeddingProvider.generateEmbeddings(texts);
      } catch {
        errors += batch.length;
        continue;
      }

      for (let j = 0; j < batch.length; j++) {
        try {
          const unit = batch[j];
          await this.deps.vectorSearch.index(unit.id, embeddings[j], {
            unitId: unit.id,
            filePath: unit.filePath,
            name: unit.name,
            unitType: unit.unitType,
          });
          indexed++;
        } catch {
          errors++;
        }
      }
    }

    return { indexed, errors };
  }
}
