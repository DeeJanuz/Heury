# Architecture Decision Records (ADRs)

**Manually maintained by developers when making significant architectural decisions.**

This document records important architectural decisions, their context, and rationale.

---

## How to Use ADRs

When making a significant architectural decision:
1. Add a new entry below
2. Use the template format
3. Document context, decision, and consequences
4. Update status if decision is superseded

---

## ADR Template

```markdown
## ADR-XXX: [Decision Title]
**Date:** YYYY-MM-DD
**Status:** [Proposed | Accepted | Deprecated | Superseded by ADR-YYY]
**Deciders:** [Names or roles]

### Context
[What is the issue we're facing? What factors influence this decision?]

### Decision
[What did we decide? State clearly.]

### Rationale
[Why did we make this decision? What were the alternatives?]

### Consequences
**Positive:**
- [Good outcomes from this decision]

**Negative:**
- [Drawbacks or trade-offs]

**Neutral:**
- [Other changes or effects]
```

---

## Active Decisions

### ADR-001: Adopt Hexagonal Architecture (Ports & Adapters)
**Date:** 2026-02-26
**Status:** Accepted
**Deciders:** Architecture Team

#### Context
We need an architecture pattern that:
- Keeps business logic isolated from frameworks
- Makes code testable
- Allows swapping infrastructure components (storage backends, vector search providers)
- Supports SOLID principles
- Works well for a local-first tool that may run in different environments

#### Decision
Adopt Hexagonal Architecture (Ports & Adapters) pattern with:
- **Domain Layer:** Pure business logic, no dependencies
- **Application Layer:** Use cases coordinating domain objects
- **Adapter Layer:** Infrastructure implementations (storage, file system, vector search, etc.)
- **Dependency Inversion:** All dependencies point inward toward domain

#### Rationale
**Alternatives considered:**
1. **MVC** - Too coupled to web framework, hard to test business logic
2. **Clean Architecture** - Similar to Hexagonal but more layers, added complexity
3. **Transaction Script** - Too simple, doesn't scale as complexity grows

**Why Hexagonal:**
- Clear separation of concerns
- Domain layer is framework-agnostic
- Easy to test (mock at adapter boundaries)
- Critical for heury: allows swapping storage backends (SQLite, Redis, file-based) without touching business logic
- Aligns with SOLID principles (especially DIP)

#### Consequences
**Positive:**
- Business logic is pure and testable
- Easy to swap storage backends (SQLite for simple use, Redis for performance)
- Clear architectural boundaries
- Better separation of concerns

**Negative:**
- More initial boilerplate
- Steeper learning curve for new contributors
- More files and folders

**Neutral:**
- Need to document patterns clearly
- Contributors need onboarding on patterns

---

### ADR-002: Use TypeScript for Type Safety
**Date:** 2026-02-26
**Status:** Accepted
**Deciders:** Development Team

#### Context
We need strong type safety to:
- Catch errors at compile time
- Improve IDE autocomplete
- Document interfaces clearly
- Reduce runtime errors

#### Decision
Use TypeScript for all application code with strict mode enabled.

#### Rationale
**Alternatives:**
1. **JavaScript with JSDoc** - Types not enforced, easy to ignore
2. **Flow** - Less ecosystem support, smaller community

**Why TypeScript:**
- Industry standard
- Excellent IDE support
- Strong type checking
- Large ecosystem
- Interfaces document contracts

#### Consequences
**Positive:**
- Catch errors at compile time
- Better refactoring confidence
- Self-documenting code
- Improved developer experience

**Negative:**
- Build step required
- Longer initial development time
- Generic/complex types can be confusing

**Neutral:**
- Need to maintain tsconfig.json

---

### ADR-003: Test-Driven Development with Layer-Based Strategy
**Date:** 2026-02-26
**Status:** Accepted
**Deciders:** Development Team

