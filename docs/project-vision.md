# heury - Project Vision

> Pre-analyzed codebase intelligence for LLMs. One read instead of dozens of tool calls.

---

## What is heury?

**heury** is an open-source, local-first codebase analysis tool that helps LLMs understand codebases faster and more accurately. It extracts code structure through heuristic analysis, generates focused manifest files for quick LLM discovery, and optionally exposes an MCP server for deeper queries.

### The Problem

When an LLM encounters an unfamiliar codebase, it resorts to an expensive discovery loop:

```
glob -> grep -> read -> grep again -> read another file -> ...
```

Each iteration consumes tool calls, burns tokens on irrelevant content, and still produces an incomplete picture. The LLM is guessing where to look.

### The Solution

heury pre-analyzes the codebase and produces a structured "lay of the land" that an LLM can consume in a single read. Instead of dozens of exploratory tool calls, the LLM gets immediate orientation and can make targeted, informed file reads from the start.

---

## Target Users

| Audience | Use Case |
|----------|----------|
| Solo developers using LLM coding tools (Claude Code, Cursor, Copilot, etc.) | Faster, more accurate LLM assistance on their codebase |
| Open-source maintainers | Help contributors and LLMs onboard faster |

### What heury is NOT

- Not a SaaS product. It is a local tool that ships with your repo.
- Not a cloud service, hosted platform, or managed offering.
- Not a replacement for documentation. It complements it with machine-readable structure.

---

## The Core Innovation: Hybrid Discovery Flow

This three-tier flow is the heart of heury's value:

### Tier 1 - Quick Discovery (Manifest Files)

The LLM reads `.heury/modules.md`, `patterns.md`, `dependencies.md`, and `hotspots.md` in one shot (~5K tokens total). It gets instant understanding of what the codebase does, its key patterns, and areas of complexity.

### Tier 2 - Targeted Reading (Informed by Discovery)

Instead of blindly searching, the LLM now knows which files do what. It reads specific files that are relevant to the current task. No wasted tool calls, no irrelevant content.

### Tier 3 - Deep Queries (Optional MCP Server)

For complex questions, the LLM queries the MCP server for specific code units, pattern searches, dependency chains, or semantic search across the analysis data.

---

## Architecture

### Storage

- **SQLite** via `better-sqlite3`: single file, zero config, portable
- **Vector search**: `sqlite-vss` within the same SQLite database, behind a pluggable abstraction
- Everything lives in a single `.heury/analysis.db` file alongside the manifest files

### Embeddings

Pluggable provider interface with sensible defaults:

| Provider | Model | Size | Dimensions | Connectivity |
|----------|-------|------|------------|-------------|
| **Local (default)** | all-MiniLM-L6-v2 via ONNX Runtime | ~22MB | 384 | Fully offline |
| OpenAI | text-embedding-3-small | API-based | Configurable | Requires API key |
| Custom | Any provider via interface | Varies | Varies | Varies |

### Output: The `.heury/` Directory

All output lives in `.heury/` at the project root. This directory is **gitignored** and treated as generated artifacts.

| File | Purpose | Content |
|------|---------|---------|
| `modules.md` | Module/directory overview | High-level descriptions of what each module does |
| `patterns.md` | Detected patterns | API endpoints, DB operations, external services |
| `dependencies.md` | Import/export dependency graph | How modules relate to each other |
| `hotspots.md` | Complexity hotspots | Areas of high complexity needing attention |
| `analysis.db` | Full SQLite database | All analysis data, vectors, relationships |

**Token budget target**: ~5K tokens combined for the four markdown files. Enough detail for orientation, concise enough for a single context read.

### MCP Server

Both transports supported:

- **stdio (default)**: Zero configuration. Works with any MCP client that supports stdio.
- **HTTP (optional)**: For clients or workflows that need HTTP transport. Configurable port.

---

## Analysis Engine

Ported from Ludflow's proven analysis capabilities. Heuristic regex-based extraction (no AST parsing required).

### Capabilities

| Capability | Description |
|-----------|-------------|
| **Code Unit Extraction** | Functions, classes, methods, interfaces identified via heuristic regex |
| **Pattern Detection** | API endpoints, API calls, database operations, external services, env vars |
| **Complexity Scoring** | Conditionals, loops, nesting depth, async patterns, parameter count |
| **Dependency Graph** | Import/export relationships between files |
| **API Endpoint Discovery** | Route extraction from framework-specific patterns |

### Language Support

All six languages supported from day one, each with framework-specific pattern recognition:

| Language | Frameworks |
|----------|-----------|
| JavaScript / TypeScript | Express, Next.js, NestJS, Fastify |
| Python | FastAPI, Flask, Django |
| Go | net/http, Gin, Echo, gRPC |
| Java | Spring Boot, JAX-RS |
| Rust | Actix, Rocket, Axum |
| C# | ASP.NET, Entity Framework |

### Language Registry

New languages are added via the `LanguageExtractor` interface. The registry is extensible without modifying existing code (Open/Closed Principle).

---

## MCP Tool Suite

