# MCP Discovery Benchmark Results

Compared three agent approaches across two codebases and two development stages.

**Approaches:** Traditional (Glob/Grep/Read only), Hybrid v1 (MCP without source), Hybrid v2 (MCP with `include_source: true`)

**Codebases:** Ludflow (clean, SOLID, hexagonal architecture) and Inbox Zero (organic growth, scattered patterns)

**Feature planned/implemented:** Tiered API rate limiting (per-user, sliding window, primary+fallback stores)

## Planning Benchmarks

### Ludflow (clean codebase, 4,682 code units)

| Metric | MCP Only | Traditional | Hybrid v1 | Hybrid v2 |
|--------|----------|-------------|-----------|-----------|
| Tokens | 135,373 | 114,171 | 113,495 | 78,802 |
| Tool calls | 91 | 97 | 54 | 34 |
| Wall time | 582s | 366s | 274s | 220s |

- MCP-only missed Edge Runtime constraint, found 4/6 rate limiters (worst quality)
- Traditional found all 6, correct architecture
- Hybrid v1 best of both — MCP orientation + targeted reads
- Hybrid v2 (with `include_source`) matched traditional quality, no efficiency gain for planning on clean codebases

### Inbox Zero (messy codebase, 3,823 code units)

| Metric | Traditional | Hybrid v2 |
|--------|-------------|-----------|
| Tokens | 111,769 | 96,923 (-13%) |
| Tool calls | 45 | 43 |
| Wall time | 225s | 235s |

- Traditional needed 44% more tokens on messy vs clean codebase
- Hybrid v2 needed only 23% more — structural analysis scales better than text search
- Traditional found 14 rate-limit implementations; Hybrid found 11 (missed 3 minor ones)
- Hybrid found API key auth integration path that Traditional missed

## Implementation Benchmarks (Ludflow only)

| Metric | Traditional | Hybrid v1 | Hybrid v2 |
|--------|-------------|-----------|-----------|
| Tokens | 76,425 | 90,403 | **48,157** |
| Tool calls | 65 | 59 | **39** |
| Wall time | 849s | 903s | **398s** |
| Tests passing | 50/50 | 36/36 | 45/45 |

Hybrid v2 vs Traditional: **37% fewer tokens, 40% fewer calls, 53% faster**

### Code quality comparison

| Aspect | Traditional | Hybrid v1 | Hybrid v2 |
|--------|-------------|-----------|-----------|
| DI pattern | Class constructors | Class constructors | Factory closures (matches codebase) |
| Store interface | Returns full result | Returns full result | Returns count only (cleaner SoC) |
| Fail-open | Throws on both-store failure | Explicit fail-open | Fail-open at every layer |
| Framework types | Raw `Response` | Raw `Response` | `NextRequest`/`NextResponse` |
| Guard contract | Optional fields object | Discriminated union | `NextResponse \| null` |

Hybrid v2 produced the most codebase-idiomatic implementation — `include_source` returned the actual `createRateLimiter()` factory pattern, so the agent replicated it.

## Key Findings

1. **`include_source` is the critical feature.** Without it, MCP is an indirection layer (search → metadata → read file anyway). With it, one MCP call replaces search+read cycles.

2. **MCP value scales with codebase messiness.** Clean codebases are predictable for text search. Scattered codebases benefit from structural analysis — 13% token savings on planning in messy vs negligible in clean.

3. **MCP is an implementation accelerator, not a planning accelerator (on clean codebases).** Planning requires deep reading regardless of approach. Implementation benefits from quick reference lookups where `include_source` eliminates follow-up reads.

4. **Hybrid always beats MCP-only.** MCP provides orientation; traditional tools provide precision. Neither alone is optimal.

## What would increase MCP value further

- **Dependency-aware navigation:** `get-dependents`/`get-dependencies` for reverse lookups (what imports X?)
- **Pattern validation:** Post-write checks against codebase conventions
- **Implementation context bundles:** Single call returning interfaces, imports, patterns, test conventions
- **Test scaffolding hints:** How similar features are tested in this codebase

## Methodology

- All agents ran on Claude Opus 4.6
- Ludflow implementation used isolated git worktrees (`/tmp/ludflow-traditional`, `/tmp/ludflow-hybrid`)
- MCP invoked via subprocess helper (`node heury-query.js <tool> '<args>'`) — persistent MCP connection would reduce overhead
- heury analysis DB pre-built before benchmarks