#### Context
We need a testing strategy that:
- Ensures code quality
- Provides confidence for refactoring
- Aligns with Hexagonal Architecture
- Balances speed and coverage

#### Decision
Adopt TDD with layer-based testing:
- **Domain:** Pure unit tests (50% of tests)
- **Application:** Integration tests with mocked ports (30%)
- **Adapters:** Integration tests with real systems (15%)
- **E2E:** Critical path tests (5%)

#### Rationale
**Why layer-based:**
- Aligns with architecture boundaries
- Tests what matters (business logic heavily tested)
- Fast feedback (most tests are fast unit tests)
- Mock only at boundaries (more confidence)

**Alternatives considered:**
1. **Test Pyramid** - Good, but doesn't leverage DIP advantages
2. **All E2E** - Slow, hard to debug, brittle
3. **All Unit** - Misses integration issues

#### Consequences
**Positive:**
- Fast test suite (most tests are unit)
- High confidence from integration tests
- Clear testing strategy per layer
- Regression protection

**Negative:**
- Requires discipline to maintain
- Need test helpers (fakes, builders)
- Integration tests need test infrastructure

**Neutral:**
- TDD adds upfront time but saves debugging time

---

### ADR-004: Local-First Architecture with Lightweight Storage
**Date:** 2026-02-26
**Status:** Accepted
**Deciders:** Architecture Team

#### Context
Heury is a local-first codebase analysis tool. It needs to:
- Run entirely on a developer's machine without cloud dependencies
- Store analysis results efficiently
- Support vector search for semantic code queries
- Be fast to set up with minimal configuration

#### Decision
Use lightweight, local storage backends:
- **SQLite** as the primary relational store (via better-sqlite3 or similar)
- **Local vector search** via in-memory cosine similarity (pure JS, no native deps), upgradeable to hnswlib or sqlite-vss
- **File system** for caching and temporary data
- No cloud database dependencies (no Postgres, PlanetScale, etc.)

#### Rationale
**Alternatives considered:**
1. **PostgreSQL + pgvector** - Requires running a database server, too heavy for a local CLI tool
2. **Redis** - Good for caching but overkill for persistent storage in a local tool
3. **Pure file-based storage (JSON)** - Simple but poor query performance at scale

**Why SQLite + local vector search:**
- Zero-configuration: SQLite is embedded, no server needed
- Fast for read-heavy workloads (code analysis is mostly reads after initial analysis)
- Portable: single file database, easy to move or delete
- In-memory vector search works in-process with zero native dependencies
- Well-supported in Node.js ecosystem

#### Consequences
**Positive:**
- Zero infrastructure setup for users
- Fast startup and analysis
- Portable analysis results (single SQLite file)
- No network dependencies

**Negative:**
- No concurrent write access (SQLite limitation, acceptable for single-user tool)
- In-memory vector search has O(n) complexity; may need indexing (hnswlib/sqlite-vss) for large codebases
- Limited to single-machine use

**Neutral:**
- Hexagonal architecture allows swapping to a remote database later if needed
- May need to benchmark vector search options during implementation

---

## Superseded Decisions

<!-- Deprecated or superseded decisions are moved here -->

---

## Decision Status Definitions

- **Proposed:** Under discussion, not yet decided
- **Accepted:** Decision made and being implemented
- **Deprecated:** No longer relevant, but kept for historical context
- **Superseded:** Replaced by a newer decision (link to new ADR)

---

## Changelog

| Date | ADR | Change | Author |
|------|-----|--------|--------|
| 2026-02-26 | ADR-001 | Initial: Hexagonal Architecture | System |
| 2026-02-26 | ADR-002 | Initial: TypeScript adoption | System |
| 2026-02-26 | ADR-003 | Initial: TDD strategy | System |
| 2026-02-26 | ADR-004 | Initial: Local-first storage | System |
| 2026-02-27 | ADR-004 | Updated: Reflect in-memory vector search implementation | System |
