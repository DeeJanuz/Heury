/**
 * Rust Language Extractor
 *
 * Extracts code units, dependencies, and patterns from Rust source files.
 * Implements the LanguageExtractor interface for the multi-language registry.
 *
 * Detects:
 * - Functions: fn name(params) -> ReturnType {
 * - Pub/async functions: pub fn, async fn, pub async fn
 * - Structs: struct S { ... }
 * - Enums: enum E { ... }
 * - Traits: trait T { ... } (mapped to INTERFACE)
 * - Impl blocks: impl S { ... }, impl T for S { ... }
 * - Methods: fn inside impl blocks
 *
 * Dependencies:
 * - use std::collections::HashMap;
 * - use std::io::{Read, Write};
 * - use crate::module;
 * - mod submodule;
 * - extern crate name;
 *
 * Patterns:
 * - API endpoints: Actix, Axum
 * - Database: Diesel, SQLx, tokio-postgres
 * - Env variables: std::env::var, dotenv::var
 */

import { CodeUnitType, PatternType, ImportType } from '@/domain/models/index.js';

import type { LanguageExtractor } from '../language-registry.js';
import type {
  CodeUnitDeclaration,
  FileDependencyInfo,
  PatternRuleSet,
  LanguageComplexityPatterns,
} from '../types.js';
import { findBlockEnd, getLineNumber, isInsideStringOrComment } from '../shared/block-finder.js';
import {
  SQL_READ_PATTERNS,
  SQL_WRITE_PATTERNS,
  EXTERNAL_SERVICE_PATTERNS,
} from '../shared/pattern-rules-shared.js';

/**
 * Comment syntax for Rust
 */
const RUST_COMMENT_SYNTAX = {
  lineComment: '//',
  blockCommentStart: '/*',
  blockCommentEnd: '*/',
};

/**
 * Rust reserved keywords
 */
const RUST_KEYWORDS = new Set([
  'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern',
  'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match',
  'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static',
  'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where',
  'while', 'async', 'await', 'dyn', 'abstract', 'become', 'box', 'do',
  'final', 'macro', 'override', 'priv', 'try', 'typeof', 'unsized',
  'virtual', 'yield',
]);

/**
 * Track an impl block's target type and location for method extraction.
 */
interface ImplBlockInfo {
  readonly targetType: string;
  readonly startIndex: number;
  readonly lineStart: number;
  readonly lineEnd: number;
}

/**
 * Language extractor for Rust files.
 */
export class RustExtractor implements LanguageExtractor {
  readonly languageId = 'rust';
  readonly extensions = ['.rs'];

