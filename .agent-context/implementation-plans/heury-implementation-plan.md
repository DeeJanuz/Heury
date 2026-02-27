# Heury Implementation Plan

> Comprehensive phased implementation plan for heury - an open-source, local-first codebase analysis tool for LLM discovery.

---

## Overview

This plan breaks the heury implementation into 9 phases, each producing independently testable, working software. Phases are ordered by dependency: domain layer first, then application services, then adapters (hexagonal architecture). Each phase lists specific files, responsibilities, test strategy, and acceptance criteria.

**Reference implementation**: Ludflow's codebase analysis engine at `/home/deej/projects/ludflow/lib/codebase-docs/`

**Key architecture decisions**:
- Hexagonal architecture (domain -> application -> adapters)
- TDD throughout (RED-GREEN-REFACTOR)
- SOLID principles enforced at every layer
- SQLite via better-sqlite3 for storage
- Local embeddings via ONNX (all-MiniLM-L6-v2) as default
- MCP server with stdio + HTTP transports

---

## Phase 0: Project Scaffolding

**Goal**: Set up the project infrastructure so all subsequent phases can immediately write and run tests.

**Independently valuable**: Yes - establishes the development environment and project structure.

### Files to Create

```
package.json                    - npm package config (name: "heury", bin entries)
tsconfig.json                   - TypeScript strict mode config
vitest.config.ts                - Vitest configuration
tsup.config.ts                  - Build configuration for bundling
.gitignore                      - Updated with .heury/, dist/, node_modules/
src/index.ts                    - Main entry point (empty placeholder)
LICENSE                         - Elastic License v2 text
```

### Dependencies to Install

**Production**: (none yet - added per phase)
**Development**: typescript, vitest, tsup, @types/node

### Configuration Details

**tsconfig.json**:
- strict: true
- target: ES2022
- module: NodeNext
- moduleResolution: NodeNext
- outDir: dist
- rootDir: src
- paths: { "@/*": ["./src/*"] }

**vitest.config.ts**:
- include: ["tests/**/*.test.ts"]
- coverage provider: v8

**package.json**:
- name: "heury"
- type: "module"
- bin: { "heury": "./dist/cli.js" }
- scripts: test, build, dev

### Directory Structure

```
src/
  domain/           - Pure business logic, models, value objects
    models/         - CodeUnit, CodeUnitPattern, FileDependency, etc.
    ports/          - Port interfaces (repositories, services)
  application/      - Use cases, orchestrators
  adapters/         - Infrastructure implementations
    storage/        - SQLite adapter
    embedding/      - ONNX and OpenAI adapters
    filesystem/     - File system access
    mcp/            - MCP server adapter
  extraction/       - Analysis extraction engine
    languages/      - Language-specific extractors
    shared/         - Shared extraction utilities
  cli/              - CLI command handlers
  config/           - Configuration loading
tests/
  domain/           - Pure unit tests
  application/      - Integration tests with mocked ports
  adapters/         - Integration tests with real systems
  extraction/       - Extraction engine tests
  helpers/          - Test utilities, fakes, builders
    fakes/
    builders/
    fixtures/
```

### Test Strategy
- Verify TypeScript compiles with strict mode
- Verify vitest runs and discovers tests
- Verify build produces output

### Acceptance Criteria
- `npm test` runs successfully (even with zero tests)
- `npm run build` compiles without errors
- Directory structure is established

---

## Phase 1: Domain Models and Value Objects

**Goal**: Define all core domain types, enums, and value objects as pure TypeScript. These are the foundation everything else builds on.

**Independently valuable**: Yes - provides type definitions and domain logic that all other layers depend on.

**Dependencies**: Phase 0

### Files to Create

```
src/domain/models/code-unit.ts           - CodeUnit entity + CodeUnitType enum
src/domain/models/code-unit-pattern.ts   - CodeUnitPattern entity + PatternType enum
src/domain/models/file-dependency.ts     - FileDependency entity + ImportType enum
src/domain/models/env-variable.ts        - RepositoryEnvVariable entity
src/domain/models/api-endpoint-spec.ts   - ApiEndpointSpec entity + HttpMethod enum
src/domain/models/analysis-result.ts     - AnalysisResult + AnalysisStats value objects
src/domain/models/complexity-metrics.ts  - ComplexityMetrics value object
src/domain/models/index.ts              - Barrel export
```

### Implementation Details

Port from Ludflow's models documented in `/home/deej/projects/heury/docs/domain-models.md`. Key differences from Ludflow:
- No `repositoryId` or `organizationId` fields (single-user, local)
- `id` fields use crypto.randomUUID() or nanoid
- Models are plain TypeScript interfaces/types + factory functions, NOT Prisma models
- Include validation logic in factory functions

