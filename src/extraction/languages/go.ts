/**
 * Go Language Extractor
 *
 * Extracts code units, dependencies, and patterns from Go source files.
 * Implements the LanguageExtractor interface for the multi-language registry.
 *
 * Detects:
 * - Functions: func name(params) returnType {
 * - Methods: func (r *Type) name(params) returnType {
 * - Structs: type S struct {
 * - Interfaces: type I interface {
 *
 * Dependencies:
 * - Single import: import "fmt"
 * - Grouped imports: import ("fmt" "net/http")
 * - Aliased: import alias "path/to/pkg"
 *
 * Patterns:
 * - API endpoints: Gin, Echo, Fiber, Chi, net/http
 * - Database: database/sql, GORM
 * - Env variables: os.Getenv, os.LookupEnv
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
 * Comment syntax for Go
 */
const GO_COMMENT_SYNTAX = {
  lineComment: '//',
  blockCommentStart: '/*',
  blockCommentEnd: '*/',
};

/**
 * Go reserved keywords
 */
const GO_KEYWORDS = new Set([
  'break', 'case', 'chan', 'const', 'continue',
  'default', 'defer', 'else', 'fallthrough', 'for',
  'func', 'go', 'goto', 'if', 'import',
  'interface', 'map', 'package', 'range', 'return',
  'select', 'struct', 'switch', 'type', 'var',
]);

/**
 * Language extractor for Go files.
 */
export class GoExtractor implements LanguageExtractor {
  readonly languageId = 'go';
  readonly extensions = ['.go'];

  extractCodeUnits(content: string, _filePath: string): CodeUnitDeclaration[] {
    const units: CodeUnitDeclaration[] = [];
    const seenUnits = new Set<string>();

    // Extract functions and methods
    // Pattern: func name(params) returnType {
    // Pattern: func (r *Type) name(params) returnType {
    const funcPattern =
      /func\s+(?:\((\w+)\s+\*?(\w+)\)\s+)?(\w+)\s*\(([^)]*)\)\s*(\([^)]*\)|[^{\n]*)?\s*\{/g;

    let match;
    while ((match = funcPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, GO_COMMENT_SYNTAX)) continue;

      const receiverType = match[2];
      const name = match[3];
      const params = match[4]?.trim() || '';
      const returnType = match[5]?.trim() || '';

      if (GO_KEYWORDS.has(name)) continue;

      const isMethod = !!receiverType;
      const unitKey = isMethod ? `method:${receiverType}.${name}` : `function:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);
      const isExported = name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase();

      let signature = `(${params})`;
      if (returnType) {
        signature += ` ${returnType}`;
      }

      units.push({
        name,
        unitType: isMethod ? CodeUnitType.METHOD : CodeUnitType.FUNCTION,
        lineStart,
        lineEnd,
        signature,
        isAsync: false,
        isExported,
      });
    }

    // Extract struct declarations: type Name struct {
    const structPattern = /\btype\s+(\w+)\s+struct\s*\{/g;
    while ((match = structPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, GO_COMMENT_SYNTAX)) continue;

      const name = match[1];
      const unitKey = `struct:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);
      const isExported = name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase();

