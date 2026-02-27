# Vector Search Implementation Design for Heury

## Overview
This document outlines the design for implementing local vector search in Heury to enable:
1. **Semantic Code Search**: Find code units by meaning, not just keywords
2. **Pattern Discovery**: Surface similar code patterns across the codebase
3. **Contextual Retrieval**: Retrieve relevant code context for LLM-assisted workflows

---

## 1. Storage Design

### 1.1 Embedding Storage

Embeddings are stored alongside code unit metadata. Two approaches are viable:

**Option A: sqlite-vss (SQLite Virtual Table for Vector Search)**
```sql
-- Virtual table for vector similarity search
CREATE VIRTUAL TABLE code_unit_embeddings USING vss0(
  embedding(1536)  -- OpenAI text-embedding-3-small dimension
);

-- Mapping table linking embeddings to code units
CREATE TABLE embedding_metadata (
  id INTEGER PRIMARY KEY,
  code_unit_id TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  FOREIGN KEY (code_unit_id) REFERENCES code_units(id)
);
```

**Option B: hnswlib (In-Memory HNSW Index)**
```typescript
interface EmbeddingIndex {
  // HNSW index stored as a binary file alongside SQLite DB
  indexPath: string;         // e.g., ~/.heury/project-name/embeddings.hnsw
  dimension: number;         // 1536 for text-embedding-3-small
  maxElements: number;       // Grows with codebase

  // Metadata mapping (index position -> code unit ID)
  metadataPath: string;      // e.g., ~/.heury/project-name/embeddings-meta.json
}
```

### 1.2 Recommended Approach

Start with **hnswlib** for simplicity:
- Pure in-memory index with file persistence
- No native SQLite extension compilation needed
- Fast nearest-neighbor search
- Easy to rebuild from stored embeddings

Fall back to sqlite-vss if query patterns demand more complex filtering (e.g., "find similar functions that are also exported and have complexity > 10").

---

## 2. Embedding Generation

### 2.1 What Gets Embedded

Each code unit generates an embedding from a structured text representation:

```typescript
interface EmbeddableCodeUnit {
  // Combined into a single text for embedding
  filePath: string;
  name: string;
  unitType: string;        // FUNCTION, CLASS, METHOD, etc.
  signature?: string;      // Type signature if available
  patterns: string[];      // Pattern descriptions (API_ENDPOINT, DATABASE_READ, etc.)
  sourcePreview: string;   // First N lines of source code
}

function buildEmbeddingText(unit: EmbeddableCodeUnit): string {
  const parts = [
    `${unit.unitType}: ${unit.name}`,
    `File: ${unit.filePath}`,
    unit.signature ? `Signature: ${unit.signature}` : null,
    unit.patterns.length > 0 ? `Patterns: ${unit.patterns.join(', ')}` : null,
    `Source:\n${unit.sourcePreview}`,
  ];
  return parts.filter(Boolean).join('\n');
}
```

### 2.2 Embedding Provider Abstraction

Following DIP, the embedding provider is abstracted behind a port:

```typescript
// Port (domain layer)
interface IEmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
  getDimension(): number;
  getModelName(): string;
}

// Adapter: OpenAI
class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  // Uses text-embedding-3-small (1536 dimensions)
  // Requires OPENAI_API_KEY environment variable
}

// Adapter: Local model (future)
class LocalEmbeddingProvider implements IEmbeddingProvider {
  // Uses a local model like all-MiniLM-L6-v2 (384 dimensions)
  // No API key needed, runs in-process
}
```

### 2.3 Embedding Generation Pipeline

```
Analysis Complete
      |
      v
For each code unit:
  1. Build embedding text from code unit metadata + source preview
  2. Generate embedding via IEmbeddingProvider
  3. Store embedding in vector index
  4. Store metadata mapping (index position -> code unit ID)
      |
      v
Index saved to disk (~/.heury/project-name/embeddings.hnsw)
```

Embeddings are generated as a post-analysis step, not during the main analysis pipeline. This keeps the core analysis fast and allows re-embedding without re-analyzing.

---

## 3. Search Implementation

### 3.1 Semantic Search Flow