**CodeUnitType enum** values: MODULE, FUNCTION, ARROW_FUNCTION, CLASS, METHOD, STRUCT, TRAIT, INTERFACE, ENUM, IMPL_BLOCK

**PatternType enum** values: API_ENDPOINT, API_CALL, DATABASE_READ, DATABASE_WRITE, EXTERNAL_SERVICE, ENV_VARIABLE, IMPORT, EXPORT

**ImportType enum** values: NAMED, DEFAULT, NAMESPACE, DYNAMIC, PACKAGE, MODULE, WILDCARD

**ComplexityMetrics**: conditionals, loops, maxNestingDepth, tryCatchBlocks, asyncPatterns, callbackDepth, parameterCount, lineCount

### Test Strategy
- Pure unit tests for all model factory functions
- Test validation rules (e.g., lineStart < lineEnd, required fields)
- Test enum coverage
- Test complexity score calculation

### Test Files
```
tests/domain/models/code-unit.test.ts
tests/domain/models/code-unit-pattern.test.ts
tests/domain/models/file-dependency.test.ts
tests/domain/models/complexity-metrics.test.ts
```

### Acceptance Criteria
- All domain models defined with TypeScript types
- Factory functions validate inputs
- Complexity score calculation works correctly
- All enums have complete values matching domain-models.md

---

## Phase 2: Port Interfaces

**Goal**: Define all port interfaces (contracts) that the domain layer exposes. These are the boundaries between domain/application and adapters.

**Independently valuable**: Yes - defines contracts that guide adapter implementation and enable testing with fakes.

**Dependencies**: Phase 1

### Files to Create

```
src/domain/ports/code-unit-repository.ts       - ICodeUnitRepository interface
src/domain/ports/file-dependency-repository.ts  - IFileDependencyRepository interface
src/domain/ports/env-variable-repository.ts     - IEnvVariableRepository interface
src/domain/ports/analysis-repository.ts         - IAnalysisRepository (stats, metadata)
src/domain/ports/embedding-provider.ts          - IEmbeddingProvider interface
src/domain/ports/vector-search.ts              - IVectorSearchService interface
src/domain/ports/file-system.ts                - IFileSystem interface (read files, glob)
src/domain/ports/config-provider.ts            - IConfigProvider interface
src/domain/ports/index.ts                      - Barrel export
```

### Interface Details

**ICodeUnitRepository**:
- save(units: CodeUnit[]): Promise<void>
- findByFilePath(filePath: string): Promise<CodeUnit[]>
- findByType(type: CodeUnitType): Promise<CodeUnit[]>
- findByComplexityAbove(threshold: number): Promise<CodeUnit[]>
- search(query: string): Promise<CodeUnit[]>
- clear(): Promise<void>
- getStats(): Promise<{ total: number; byType: Record<string, number>; byLanguage: Record<string, number> }>

**IFileDependencyRepository**:
- save(deps: FileDependency[]): Promise<void>
- findBySource(sourceFile: string): Promise<FileDependency[]>
- findByTarget(targetFile: string): Promise<FileDependency[]>
- clear(): Promise<void>

**IEnvVariableRepository**:
- save(vars: RepositoryEnvVariable[]): Promise<void>
- findAll(): Promise<RepositoryEnvVariable[]>
- clear(): Promise<void>

**IEmbeddingProvider**:
- generateEmbedding(text: string): Promise<number[]>
- generateBatchEmbeddings(texts: string[]): Promise<number[][]>
- getDimension(): number
- getModelName(): string

**IVectorSearchService**:
- search(options: VectorSearchOptions): Promise<VectorSearchResult[]>
- indexCodeUnits(units: EmbeddableCodeUnit[]): Promise<void>
- rebuildIndex(): Promise<void>
- getIndexStats(): Promise<{ totalVectors: number; dimension: number; model: string }>

**IFileSystem**:
- readFile(path: string): Promise<string>
- exists(path: string): Promise<boolean>
- glob(pattern: string, options?: { ignore?: string[] }): Promise<string[]>
- writeFile(path: string, content: string): Promise<void>
- mkdir(path: string): Promise<void>

**IConfigProvider**:
- getConfig(): HeuryConfig
- getProjectRoot(): string

### Test Strategy
- Create in-memory fakes for each port (these are test helpers used by all subsequent phases)
- Verify fakes implement the interface correctly