  extractCodeUnits(content: string, _filePath: string): CodeUnitDeclaration[] {
    const units: CodeUnitDeclaration[] = [];
    const seenUnits = new Set<string>();

    // Collect impl blocks first so we can identify methods inside them
    const implBlocks: ImplBlockInfo[] = [];

    // Pattern 1: impl Trait for Type {
    const implForPattern = /\bimpl\s*(?:<[^>]*>\s*)?(\w+)\s+for\s+(\w+)\s*[{]/g;
    // Pattern 2: impl Type { (but not "impl Trait for Type")
    const implDirectPattern = /\bimpl\s*(?:<[^>]*>\s*)?(\w+)\s*[{]/g;

    let match;

    // First pass: impl Trait for Type
    while ((match = implForPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, RUST_COMMENT_SYNTAX)) continue;

      const traitName = match[1];
      const forType = match[2];
      const implName = `impl ${traitName} for ${forType}`;

      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);

      const unitKey = `impl:${implName}:${lineStart}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      units.push({
        name: implName,
        unitType: CodeUnitType.IMPL_BLOCK,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported: false,
      });

      implBlocks.push({
        targetType: forType,
        startIndex: match.index,
        lineStart,
        lineEnd,
      });
    }

    // Second pass: impl Type (skip those already matched as "impl Trait for Type")
    while ((match = implDirectPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, RUST_COMMENT_SYNTAX)) continue;

      const lineStart = getLineNumber(content, match.index);
      const alreadyCaptured = implBlocks.some(b => b.lineStart === lineStart);
      if (alreadyCaptured) continue;

      // Skip if this is an impl-for we may have missed
      const matchText = content.slice(match.index, match.index + match[0].length + 50);
      if (/\bimpl\s+\w+\s+for\s/.test(matchText)) continue;

      const typeName = match[1];
      const implName = `impl ${typeName}`;

      const lineEnd = findBlockEnd(content, match.index);

      const unitKey = `impl:${implName}:${lineStart}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      units.push({
        name: implName,
        unitType: CodeUnitType.IMPL_BLOCK,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported: false,
      });

      implBlocks.push({
        targetType: typeName,
        startIndex: match.index,
        lineStart,
        lineEnd,
      });
    }

    // Extract functions (standalone and methods inside impl blocks)
    const funcPattern = /\bfn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?:->\s*([^{]+?))?\s*\{/g;

    while ((match = funcPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, RUST_COMMENT_SYNTAX)) continue;

      const name = match[1];
      if (RUST_KEYWORDS.has(name)) continue;

      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);

      // Check if this function is inside an impl block
      const containingImpl = implBlocks.find(
        impl => lineStart >= impl.lineStart && lineEnd <= impl.lineEnd
      );

      // Look at the prefix before "fn" to detect pub/async
      const lineStartIdx = content.lastIndexOf('\n', match.index) + 1;
      const prefix = content.slice(lineStartIdx, match.index);
      const isPub = /\bpub\b/.test(prefix);
      const isAsync = /\basync\b/.test(prefix);

      const params = match[2]?.trim() || '';
      const returnType = match[3]?.trim() || '';

      let signature = `(${params})`;
      if (returnType) {
        signature += ` -> ${returnType}`;
      }

      if (containingImpl) {
        const unitKey = `method:${containingImpl.targetType}.${name}`;
        if (seenUnits.has(unitKey)) continue;
        seenUnits.add(unitKey);

        units.push({
          name,
          unitType: CodeUnitType.METHOD,
          lineStart,
          lineEnd,
          signature,
          isAsync,
          isExported: isPub,
        });
      } else {
        const unitKey = `function:${name}`;
        if (seenUnits.has(unitKey)) continue;
        seenUnits.add(unitKey);

        units.push({
          name,
          unitType: CodeUnitType.FUNCTION,
          lineStart,
          lineEnd,
          signature,
          isAsync,
          isExported: isPub,
        });
      }
    }

    // Extract struct declarations
    const structPattern = /\bstruct\s+(\w+)(?:<[^>]*>)?\s*[({;]/g;

    while ((match = structPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, RUST_COMMENT_SYNTAX)) continue;

      const name = match[1];
      if (RUST_KEYWORDS.has(name)) continue;

      const unitKey = `struct:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStartIdx = content.lastIndexOf('\n', match.index) + 1;
      const prefix = content.slice(lineStartIdx, match.index);
      const isPub = /\bpub\b/.test(prefix);
      const lineStart = getLineNumber(content, match.index);

      const fullMatch = match[0];
      const lastChar = fullMatch[fullMatch.length - 1];
      const lineEnd = lastChar === '{' ? findBlockEnd(content, match.index) : lineStart;

      units.push({
        name,
        unitType: CodeUnitType.STRUCT,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported: isPub,
      });
    }

    // Extract enum declarations
    const enumPattern = /\benum\s+(\w+)(?:<[^>]*>)?\s*\{/g;

    while ((match = enumPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, RUST_COMMENT_SYNTAX)) continue;

      const name = match[1];
      if (RUST_KEYWORDS.has(name)) continue;

      const unitKey = `enum:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStartIdx = content.lastIndexOf('\n', match.index) + 1;
      const prefix = content.slice(lineStartIdx, match.index);
      const isPub = /\bpub\b/.test(prefix);
      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);

      units.push({
        name,
        unitType: CodeUnitType.ENUM,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported: isPub,
      });
    }

