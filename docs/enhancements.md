# Technical Debt & Enhancement Log

**Last Updated:** 2026-02-28
**Total Active Issues:** 10
**Resolved This Month:** 4

---

## Active Issues

### Medium Severity

#### [MED-004] analyzeCommand Now Manages Enrichment DB Lifecycle (SRP Escalation)
- **File:** `src/cli/commands/analyze.ts`
- **Principle:** SRP, DIP
- **Description:** The `runEnrichment()` helper inside analyze.ts creates a *second* `DatabaseManager`, a second `SqliteCodeUnitRepository`, and a `SqliteUnitSummaryRepository` with direct concrete imports and dynamic `await import()`. This duplicates composition root responsibilities, couples the CLI command to concrete storage adapters, and makes the enrichment path difficult to test in isolation. Escalated from LOW-004 -- the third post-analysis responsibility has now been added (analysis + manifests + enrichment), triggering the refactor threshold noted in LOW-004.
- **Suggested Fix:** Move enrichment wiring into the composition root so `analyzeCommand` receives a pre-built `EnrichmentService` (or undefined if not configured). The CLI command should only call `enrichmentService.enrich()` and report results.
- **Detected:** 2026-02-28, commit f749d47

#### [MED-005] schema-model-extractor.ts at 507 Lines with Four Framework Parsers (Growing SRP)
- **File:** `src/extraction/schema-model-extractor.ts`
- **Principle:** SRP, OCP
- **Description:** This single file contains detection logic and field parsing for Prisma, TypeORM, Mongoose, and Drizzle -- four distinct ORM frameworks. At 507 lines it is the largest new extractor. Adding a fifth framework (e.g., Sequelize, MikroORM) requires modifying the `extractSchemaModels` orchestrator function and adding another block of code to this file. The pattern `if (hasX) extractX()` is a mild type-switch on framework.
- **Suggested Fix:** Extract each framework parser into its own module (e.g., `prisma-schema-parser.ts`) behind a shared `SchemaParser` interface with a `canHandle(content, filePath): boolean` method. The orchestrator loops over registered parsers, achieving OCP. Not urgent while only 4 frameworks exist, but the file is already large enough to warrant monitoring.
- **Detected:** 2026-02-28, commit f749d47

### Low Severity

#### [LOW-010] generatePatternsManifest Growing Positional Parameter List (5 Params)
- **File:** `src/application/manifest/patterns-generator.ts`
- **Principle:** SRP (secondary: readability)
- **Description:** `generatePatternsManifest` now accepts 5 positional parameters (`codeUnitRepo`, `envVarRepo`, `maxTokens`, `eventFlowRepo?`, `patternTemplateRepo?`), two of which are optional trailing params. This mirrors the same issue already tracked in LOW-008 for `generateModulesManifest`. Adding another optional repo will make call sites difficult to read. The function signature is fragile because optional positional params must maintain order.
- **Suggested Fix:** Bundle the repository dependencies into a `PatternsGeneratorDeps` interface object, consistent with the fix suggested for LOW-008. This would unify the approach across all manifest generators.
- **Detected:** 2026-02-28, commit 6211e80

#### [LOW-009] deep-analysis-processor.ts processDeepAnalysis Accumulating Extraction Responsibilities
- **File:** `src/application/deep-analysis-processor.ts`
- **Principle:** SRP
- **Description:** `processDeepAnalysis` now orchestrates 7 distinct extraction/computation tasks: function calls, type fields, event flows, schema models, guards, file clusters, and pattern templates. The `DeepAnalysisDependencies` interface has grown to 9 optional/required repos. Each new feature adds another `if (deps.xRepo)` block to the function body. The function is 239 lines and still manageable but is on a trajectory toward becoming a god function. The pattern template block (lines 196-228) follows the same structural pattern as the cluster block, suggesting an extraction opportunity.
- **Suggested Fix:** Consider extracting each post-processing step into a separate function or class behind a common `DeepAnalysisStep` interface with `canRun(deps): boolean` and `run(fileResults, fileContents, deps): StepResult`. The orchestrator iterates over registered steps. Not urgent since the current structure is readable, but monitor as more steps are added.
- **Detected:** 2026-02-28, commit 6211e80

#### [LOW-008] generateModulesManifest Growing Parameter List (5 Positional Params)
- **File:** `src/application/manifest/modules-generator.ts`
- **Principle:** SRP (secondary: readability)
- **Description:** `generateModulesManifest` now accepts 5 positional parameters (`codeUnitRepo`, `dependencyRepo`, `maxTokens`, `typeFieldRepo?`, `fileClusterRepo?`), two of which are optional trailing params. This is not severe but is on the boundary of parameter-object refactoring territory. Adding another optional repo will make call sites difficult to read and the signature fragile (optional positional params must maintain order).
- **Suggested Fix:** Bundle the repository dependencies into a single `ModulesGeneratorDeps` interface object, keeping `maxTokens` as a separate parameter or part of an options object. This matches the pattern already used by `DeepAnalysisDependencies` and `AnalysisDependencies` in the same codebase. Low urgency since only 5 params currently.
- **Detected:** 2026-02-28, commit a1b78ca