### Test Files (Fakes)
```
tests/helpers/fakes/in-memory-code-unit-repository.ts
tests/helpers/fakes/in-memory-file-dependency-repository.ts
tests/helpers/fakes/in-memory-env-variable-repository.ts
tests/helpers/fakes/in-memory-analysis-repository.ts
tests/helpers/fakes/fake-embedding-provider.ts
tests/helpers/fakes/fake-vector-search.ts
tests/helpers/fakes/fake-file-system.ts
tests/helpers/fakes/fake-config-provider.ts
tests/helpers/fakes/index.ts
```

### Acceptance Criteria
- All port interfaces defined
- All in-memory fakes created and usable
- Fakes pass basic smoke tests

---

## Phase 3: Core Extraction Engine

**Goal**: Port the heuristic extraction subsystem from Ludflow. This is the heart of heury's analysis capability: extracting code units, detecting patterns, calculating complexity, and parsing dependencies.

**Independently valuable**: Yes - the extraction engine can be tested in isolation with string inputs and produces structured output.

**Dependencies**: Phase 1 (domain models)

### Files to Create

```
src/extraction/shared/block-finder.ts            - findBlockEnd, getLineNumber, isInsideStringOrComment, findIndentationBlockEnd
src/extraction/shared/pattern-rules-shared.ts     - Shared SQL and external service patterns
src/extraction/shared/index.ts                    - Barrel export

src/extraction/function-extractor.ts              - extractCodeUnits, extractCodeBlock (JS/TS default)
src/extraction/pattern-detector.ts                - detectPatterns, DetectedPattern type, PATTERN_RULES
src/extraction/complexity-calculator.ts           - calculateComplexity, calculateComplexityScore
src/extraction/dependency-extractor.ts            - extractDependencies, FileDependencyInfo
src/extraction/env-extractor.ts                   - extractEnvVariables, isEnvExampleFile
src/extraction/column-extractor.ts                - extractColumnAccess

src/extraction/language-registry.ts               - LanguageRegistry class, LanguageExtractor interface, PatternRuleSet type
src/extraction/languages/javascript-typescript.ts - JavaScriptTypeScriptExtractor
src/extraction/languages/python.ts                - PythonExtractor
src/extraction/languages/go.ts                    - GoExtractor
src/extraction/languages/rust.ts                  - RustExtractor
src/extraction/languages/java.ts                  - JavaExtractor
src/extraction/languages/csharp.ts                - CSharpExtractor
src/extraction/languages/index.ts                 - Register all extractors, export singleton registry

src/extraction/index.ts                           - Barrel export
```

### Implementation Approach

Port from Ludflow's extraction subsystem at:
- `/home/deej/projects/ludflow/lib/codebase-docs/extraction/`
- `/home/deej/projects/ludflow/lib/codebase-docs/extraction/languages/`
- `/home/deej/projects/ludflow/lib/codebase-docs/extraction/shared/`

Key adaptations:
- Remove all Prisma/database imports (these are pure functions)
- Use heury's domain model types instead of Ludflow's Prisma types
- Remove organization/repository scoping
- The extraction functions are purely functional - take string input, return structured output
- The LanguageRegistry follows OCP: new languages added by creating extractor + registering

### SOLID Compliance
- **SRP**: Each extractor/calculator has single responsibility
- **OCP**: Language registry - add languages without modifying existing code
- **DIP**: LanguageExtractor interface abstracts language-specific behavior
- **ISP**: Each extractor method is focused (extractCodeUnits, extractDependencies, getPatternRules)

### Test Strategy
This is the most test-heavy phase. Every extractor and calculator gets comprehensive unit tests with real code samples as fixtures.

### Test Files
```
tests/extraction/shared/block-finder.test.ts
tests/extraction/function-extractor.test.ts
tests/extraction/pattern-detector.test.ts
tests/extraction/complexity-calculator.test.ts
tests/extraction/dependency-extractor.test.ts
tests/extraction/env-extractor.test.ts
tests/extraction/language-registry.test.ts
tests/extraction/languages/javascript-typescript.test.ts
tests/extraction/languages/python.test.ts
tests/extraction/languages/go.test.ts
tests/extraction/languages/rust.test.ts
tests/extraction/languages/java.test.ts
tests/extraction/languages/csharp.test.ts

tests/helpers/fixtures/sample-typescript.ts.txt
tests/helpers/fixtures/sample-python.py.txt
tests/helpers/fixtures/sample-go.go.txt
tests/helpers/fixtures/sample-rust.rs.txt
tests/helpers/fixtures/sample-java.java.txt
tests/helpers/fixtures/sample-csharp.cs.txt
tests/helpers/fixtures/sample-env-example.txt
```

### Test Coverage Targets
- Function extraction: named functions, arrow functions, classes, methods, async, exported, nested
- Pattern detection: all 8 pattern types with language-specific rules
- Complexity calculation: conditionals, loops, nesting, async, parameters
- Dependency extraction: all import types per language
- Language registry: registration, lookup by extension, test file detection
- Edge cases: empty files, comments-only, malformed code, very large files