      units.push({
        name,
        unitType: CodeUnitType.STRUCT,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported,
      });
    }

    // Extract interface declarations: type Name interface {
    const interfacePattern = /\btype\s+(\w+)\s+interface\s*\{/g;
    while ((match = interfacePattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, GO_COMMENT_SYNTAX)) continue;

      const name = match[1];
      const unitKey = `interface:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);
      const isExported = name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase();

      units.push({
        name,
        unitType: CodeUnitType.INTERFACE,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported,
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

    // Single import: import "pkg" or import alias "pkg"
    const singleImportPattern = /\bimport\s+(?:(\w+|\.)\s+)?"([^"]+)"/g;

    while ((match = singleImportPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, GO_COMMENT_SYNTAX)) continue;

      // Check if this is inside a grouped import block
      const priorContent = content.slice(0, match.index);
      const lastImportParen = priorContent.lastIndexOf('import (');
      const lastCloseParen = priorContent.lastIndexOf(')');
      if (lastImportParen > -1 && lastImportParen > lastCloseParen) {
        continue;
      }

      const alias = match[1] || null;
      const importPath = match[2];

      const key = importPath;
      if (seenDeps.has(key)) continue;
      seenDeps.add(key);

      dependencies.push({
        targetFile: importPath,
        importType: ImportType.PACKAGE,
        importedNames: alias ? [alias] : [],
      });
    }

    // Grouped imports: import (\n  "pkg1"\n  alias "pkg2"\n)
    const groupedImportPattern = /\bimport\s*\(([\s\S]*?)\)/g;
    while ((match = groupedImportPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, GO_COMMENT_SYNTAX)) continue;

      const block = match[1];
      const linePattern = /(?:(\w+|\.)\s+)?"([^"]+)"/g;
      let lineMatch;
      while ((lineMatch = linePattern.exec(block)) !== null) {
        const alias = lineMatch[1] || null;
        const importPath = lineMatch[2];

        const key = importPath;
        if (seenDeps.has(key)) continue;
        seenDeps.add(key);

        dependencies.push({
          targetFile: importPath,
          importType: ImportType.PACKAGE,
          importedNames: alias ? [alias] : [],
        });
      }
    }

    return dependencies;
  }

  getComplexityPatterns(): LanguageComplexityPatterns {
    return {
      conditionals: [
        /\bif\s/g,
        /\belse\s/g,
        /\bswitch\s/g,
        /\bcase\s/g,
      ],
      loops: [
        /\bfor\s/g,
        /\brange\s/g,
      ],
      errorHandling: [
        /\bif\s+err\s*!=\s*nil/g,
        /\bdefer\s/g,
      ],
      asyncPatterns: [
        /\bgo\s+func/g,
        /\bgo\s+\w/g,
      ],
    };
  }

  getPatternRules(): PatternRuleSet {
    return {
      apiEndpoints: [
        // Gin: r.GET("/path", handler), router.POST("/path", handler)
        {
          pattern: /(?:r|router|group|api|v1)\.(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(\s*"([^"]+)"/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => `${match[1]} ${match[2]}`,
        },
        // Echo: e.GET("/path", handler)
        {
          pattern: /(?:e|echo|g|group)\.(GET|POST|PUT|PATCH|DELETE)\s*\(\s*"([^"]+)"/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => `${match[1]} ${match[2]}`,
        },
        // Fiber / Chi: app.Get("/path", handler)
        {
          pattern: /\b(?:app|fiber|r|router|mux)\.(Get|Post|Put|Patch|Delete)\s*\(\s*"([^"]+)"/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => `${match[1].toUpperCase()} ${match[2]}`,
        },
        // net/http: http.HandleFunc("/path", handler)
        {
          pattern: /http\.HandleFunc\s*\(\s*"([^"]+)"/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => `HANDLE ${match[1]}`,
        },
        // Go 1.22+ stdlib: mux.HandleFunc("GET /path", handler)
        {
          pattern: /\.HandleFunc\s*\(\s*"(GET|POST|PUT|PATCH|DELETE)\s+([^"]+)"/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => `${match[1]} ${match[2]}`,
        },
      ],
      apiCalls: [
        {
          pattern: /http\.(Get|Post|Head)\s*\(\s*"([^"]+)"/g,
          patternType: PatternType.API_CALL,
          extractValue: (match) => `${match[1].toUpperCase()} ${match[2]}`,
        },
        {
          pattern: /http\.NewRequest\s*\(\s*"(\w+)"\s*,\s*"([^"]+)"/g,
          patternType: PatternType.API_CALL,
          extractValue: (match) => `${match[1]} ${match[2]}`,
        },
      ],
      databaseReads: [
        // database/sql: db.Query, db.QueryRow
        {
          pattern: /\bdb\.(?:Query|QueryRow|QueryContext|QueryRowContext)\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: () => 'sql.Query',
        },
        // GORM: db.Find, db.First, db.Last, etc.
        {
          pattern: /\bdb\.(?:Find|First|Last|Take|Scan|Pluck|Count)\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: () => 'GORM query',
        },
        // GORM Where clause
        {
          pattern: /\bdb\.Where\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: () => 'GORM Where',
        },
        // Shared SQL read patterns
        ...SQL_READ_PATTERNS.map((r) => ({
          pattern: r.pattern,
          patternType: PatternType.DATABASE_READ,
          value: r.value,
        })),
      ],
      databaseWrites: [
        // database/sql: db.Exec, db.ExecContext
        {
          pattern: /\bdb\.(?:Exec|ExecContext)\s*\(/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: () => 'sql.Exec',
        },
        // GORM: db.Create, db.Save, db.Update, db.Delete
        {
          pattern: /\bdb\.(?:Create|Save|Update|Updates|Delete|Unscoped)\s*\(/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: () => 'GORM write',
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
        // os.Getenv("VAR")
        {
          pattern: /os\.Getenv\s*\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
        // os.LookupEnv("VAR")
        {
          pattern: /os\.LookupEnv\s*\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
      ],
    };
  }

  getSkipDirectories(): string[] {
    return ['vendor'];
  }

  getTestFilePatterns(): RegExp[] {
    return [/_test\.go$/];
  }
}
