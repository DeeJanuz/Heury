import type { CodeUnit } from '@/domain/models/index.js';
import type { ICodeUnitRepository, IEmbeddingProvider, IVectorSearchService } from '@/domain/ports/index.js';
import { buildEmbeddingText } from '@/adapters/embedding/embedding-text-builder.js';

const BATCH_SIZE = 50;

export interface EmbeddingPipelineDependencies {
  readonly codeUnitRepo: ICodeUnitRepository;
  readonly embeddingProvider: IEmbeddingProvider;
  readonly vectorSearch: IVectorSearchService;
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
    return this.indexUnits(units);
  }

  /**
   * Generate embedding for a single code unit and index it.
   */
  async indexUnit(unitId: string): Promise<void> {
    const unit = this.deps.codeUnitRepo.findById(unitId);
    if (!unit) {
      throw new Error(`Code unit not found: ${unitId}`);
    }
    const text = buildEmbeddingText(unit);
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
    return this.indexUnits(units);
  }

  /**
   * Index a list of code units in batches.
   */
  private async indexUnits(units: CodeUnit[]): Promise<{ indexed: number; errors: number }> {
    let indexed = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < units.length; i += BATCH_SIZE) {
      const batch = units.slice(i, i + BATCH_SIZE);
      const texts = batch.map((u) => buildEmbeddingText(u));

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