### Acceptance Criteria
- All 6 language extractors pass tests with real code samples
- Pattern detector identifies all 8 pattern types
- Complexity calculator produces consistent scores
- Dependency extractor handles all import styles
- Language registry correctly routes by file extension
- Env variable extractor handles all .env.example formats

---

## Phase 4: Analysis Orchestrator (Application Layer)

**Goal**: Build the analysis pipeline that coordinates extraction across all files in a codebase. This is the main use case - takes a directory, processes all files, produces analysis results.

**Independently valuable**: Yes - this is the core `heury analyze` workflow. With fakes, it can be fully tested.

**Dependencies**: Phase 1, 2, 3

### Files to Create

```
src/application/analysis-orchestrator.ts    - Main analysis pipeline
src/application/file-processor.ts           - Single file processing logic
src/application/module-level-detector.ts    - Module-level pattern detection
src/application/file-filter.ts              - shouldProcessFile logic
src/application/index.ts                    - Barrel export
```

### Implementation Details

**AnalysisOrchestrator** (port from Ludflow's `analysis-orchestrator.ts`):

```typescript
class AnalysisOrchestrator {
  constructor(
    private codeUnitRepo: ICodeUnitRepository,
    private dependencyRepo: IFileDependencyRepository,
    private envVarRepo: IEnvVariableRepository,
    private fileSystem: IFileSystem,
    private config: IConfigProvider,
  ) {}

  async analyze(projectRoot: string): Promise<AnalysisResult>
  async analyzeIncremental(projectRoot: string, changedFiles: string[]): Promise<AnalysisResult>
}
```

Key differences from Ludflow:
- No Prisma - uses port interfaces for storage
- No encrypted file cache - reads files directly via IFileSystem port
- No Inngest job queue - direct synchronous execution
- No organization scoping
- Adds incremental analysis support (hash-based caching)
- Progress reporting via callback or events

**FileProcessor** - processes a single file:
1. Get language extractor from registry
2. Extract code units
3. Calculate complexity for each unit
4. Detect patterns for each unit
5. Detect module-level patterns
6. Extract dependencies
7. Return all results

**FileFilter** - determines which files to process:
- Uses language registry for supported extensions
- Respects config include/exclude patterns
- Skips test files, dot directories, skip directories

### SOLID Compliance
- **SRP**: Orchestrator coordinates, FileProcessor handles single files, FileFilter handles filtering
- **DIP**: All dependencies injected via constructor (ports)
- **OCP**: New analysis steps can be added without modifying orchestrator

### Test Strategy
Integration tests with in-memory fakes. Test the full pipeline with sample codebases.

### Test Files
```
tests/application/analysis-orchestrator.test.ts
tests/application/file-processor.test.ts
tests/application/module-level-detector.test.ts
tests/application/file-filter.test.ts
tests/helpers/fixtures/sample-project/    - Small sample codebase for integration tests
```

### Acceptance Criteria
- Full analysis of a sample project produces correct CodeUnits, Patterns, Dependencies
- Incremental analysis only processes changed files
- File filtering respects config include/exclude
- Module-level patterns are captured
- Env variables are extracted from .env.example files
- AnalysisStats are accurate

---

## Phase 5: Configuration and CLI Foundation

**Goal**: Build the configuration system and CLI entry points. Users can now run `npx heury init` and `npx heury analyze`.

**Independently valuable**: Yes - provides the user-facing CLI that ties the analysis engine to real filesystem.

**Dependencies**: Phase 0, 1, 2, 4

### Files to Create

```
src/config/schema.ts              - HeuryConfig type definition + defaults
src/config/loader.ts              - Load and validate heury.config.json
src/config/index.ts               - Barrel export

src/cli/index.ts                  - CLI entry point (commander or yargs)
src/cli/commands/init.ts          - `heury init` command
src/cli/commands/analyze.ts       - `heury analyze` command
src/cli/commands/serve.ts         - `heury serve` command (placeholder)

src/adapters/filesystem/node-filesystem.ts  - IFileSystem adapter using Node.js fs
```

### Configuration Schema

```typescript
interface HeuryConfig {
  include: string[]           // Default: ["**/*"]
  exclude: string[]           // Default: ["node_modules/**", "dist/**", "*.test.*"]
  languages: string[]         // Default: [] (auto-detect from registry)
  embedding: {
    provider: "local" | "openai"
    apiKey?: string
    model?: string
  }
  mcp: {
    transport: "stdio" | "http"
    port: number              // Default: 3111
  }
  output: {
    tokenBudget: number       // Default: 5000
  }
  analysis: {
    incremental: boolean      // Default: true
  }
}
```

### CLI Commands

**`heury init`**:
1. Create heury.config.json with defaults
2. Create .heury/ directory
3. Add .heury/ to .gitignore
4. Set up git hooks (post-commit, post-checkout) if git repo
5. Print success message

**`heury analyze`**:
1. Load config
2. Create/connect to SQLite database
3. Run AnalysisOrchestrator
4. Generate manifest files
5. Print stats

### Test Strategy
- Unit tests for config loading and validation
- Integration tests for CLI commands (testing command handlers, not the CLI framework)

### Test Files
```
tests/config/loader.test.ts
tests/config/schema.test.ts
tests/adapters/filesystem/node-filesystem.test.ts
tests/cli/commands/init.test.ts
tests/cli/commands/analyze.test.ts
```

### Acceptance Criteria
- `heury init` creates config file and .heury/ directory
- `heury analyze` runs full analysis and reports stats
- Config loading handles missing file (uses defaults), invalid JSON, partial config
- File system adapter correctly reads/writes/globs

---

## Phase 6: SQLite Storage Adapter

**Goal**: Implement the SQLite storage layer that persists analysis results. Replace in-memory fakes with real storage.

**Independently valuable**: Yes - analysis results now persist across runs. Enables incremental analysis.

**Dependencies**: Phase 2 (ports), Phase 5 (config)

### Files to Create

```
src/adapters/storage/database.ts                    - Database connection manager
src/adapters/storage/migrations/001-initial.sql     - Create tables schema
src/adapters/storage/sqlite-code-unit-repository.ts - ICodeUnitRepository implementation
src/adapters/storage/sqlite-dependency-repository.ts - IFileDependencyRepository implementation
src/adapters/storage/sqlite-env-variable-repository.ts - IEnvVariableRepository implementation
src/adapters/storage/sqlite-analysis-repository.ts  - IAnalysisRepository implementation
src/adapters/storage/hash-cache.ts                  - File hash cache for incremental analysis
src/adapters/storage/index.ts                       - Barrel export
```

### Database Schema

```sql
CREATE TABLE code_units (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_type TEXT NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  parent_unit_id TEXT,
  signature TEXT,
  is_async INTEGER NOT NULL DEFAULT 0,
  is_exported INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL,
  complexity TEXT NOT NULL DEFAULT '{}',  -- JSON
  complexity_score INTEGER NOT NULL DEFAULT 0,
  UNIQUE(file_path, name, unit_type, line_start)
);

CREATE TABLE code_unit_patterns (
  id TEXT PRIMARY KEY,
  code_unit_id TEXT NOT NULL REFERENCES code_units(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL,
  pattern_value TEXT NOT NULL,
  line_number INTEGER,
  column_access TEXT  -- JSON
);

CREATE TABLE file_dependencies (
  id TEXT PRIMARY KEY,
  source_file TEXT NOT NULL,
  target_file TEXT NOT NULL,
  import_type TEXT NOT NULL,
  imported_names TEXT NOT NULL DEFAULT '[]',  -- JSON array
  UNIQUE(source_file, target_file)
);

CREATE TABLE env_variables (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  has_default INTEGER NOT NULL DEFAULT 0,
  line_number INTEGER NOT NULL
);

CREATE TABLE file_hashes (
  file_path TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  analyzed_at TEXT NOT NULL
);

CREATE INDEX idx_code_units_file_path ON code_units(file_path);
CREATE INDEX idx_code_units_type ON code_units(unit_type);
CREATE INDEX idx_code_units_complexity ON code_units(complexity_score);
CREATE INDEX idx_code_units_language ON code_units(language);
CREATE INDEX idx_patterns_code_unit ON code_unit_patterns(code_unit_id);
CREATE INDEX idx_patterns_type ON code_unit_patterns(pattern_type);
CREATE INDEX idx_patterns_type_value ON code_unit_patterns(pattern_type, pattern_value);
CREATE INDEX idx_deps_source ON file_dependencies(source_file);
CREATE INDEX idx_deps_target ON file_dependencies(target_file);
```

### Dependencies to Install
- better-sqlite3
- @types/better-sqlite3

### Implementation Details

**Database connection manager**:
- Opens/creates .heury/analysis.db
- Runs migrations on first connect
- WAL mode for better read performance
- Provides typed query helpers

**Hash cache**:
- Stores file path -> content hash
- Used by incremental analysis to skip unchanged files
- `getChangedFiles(allFiles: string[]): Promise<string[]>` - returns files with changed/new hashes

### SOLID Compliance
- **SRP**: Each repository handles one entity type
- **DIP**: Implements port interfaces defined in domain
- **OCP**: New tables/repositories added without modifying existing ones

### Test Strategy
Adapter integration tests with real SQLite (in-memory or temp file).

### Test Files
```
tests/adapters/storage/database.test.ts
tests/adapters/storage/sqlite-code-unit-repository.test.ts
tests/adapters/storage/sqlite-dependency-repository.test.ts
tests/adapters/storage/sqlite-env-variable-repository.test.ts
tests/adapters/storage/hash-cache.test.ts
```

### Acceptance Criteria
- All CRUD operations work correctly
- Indexes are created
- Hash cache correctly identifies changed files
- Database survives process restart (file persistence)
- Migrations run idempotently

---

## Phase 7: Manifest File Generation

**Goal**: Generate the four markdown manifest files (.heury/modules.md, patterns.md, dependencies.md, hotspots.md) from analysis data. This is what LLMs consume for quick discovery.

**Independently valuable**: Yes - this is the primary output that makes heury useful. LLMs can read these files for instant codebase understanding.

**Dependencies**: Phase 2 (ports), Phase 4 (analysis data exists)

### Files to Create

```
src/application/manifest/manifest-generator.ts   - Coordinates all generators
src/application/manifest/modules-generator.ts    - Generates modules.md
src/application/manifest/patterns-generator.ts   - Generates patterns.md
src/application/manifest/dependencies-generator.ts - Generates dependencies.md
src/application/manifest/hotspots-generator.ts   - Generates hotspots.md
src/application/manifest/token-budgeter.ts       - Token budget allocation across files
src/application/manifest/index.ts                - Barrel export
```

### Manifest File Formats

**modules.md** (~1500 tokens):
```markdown
# Module Overview

## src/auth/
Authentication and authorization. Key files:
- session.ts - Session management (3 functions, 2 API endpoints)
- permissions.ts - Permission checking (5 functions)

## src/api/
REST API layer. Key files:
- routes.ts - Route definitions (8 API endpoints)
...
```

**patterns.md** (~1500 tokens):
```markdown
# Detected Patterns

## API Endpoints (12 total)
- GET /api/users - src/api/users.ts:15
- POST /api/auth/login - src/auth/login.ts:8
...

## Database Operations (8 total)
- prisma.user.findMany - src/services/user-service.ts:22
...

## External Services (3 total)
- stripe.checkout - src/billing/checkout.ts:45
...

## Environment Variables (6 total)
- DATABASE_URL - Database connection
...
```

**dependencies.md** (~1000 tokens):
```markdown
# Dependency Graph

## High-connectivity modules
- src/lib/db.ts - imported by 12 files
- src/lib/auth.ts - imported by 8 files

## Module relationships
src/api/ -> src/services/ -> src/lib/
src/auth/ -> src/lib/
```

**hotspots.md** (~1000 tokens):
```markdown
# Complexity Hotspots

## High Complexity (score > 35)
- processPayment (src/billing/checkout.ts:45-120) - Score: 42
  8 conditionals, 3 loops, nesting depth 5

## Moderate Complexity (score 16-35)
...
```

### Implementation Details

**Token budgeter**:
- Total budget: configurable (default 5000 tokens)
- Allocation: modules 30%, patterns 30%, dependencies 20%, hotspots 20%
- Estimates tokens using word count / 0.75 approximation
- Truncates sections that exceed budget (most important items first)

**Generator pattern**: Each generator takes repository data via ports and produces markdown string. The manifest generator coordinates them and writes files.

### SOLID Compliance
- **SRP**: Each generator produces one file
- **OCP**: New manifest files added by creating new generator
- **DIP**: Generators receive data through port interfaces

### Test Strategy
Unit tests with known data sets, verifying markdown output format and token budget compliance.

### Test Files
```
tests/application/manifest/modules-generator.test.ts
tests/application/manifest/patterns-generator.test.ts
tests/application/manifest/dependencies-generator.test.ts
tests/application/manifest/hotspots-generator.test.ts
tests/application/manifest/token-budgeter.test.ts
tests/application/manifest/manifest-generator.test.ts
```

### Acceptance Criteria
- All four manifest files generated with correct format
- Token budget is respected (within 10% tolerance)
- Empty analysis produces empty but valid manifest files
- Most important items appear first (sorted by relevance/complexity)
- File paths in manifests are relative to project root

---

## Phase 8: MCP Server

**Goal**: Expose analysis data through an MCP (Model Context Protocol) server. LLMs can query the analysis database for deeper exploration beyond manifest files.

**Independently valuable**: Yes - enables Tier 3 deep queries via MCP protocol.

**Dependencies**: Phase 2 (ports), Phase 6 (storage)

### Files to Create

```
src/adapters/mcp/server.ts                     - MCP server factory
src/adapters/mcp/tool-registry.ts              - Tool registration and dispatch
src/adapters/mcp/tools/get-analysis-stats.ts   - Analysis statistics tool
src/adapters/mcp/tools/get-module-overview.ts  - Module overview tool
src/adapters/mcp/tools/search-codebase.ts      - Keyword search tool
src/adapters/mcp/tools/get-code-units.ts       - Code unit retrieval tool
src/adapters/mcp/tools/get-dependencies.ts     - Dependency query tool
src/adapters/mcp/tools/get-api-endpoints.ts    - API endpoint listing tool
src/adapters/mcp/tools/get-file-content.ts     - File content with context tool
src/adapters/mcp/tools/vector-search.ts        - Semantic search tool (placeholder until Phase 9)
src/adapters/mcp/tools/index.ts                - Barrel export
src/adapters/mcp/index.ts                      - Barrel export

src/cli/commands/serve.ts                      - Update serve command to start MCP server
```

### Dependencies to Install
- @modelcontextprotocol/sdk

### MCP Tool Definitions

Each tool follows the pattern from Ludflow's MCP server:
- Tool definition (name, description, inputSchema)
- Handler function (validates args, queries data, formats response)

**Tools** (8 total, down from Ludflow's 18):

1. **get_analysis_stats**: Overview stats (file count, code units by type, pattern counts, dependency count)
2. **get_module_overview**: Module/directory descriptions with file counts and key patterns
3. **search_codebase**: Keyword search across code unit names, file paths, pattern values
4. **get_code_units**: Retrieve code units by file path, type, or name. Optional source inclusion.
5. **get_dependencies**: Query import graph (what does file X import? what imports file X?)
6. **get_api_endpoints**: List all API endpoints with HTTP method, route, file location
7. **get_file_content**: Read file content with analysis context (code units, patterns in that file)
8. **vector_search**: Semantic search (functional after Phase 9, returns empty before)

**Server instructions** (sent to LLM clients):
```
Workflow: DISCOVER -> READ -> VERIFY
1. DISCOVER: get_analysis_stats -> get_module_overview or search_codebase
2. READ: get_file_content, get_code_units (include_source=true)
3. VERIFY: get_dependencies, search_codebase (broader), vector_search
```

### Transport Support
- **stdio** (default): Direct process communication
- **HTTP**: Optional, configurable port (default 3111)

### SOLID Compliance
- **SRP**: Each tool handler is self-contained
- **OCP**: Tool registry pattern - add tools without modifying dispatch logic
- **DIP**: Tools receive data through port interfaces

### Test Strategy
Integration tests that create a server, register tools, and verify tool call responses.

### Test Files
```
tests/adapters/mcp/tool-registry.test.ts
tests/adapters/mcp/tools/get-analysis-stats.test.ts
tests/adapters/mcp/tools/get-module-overview.test.ts
tests/adapters/mcp/tools/search-codebase.test.ts
tests/adapters/mcp/tools/get-code-units.test.ts
tests/adapters/mcp/tools/get-dependencies.test.ts
tests/adapters/mcp/tools/get-api-endpoints.test.ts
tests/adapters/mcp/tools/get-file-content.test.ts
```

### Acceptance Criteria
- MCP server starts and lists all tools
- Each tool returns correct data format
- Tool input validation rejects invalid arguments
- stdio transport works for direct integration
- HTTP transport starts on configured port
- Discover -> Read -> Verify workflow produces useful results

---

## Phase 9: Embedding and Vector Search

**Goal**: Add semantic search capability using local embeddings (ONNX all-MiniLM-L6-v2) with optional OpenAI override.

**Independently valuable**: Yes - enables the `vector_search` MCP tool and semantic code discovery.

**Dependencies**: Phase 2 (ports), Phase 6 (storage), Phase 8 (MCP tool placeholder)

### Files to Create

```
src/adapters/embedding/local-embedding-provider.ts   - ONNX Runtime all-MiniLM-L6-v2 adapter
src/adapters/embedding/openai-embedding-provider.ts  - OpenAI text-embedding-3-small adapter
src/adapters/embedding/embedding-text-builder.ts     - Builds embeddable text from code units
src/adapters/embedding/index.ts                      - Barrel export

src/adapters/vector-search/sqlite-vss-search.ts      - sqlite-vss vector search adapter
src/adapters/vector-search/index.ts                  - Barrel export

src/application/embedding-pipeline.ts                - Post-analysis embedding generation
```

### Dependencies to Install
- onnxruntime-node (for local embeddings)
- sqlite-vss (for vector search)
- openai (optional, for OpenAI embeddings)

### Implementation Details

**LocalEmbeddingProvider** (default):
- Uses all-MiniLM-L6-v2 model via ONNX Runtime
- 384 dimensions
- Fully offline, no API key needed
- Model downloaded on first use or bundled

**OpenAIEmbeddingProvider** (optional):
- Uses text-embedding-3-small
- 1536 dimensions (or configurable)
- Requires API key in config

**EmbeddingTextBuilder** (from RAG design doc):
```typescript
function buildEmbeddingText(unit: EmbeddableCodeUnit): string {
  // Combines: unitType, name, filePath, signature, patterns, sourcePreview
}
```

**EmbeddingPipeline**:
- Runs after analysis completes
- Generates embeddings for all code units
- Stores in sqlite-vss virtual table
- Supports incremental updates (only re-embed changed units)

**SQLiteVssSearch**:
- Creates virtual table for vector similarity search
- Implements IVectorSearchService
- Post-filters results by file path, unit type, pattern type
- Returns similarity scores

### SOLID Compliance
- **DIP**: IEmbeddingProvider interface allows swapping providers
- **SRP**: Text builder, embedding provider, vector search are separate concerns
- **OCP**: New embedding providers added without modifying existing code

### Test Strategy
- Unit tests for embedding text builder
- Integration tests for ONNX provider (skip in CI if model not available)
- Integration tests for sqlite-vss search
- E2E test: analyze -> embed -> search

### Test Files
```
tests/adapters/embedding/local-embedding-provider.test.ts
tests/adapters/embedding/openai-embedding-provider.test.ts
tests/adapters/embedding/embedding-text-builder.test.ts
tests/adapters/vector-search/sqlite-vss-search.test.ts
tests/application/embedding-pipeline.test.ts
```

### Acceptance Criteria
- Local embedding provider generates 384-dimension vectors
- OpenAI provider generates configurable-dimension vectors
- Vector search returns semantically relevant results
- Embedding pipeline runs after analysis
- Incremental embedding updates work
- vector_search MCP tool now returns real results

---

## Composition Root

After all phases, the composition root wires everything together:

```
src/composition-root.ts    - Creates all adapters, injects into application services
```

This is built incrementally - each phase adds its components to the composition root.

---

## Phase Dependencies Summary

```
Phase 0: Scaffolding (standalone)
Phase 1: Domain Models (depends on 0)
Phase 2: Port Interfaces (depends on 1)
Phase 3: Extraction Engine (depends on 1)
Phase 4: Analysis Orchestrator (depends on 1, 2, 3)
Phase 5: Config + CLI (depends on 0, 1, 2, 4)
Phase 6: SQLite Storage (depends on 2, 5)
Phase 7: Manifest Generation (depends on 2, 4)
Phase 8: MCP Server (depends on 2, 6)
Phase 9: Embeddings + Vector Search (depends on 2, 6, 8)
```

**Parallelization opportunities**:
- Phase 3 and Phase 2 can run in parallel (both depend only on Phase 1)
- Phase 6, 7, and 8 can be partially parallelized (all depend on Phase 2 but different adapters)

---

## Estimated Effort Per Phase

| Phase | Description | Files | Tests | Relative Size |
|-------|------------|-------|-------|---------------|
| 0 | Scaffolding | 6 | 0 | Small |
| 1 | Domain Models | 8 | 4 | Small |
| 2 | Port Interfaces | 9 + 9 fakes | 0 | Medium |
| 3 | Extraction Engine | 17 + 6 fixtures | 13 | **Large** |
| 4 | Analysis Orchestrator | 5 | 4 | Medium |
| 5 | Config + CLI | 7 | 5 | Medium |
| 6 | SQLite Storage | 8 | 5 | Medium |
| 7 | Manifest Generation | 7 | 6 | Medium |
| 8 | MCP Server | 12 | 8 | Medium-Large |
| 9 | Embeddings + Vector Search | 7 | 5 | Medium |

---

## Risk Considerations

1. **Native dependencies** (better-sqlite3, onnxruntime-node, sqlite-vss): May have compilation issues on some platforms. Mitigation: test on multiple platforms, provide fallback for sqlite-vss.

2. **Phase 3 size**: The extraction engine is large (17 source files, 13 test files). Consider splitting into sub-phases: 3a (shared + JS/TS), 3b (remaining languages).

3. **ONNX model size**: The all-MiniLM-L6-v2 model is ~22MB. Consider lazy download vs bundling.

4. **sqlite-vss maturity**: sqlite-vss is less mature than alternatives. Fallback plan: use hnswlib as documented in the RAG design doc.

5. **Token budget for manifests**: The 5K token target may need tuning for different codebase sizes. The token budgeter should be configurable and conservative.