#### [LOW-007] LLM Provider Factory Uses Switch on Provider Type
- **File:** `src/adapters/llm/llm-provider-factory.ts`
- **Principle:** OCP
- **Description:** The `createLlmProvider` factory uses a `switch` statement on `config.provider` to instantiate one of three concrete providers. Adding a new LLM provider requires modifying this switch. This is a textbook OCP violation, though at 3 providers in a factory function it is pragmatic and contained.
- **Suggested Fix:** Consider a registry-map approach (`Map<string, (config) => ILlmProvider>`) that allows registering new providers without modifying the factory body. Low urgency since provider additions are infrequent.
- **Detected:** 2026-02-28, commit f749d47

#### [LOW-006] Duplicated getLineNumber Utility Across Extractors
- **File:** `src/extraction/event-flow-extractor.ts`, `src/extraction/schema-model-extractor.ts`
- **Principle:** DRY (supporting SRP)
- **Description:** Both `event-flow-extractor.ts` and `schema-model-extractor.ts` contain identical `getLineNumber(content, offset)` functions that compute 1-based line numbers from character offsets. This is a small but clear duplication.
- **Suggested Fix:** Extract into a shared `src/extraction/utils.ts` or similar. Trivial fix.
- **Detected:** 2026-02-28, commit f749d47

#### [LOW-005] function-extractor.ts Name and Scope Mismatch (Growing SRP Concern)
- **File:** `src/extraction/function-extractor.ts`
- **Principle:** SRP
- **Description:** The file is named "function-extractor" but now extracts 7 distinct construct types: named functions, arrow functions, classes, methods, interfaces, enums, and type aliases. At 468 lines, the `extractCodeUnits` orchestrator function must be modified each time a new construct type is added (mild OCP concern). The file is not yet a god module but is on a trajectory toward one.
- **Suggested Fix:** Rename to `ts-code-unit-extractor.ts` (or similar) to match actual scope. If the file grows past ~600 lines, consider extracting each construct extractor into its own module with a registry pattern so new types can be added without modifying `extractCodeUnits`. Monitor for now.
- **Detected:** 2026-02-28, commit dae2249

#### [LOW-004] analyzeCommand Accumulating Post-Analysis Responsibilities -- ESCALATED to MED-004
- **File:** `src/cli/commands/analyze.ts`
- **Principle:** SRP
- **Description:** Originally noted as low severity when only analysis + manifests existed. Now escalated to MED-004 since the enrichment step was added as a third responsibility. See MED-004 for current assessment.
- **Detected:** 2026-02-28, commit d0f6552
- **Escalated:** 2026-02-28, commit f749d47

#### [LOW-002] LanguageExtractor Interface Could Be Segregated
- **File:** `src/extraction/language-registry.ts`
- **Principle:** ISP
- **Description:** The `LanguageExtractor` interface has 6 methods. Some consumers only need `extractCodeUnits` or only `getPatternRules`. Currently all language extractors implement all methods, so this is not causing concrete problems, but as the interface grows it could become a fat interface.
- **Suggested Fix:** Consider splitting into `CodeUnitExtractor`, `DependencyExtractor`, `PatternProvider`, and `ComplexityProvider` role interfaces if the interface grows further. Monitor for now.
- **Detected:** 2026-02-27, commit 372fed7

---

## Resolved Issues

#### [LOW-003] Duplicated Traversal Logic Between findBlockEnd and findBlockEndIndex
- **Resolved:** 2026-02-28
- **Resolution:** Extracted shared `findClosingBrace()` helper that returns both `charIndex` and `lineNumber`; `findBlockEnd` and `findBlockEndIndex` are now thin wrappers.

#### [MED-001] AnalysisOrchestrator: Duplication Between analyze() and analyzeIncremental()
- **Resolved:** 2026-02-27, commit 3153f0a
- **Resolution:** Extracted shared `processFiles()` method; both `analyze()` and `analyzeIncremental()` delegate to it.

#### [MED-002] FileProcessor: Double Code Unit Creation Pattern
- **Resolved:** 2026-02-27, commit 3153f0a
- **Resolution:** Code unit IDs are generated upfront in FileProcessor, eliminating the double-creation pattern and deduplicating `buildCodeUnit` logic.

#### [MED-003] Composition Root Contains In-Memory Repository Implementations
- **Resolved:** 2026-02-27, commit 3153f0a
- **Resolution:** Replaced inline in-memory repositories with SQLite repositories from the storage adapter layer.

#### [LOW-001] SqliteCodeUnitRepository: Children Not Persisted
- **Resolved:** 2026-02-27, commit 3153f0a
- **Resolution:** Children are now persisted and reconstructed using `parent_unit_id`, with top-level filtering on list queries.

---

## Statistics

| Metric | Value |
|--------|-------|
| Total Active | 10 |
| Critical | 0 |
| High | 0 |
| Medium | 2 |
| Low | 8 |
| Resolved This Month | 4 |