Simplified from Ludflow's 18 tools to a focused set for local codebase analysis:

### Discovery Tools

| Tool | Purpose |
|------|---------|
| `get_analysis_stats` | Overview statistics of the analyzed codebase |
| `get_module_overview` | Module descriptions and structure |
| `search_codebase` | Search across code units, patterns, and files |

### Code Structure Tools

| Tool | Purpose |
|------|---------|
| `get_code_units` | Retrieve functions, classes, methods for a file or module |
| `get_dependencies` | Query import/export relationships |
| `get_api_endpoints` | List discovered API endpoints with routes and methods |

### File Access Tools

| Tool | Purpose |
|------|---------|
| `get_file_content` | Read file content with analysis context |

### Semantic Search Tools

| Tool | Purpose |
|------|---------|
| `vector_search` | Semantic search across all analysis data |

### What Was Removed (Ludflow-specific)

Data governance, document management, folder management, and other multi-tenant features are not included. heury is a local tool with a focused scope.

---

## Analysis Trigger and Incremental Updates

### Trigger Mechanisms

| Trigger | Description |
|---------|-------------|
| **Git hooks (primary)** | post-commit and post-checkout hooks run incremental analysis automatically |
| **Manual CLI** | `npx heury analyze` for full analysis on demand |

### Incremental Analysis

Hybrid approach combining speed with accuracy:

- **On commit (automatic)**: File hash-based caching. Unchanged files are skipped. Dependency graph is updated only for affected files.
- **On manual trigger**: Full re-analysis of the entire codebase. Ensures consistency and catches anything incremental analysis may have missed.

---

## Configuration

Configuration lives in `heury.config.json` at the project root.

### Key Settings

```jsonc
{
  // File inclusion/exclusion
  "include": ["src/**", "lib/**"],
  "exclude": ["node_modules/**", "dist/**", "*.test.*"],

  // Language extractors to enable
  "languages": ["typescript", "python", "go"],

  // Embedding provider
  "embedding": {
    "provider": "local",       // "local" (default) or "openai"
    "apiKey": ""               // For API providers
  },

  // MCP server configuration
  "mcp": {
    "transport": "stdio",      // "stdio" (default) or "http"
    "port": 3111               // HTTP port when using http transport
  },

  // Output control
  "output": {
    "tokenBudget": 5000        // Target token count for manifest files
  },

  // Analysis behavior
  "analysis": {
    "incremental": true        // Enable/disable incremental analysis
  }
}
```

---

## Distribution

### Package

Published to npm as `heury`.

```bash
# Install as dev dependency
npm install -D heury

# Or initialize directly
npx heury init
```

### CLI Commands

| Command | Purpose |
|---------|---------|
| `npx heury init` | Initialize heury in a project. Creates config, sets up git hooks, creates `.heury/` directory. |
| `npx heury analyze` | Run full codebase analysis |
| `npx heury serve` | Start MCP server in HTTP mode |
| `npx heury watch` | Watch mode for continuous analysis (future) |

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20+ |
| Language | TypeScript (strict mode) |
| Database | SQLite via better-sqlite3 |
| Vector Search | sqlite-vss |
| Embeddings (local) | ONNX Runtime (all-MiniLM-L6-v2) |
| MCP SDK | @modelcontextprotocol/sdk |
| Testing | Vitest |
| Build | tsup or similar bundler |

---

## Development Methodology

### Principles

- **TDD (Test-Driven Development)**: Tests are written first, always. Red-Green-Refactor cycle governs all implementation.
- **SOLID Principles**: Applied throughout the codebase. Every class and module adheres to Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion.
- **Hexagonal Architecture (Ports & Adapters)**: Core domain logic is isolated from infrastructure. All external dependencies (SQLite, ONNX, filesystem, MCP transport) are accessed through ports with swappable adapters.

### Reference Materials

- `.claude/agent-context/reference/TDD-compact.md` - Quick TDD reference
- `.claude/agent-context/reference/SOLID-compact.md` - Quick SOLID reference
- `.claude/agent-context/reference/TDD.md` - Full TDD guide
- `.claude/agent-context/reference/SOLID.md` - Full SOLID guide

---

## Licensing

### License: Elastic License 2.0 (ELv2)

| Permission | Status |
|-----------|--------|
| Use freely | Allowed |
| Modify | Allowed |
| Distribute | Allowed |
| Offer as a managed service | **Not allowed** |
| Circumvent license protections | **Not allowed** |

### Contributor License Agreement (CLA)

Required for all contributions. Managed via CLA Assistant GitHub App.

- Grants the project maintainer a perpetual license to use contributions in any context, including Ludflow and other commercial products.
- The author retains full commercial rights for use in Ludflow and derivative works.

---

## Explicit Non-Goals

The following are **not in scope** for heury. They belong to Ludflow or other products:

- Multi-tenancy / organizations
- User authentication
- Web UI / frontend
- Document management
- Diagram generation
- Conversation / chat history
- Billing / subscriptions
- Data governance / Knowledge Dex
- Encryption / BYOK
- Background job orchestration
- Cloud deployment