    // Extract trait declarations (mapped to INTERFACE)
    const traitPattern = /\btrait\s+(\w+)(?:<[^>]*>)?\s*(?::[^{]*)?\{/g;

    while ((match = traitPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, RUST_COMMENT_SYNTAX)) continue;

      const name = match[1];
      if (RUST_KEYWORDS.has(name)) continue;

      const unitKey = `trait:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStartIdx = content.lastIndexOf('\n', match.index) + 1;
      const prefix = content.slice(lineStartIdx, match.index);
      const isPub = /\bpub\b/.test(prefix);
      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);

      units.push({
        name,
        unitType: CodeUnitType.INTERFACE,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported: isPub,
      });
    }

    // Sort by line number
    units.sort((a, b) => a.lineStart - b.lineStart);

    return units;
  }

  extractDependencies(content: string, _filePath: string): FileDependencyInfo[] {
    const dependencies: FileDependencyInfo[] = [];
    const seenDeps = new Set<string>();

    let match;

    // use path::to::item;
    // use path::to::{Item1, Item2};
    // use path::to::*;
    const usePattern = /\buse\s+([\w:]+(?:<[^>]*>)?)\s*(?:::\s*\{([^}]+)\}|::\s*(\*))?\s*;/g;

    while ((match = usePattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, RUST_COMMENT_SYNTAX)) continue;

      const basePath = match[1];
      const namedImports = match[2];
      const wildcard = match[3];

      if (wildcard) {
        const key = `${basePath}::*`;
        if (seenDeps.has(key)) continue;
        seenDeps.add(key);

        dependencies.push({
          targetFile: basePath,
          importType: ImportType.WILDCARD,
          importedNames: ['*'],
        });
      } else if (namedImports) {
        const names = namedImports.split(',').map(n => n.trim()).filter(Boolean);

        const key = `${basePath}::{${names.sort().join(',')}}`;
        if (seenDeps.has(key)) continue;
        seenDeps.add(key);

        dependencies.push({
          targetFile: basePath,
          importType: ImportType.NAMED,
          importedNames: names,
        });
      } else {
        const segments = basePath.split('::');
        const importedName = segments[segments.length - 1];
        const targetPath = segments.length > 1 ? segments.slice(0, -1).join('::') : basePath;

        const key = basePath;
        if (seenDeps.has(key)) continue;
        seenDeps.add(key);

        dependencies.push({
          targetFile: targetPath,
          importType: ImportType.NAMED,
          importedNames: [importedName],
        });
      }
    }

    // mod submodule; (module declaration, not mod { ... } block)
    const modPattern = /\bmod\s+(\w+)\s*;/g;
    while ((match = modPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, RUST_COMMENT_SYNTAX)) continue;

      const moduleName = match[1];
      const key = `mod:${moduleName}`;
      if (seenDeps.has(key)) continue;
      seenDeps.add(key);

      dependencies.push({
        targetFile: moduleName,
        importType: ImportType.MODULE,
        importedNames: [moduleName],
      });
    }

    // extern crate name;
    const externCratePattern = /\bextern\s+crate\s+(\w+)\s*;/g;
    while ((match = externCratePattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, RUST_COMMENT_SYNTAX)) continue;

      const crateName = match[1];
      const key = `extern:${crateName}`;
      if (seenDeps.has(key)) continue;
      seenDeps.add(key);

      dependencies.push({
        targetFile: crateName,
        importType: ImportType.MODULE,
        importedNames: [crateName],
      });
    }

    return dependencies;
  }

  getComplexityPatterns(): LanguageComplexityPatterns {
    return {
      conditionals: [
        /\bif\s/g,
        /\belse\s+if\s/g,
        /\belse\s*\{/g,
        /\bmatch\s*\{/g,
        /\bif\s+let\s/g,
      ],
      loops: [
        /\bfor\s+\w+\s+in\s/g,
        /\bwhile\s/g,
        /\bwhile\s+let\s/g,
        /\bloop\s*\{/g,
      ],
      errorHandling: [
        /\?;/g,
        /\.unwrap\(\)/g,
        /\.expect\s*\(/g,
      ],
      asyncPatterns: [
        /\basync\s+fn/g,
        /\.await\b/g,
        /tokio::spawn/g,
      ],
    };
  }

  getPatternRules(): PatternRuleSet {
    return {
      apiEndpoints: [
        // Actix: #[get("/path")], #[post("/path")]
        {
          pattern: /#\[(get|post|put|patch|delete)\s*\(\s*"([^"]+)"\s*\)\]/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => `${match[1].toUpperCase()} ${match[2]}`,
        },
        // Axum: Router::new().route("/path", get(handler))
        {
          pattern: /\.route\s*\(\s*"([^"]+)"\s*,\s*(get|post|put|patch|delete)\s*\(/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => `${match[2].toUpperCase()} ${match[1]}`,
        },
        // Actix web::resource/scope
        {
          pattern: /web::(resource|scope)\s*\(\s*"([^"]+)"/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => `${match[1].toUpperCase()} ${match[2]}`,
        },
      ],
      apiCalls: [
        {
          pattern: /reqwest::(get|post|put|patch|delete)\s*\(\s*"([^"]+)"/g,
          patternType: PatternType.API_CALL,
          extractValue: (match) => `${match[1].toUpperCase()} ${match[2]}`,
        },
      ],
      databaseReads: [
        // Diesel: .select, .filter, .load
        {
          pattern: /\.(?:select|filter|load|first|get_result|get_results)\s*[:(]/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: () => 'diesel.query',
        },
        // SQLx: sqlx::query
        {
          pattern: /sqlx::query(?:_as|_scalar)?[!\s]*[([]/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: () => 'sqlx.query',
        },
        // tokio-postgres: client.query
        {
          pattern: /client\.query\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: () => 'postgres.query',
        },
        // Shared SQL read patterns
        ...SQL_READ_PATTERNS.map((r) => ({
          pattern: r.pattern,
          patternType: PatternType.DATABASE_READ,
          value: r.value,
        })),
      ],
      databaseWrites: [
        // Diesel: diesel::insert_into, diesel::update, diesel::delete
        {
          pattern: /diesel::(?:insert_into|update|delete)\s*\(/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: () => 'diesel.write',
        },
        // SQLx with INSERT/UPDATE/DELETE in query string
        {
          pattern: /sqlx::query.*(?:INSERT|UPDATE|DELETE)/gi,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: () => 'sqlx.write',
        },
        // tokio-postgres: client.execute
        {
          pattern: /client\.execute\s*\(/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: () => 'postgres.execute',
        },
        // Shared SQL write patterns
        ...SQL_WRITE_PATTERNS.map((r) => ({
          pattern: r.pattern,
          patternType: PatternType.DATABASE_WRITE,
          value: r.value,
        })),
      ],
      externalServices: [
        ...EXTERNAL_SERVICE_PATTERNS.map((r) => ({
          pattern: r.pattern,
          patternType: PatternType.EXTERNAL_SERVICE,
          value: r.value,
        })),
      ],
      envVariables: [
        // std::env::var("VAR") or env::var("VAR")
        {
          pattern: /(?:std::)?env::var\s*\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
        // dotenv::var("VAR")
        {
          pattern: /dotenv::var\s*\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
      ],
    };
  }

  getSkipDirectories(): string[] {
    return ['target'];
  }

  getTestFilePatterns(): RegExp[] {
    return [/tests\//, /_test\.rs$/];
  }
}