```
User Query: "find functions that handle user authentication"
      |
      v
1. Generate query embedding via IEmbeddingProvider
2. Search vector index for k nearest neighbors
3. Retrieve code unit metadata from SQLite
4. Apply post-filters (file path, pattern type, complexity, etc.)
5. Return ranked results with similarity scores
      |
      v
Results: [
  { codeUnit: "validateSession", similarity: 0.89, file: "src/auth/session.ts" },
  { codeUnit: "checkPermissions", similarity: 0.82, file: "src/auth/permissions.ts" },
  ...
]
```

### 3.2 Search Interface

```typescript
interface VectorSearchOptions {
  query: string;
  limit?: number;           // Default: 10
  minSimilarity?: number;   // Default: 0.5

  // Post-filters (applied after vector search)
  filePath?: string;        // Filter by file path prefix
  unitTypes?: string[];     // Filter by code unit type
  patternTypes?: string[];  // Filter by detected patterns
  maxComplexity?: number;   // Filter by complexity score
  language?: string;        // Filter by language
}

interface VectorSearchResult {
  codeUnitId: string;
  similarity: number;
  filePath: string;
  name: string;
  unitType: string;
  signature?: string;
  patterns: Array<{ type: string; value: string }>;
  complexityScore: number;
}

// Port
interface IVectorSearchService {
  search(options: VectorSearchOptions): Promise<VectorSearchResult[]>;
  indexCodeUnits(codeUnits: EmbeddableCodeUnit[]): Promise<void>;
  rebuildIndex(): Promise<void>;
  getIndexStats(): Promise<{ totalVectors: number; dimension: number; model: string }>;
}
```

### 3.3 Hybrid Search

Combine vector search with keyword search for best results:

```typescript
interface HybridSearchOptions extends VectorSearchOptions {
  keywords?: string[];       // Additional keyword filters
  hybridWeight?: number;     // 0.0 = pure keyword, 1.0 = pure vector (default: 0.7)
}

// 1. Vector search produces semantic matches
// 2. Keyword search produces exact matches (SQL LIKE on name, filePath, patternValue)
// 3. Results are merged with weighted scoring
// 4. Deduplication by code unit ID
```

---

## 4. MCP Tool Integration

Vector search is exposed as an MCP tool for LLM consumption:

```typescript
const vectorSearchDefinition = {
  name: 'vector_search',
  description: 'Semantic search across code units by meaning. Complements keyword search.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language search query' },
      limit: { type: 'number', description: 'Max results (default: 10)' },
      min_similarity: { type: 'number', description: 'Min similarity threshold 0-1' },
      file_path: { type: 'string', description: 'Filter by file path prefix' },
      unit_types: { type: 'array', items: { type: 'string' } },
      pattern_types: { type: 'array', items: { type: 'string' } },
    },
    required: ['query'],
  },
};
```

---

## 5. Data Lifecycle

### 5.1 When Embeddings Are Generated
- After initial code analysis completes
- After re-analysis (incremental: only changed files)
- On explicit `heury embed` command

### 5.2 When Embeddings Are Invalidated
- When source code changes (detected by file hash comparison)
- When embedding model changes (stored in metadata)
- On explicit `heury reindex` command

### 5.3 Storage Location
```
~/.heury/
  projects/
    my-project/
      heury.db              # SQLite database (code units, patterns, dependencies)
      embeddings.hnsw       # HNSW vector index
      embeddings-meta.json  # Index position -> code unit ID mapping
```

---

## 6. Performance Considerations

- **Batch embedding generation**: Process code units in batches of 100 to minimize API calls
- **Incremental updates**: Only re-embed changed code units (track by file hash)
- **Index persistence**: Save HNSW index to disk, load on startup
- **Lazy loading**: Don't load vector index until first search query
- **Memory budget**: HNSW index for 10K code units at 1536 dimensions is ~60MB in memory

---

## 7. Future Considerations

- **Local embedding models**: Remove dependency on OpenAI API for fully offline operation
- **Multi-project search**: Search across multiple analyzed codebases
- **Embedding caching**: Cache embeddings for unchanged code to speed up re-analysis
- **Dimension reduction**: Use lower-dimension models for smaller codebases to save memory
