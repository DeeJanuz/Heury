/**
 * C# Language Extractor
 *
 * Extracts code units, dependencies, and patterns from C# source files.
 * Implements the LanguageExtractor interface for the multi-language registry.
 *
 * Detects:
 * - Classes: class Name { with modifiers
 * - Structs: struct Name {
 * - Interfaces: interface IName {
 * - Enums: enum Name {
 * - Records: record Name(params) or record class Name { (treated as CLASS)
 * - Methods: public ReturnType Name(params) { as children
 * - Constructors: ClassName(params) {
 *
 * Dependencies:
 * - using Namespace;
 * - using static Namespace.Type;
 * - using Alias = Namespace.Type;
 * - global using Namespace;
 *
 * Patterns:
 * - API endpoints: ASP.NET attributes, Minimal API
 * - Database: Entity Framework Core
 * - Env variables: Environment.GetEnvironmentVariable, IConfiguration
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
 * Comment syntax for C#
 */
const CSHARP_COMMENT_SYNTAX = {
  lineComment: '//',
  blockCommentStart: '/*',
  blockCommentEnd: '*/',
};

/**
 * C# reserved keywords
 */
const CSHARP_KEYWORDS = new Set([
  'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch',
  'char', 'checked', 'class', 'const', 'continue', 'decimal', 'default',
  'delegate', 'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern',
  'false', 'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if',
  'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock', 'long',
  'namespace', 'new', 'null', 'object', 'operator', 'out', 'override',
  'params', 'private', 'protected', 'public', 'readonly', 'ref', 'return',
  'sbyte', 'sealed', 'short', 'sizeof', 'stackalloc', 'static', 'string',
  'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'uint',
  'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void',
  'volatile', 'while', 'var', 'record', 'async', 'await', 'dynamic',
  'nameof', 'when', 'yield',
]);

/**
 * Language extractor for C# files.
 */
export class CSharpExtractor implements LanguageExtractor {
  readonly languageId = 'csharp';
  readonly extensions = ['.cs'];

  extractCodeUnits(content: string, _filePath: string): CodeUnitDeclaration[] {
    const units: CodeUnitDeclaration[] = [];
    const seenUnits = new Set<string>();

    // Track class/struct/interface names for constructor detection and parentName
    const typeDeclarations: Array<{ name: string; lineStart: number; lineEnd: number }> = [];

    // Extract class declarations
    const classPattern =
      /(?:(?:public|private|protected|internal|static|abstract|sealed|partial|new)\s+)*class\s+(\w+)(?:<[^>]*>)?(?:\s*:\s*[^{]+)?\s*\{/g;

    let match;
    while ((match = classPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, CSHARP_COMMENT_SYNTAX)) continue;

      const name = match[1];
      const unitKey = `class:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);
      const isExported = match[0].includes('public');

      typeDeclarations.push({ name, lineStart, lineEnd });

      units.push({
        name,
        unitType: CodeUnitType.CLASS,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported,
      });
    }

    // Extract record declarations (treated as CLASS)
    const recordPattern =
      /(?:(?:public|private|protected|internal|static|abstract|sealed|partial)\s+)*record\s+(?:class\s+|struct\s+)?(\w+)(?:<[^>]*>)?(?:\s*\([^)]*\))?(?:\s*:\s*[^{;]+)?(?:\s*[{;])/g;

    while ((match = recordPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, CSHARP_COMMENT_SYNTAX)) continue;

      const name = match[1];
      const unitKey = `record:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStart = getLineNumber(content, match.index);
      const fullMatch = match[0];
      const lineEnd = fullMatch.endsWith('{')
        ? findBlockEnd(content, match.index)
        : lineStart;
      const isExported = fullMatch.includes('public');

      typeDeclarations.push({ name, lineStart, lineEnd });

      units.push({
        name,
        unitType: CodeUnitType.CLASS,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported,
      });
    }

    // Extract struct declarations
    const structPattern =
      /(?:(?:public|private|protected|internal|readonly|partial|ref)\s+)*struct\s+(\w+)(?:<[^>]*>)?(?:\s*:\s*[^{]+)?\s*\{/g;

    while ((match = structPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, CSHARP_COMMENT_SYNTAX)) continue;

      const name = match[1];
      const unitKey = `struct:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);
      const isExported = match[0].includes('public');

      typeDeclarations.push({ name, lineStart, lineEnd });

      units.push({
        name,
        unitType: CodeUnitType.STRUCT,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported,
      });
    }

    // Extract interface declarations
    const interfacePattern =
      /(?:(?:public|private|protected|internal|partial)\s+)*interface\s+(\w+)(?:<[^>]*>)?(?:\s*:\s*[^{]+)?\s*\{/g;

    while ((match = interfacePattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, CSHARP_COMMENT_SYNTAX)) continue;

      const name = match[1];
      const unitKey = `interface:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);
      const isExported = match[0].includes('public');

      typeDeclarations.push({ name, lineStart, lineEnd });

      units.push({
        name,
        unitType: CodeUnitType.INTERFACE,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported,
      });
    }

    // Extract enum declarations
    const enumPattern =
      /(?:(?:public|private|protected|internal)\s+)*enum\s+(\w+)(?:\s*:\s*\w+)?\s*\{/g;

    while ((match = enumPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, CSHARP_COMMENT_SYNTAX)) continue;

      const name = match[1];
      const unitKey = `enum:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);
      const isExported = match[0].includes('public');

      units.push({
        name,
        unitType: CodeUnitType.ENUM,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported,
      });
    }

    // Extract methods (including constructors)
    const methodPattern =
      /(?:^|\n)\s*(?:((?:(?:public|private|protected|internal|static|abstract|virtual|override|sealed|async|extern|new|readonly|unsafe|volatile|partial)\s+)*))(?:(\w[\w<>[\],\s?]*?)\s+)?(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?:(?:where\s+\w+\s*:[^{]*?)?\s*)\{/g;

    while ((match = methodPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, CSHARP_COMMENT_SYNTAX)) continue;

      const modifiers = match[1]?.trim() || '';
      const returnType = match[2]?.trim() || '';
      const name = match[3];
      const params = match[4]?.trim() || '';

      // Skip if name is a reserved keyword (except type names which can be constructors)
      if (CSHARP_KEYWORDS.has(name) && !typeDeclarations.some(t => t.name === name)) continue;

      // Skip property accessors
      if (name === 'get' || name === 'set' || name === 'init' || name === 'add' || name === 'remove') continue;

      // Check if constructor
      const isConstructor = !returnType && typeDeclarations.some(t => t.name === name);

      // Need modifiers or return type to distinguish from other constructs
      if (!isConstructor && !modifiers && !returnType) continue;

      // Determine parent type
      const adjustedIndex = content[match.index] === '\n' ? match.index + 1 : match.index;
      const lineStart = getLineNumber(content, adjustedIndex);
      const parentType = this.findParentType(lineStart, typeDeclarations);

      const unitKey = parentType
        ? `method:${parentType}.${name}`
        : `method:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineEnd = findBlockEnd(content, match.index);
      const isExported = modifiers.includes('public');
      const isAsync = modifiers.includes('async');

      let signature = `(${params})`;
      if (returnType) {
        signature += `: ${returnType}`;
      }

      units.push({
        name,
        unitType: CodeUnitType.METHOD,
        lineStart,
        lineEnd,
        signature,
        isAsync,
        isExported,
      });
    }

    // Sort by line number
    units.sort((a, b) => a.lineStart - b.lineStart);

    return units;
  }

  /**
   * Find the parent type (class/struct/interface) for a given line number.
   */
  private findParentType(
    lineNumber: number,
    typeDeclarations: Array<{ name: string; lineStart: number; lineEnd: number }>,
  ): string | undefined {
    let bestMatch: { name: string; lineStart: number; lineEnd: number } | undefined;

    for (const decl of typeDeclarations) {
      if (lineNumber > decl.lineStart && lineNumber <= decl.lineEnd) {
        if (!bestMatch || (decl.lineStart > bestMatch.lineStart)) {
          bestMatch = decl;
        }
      }
    }

    return bestMatch?.name;
  }

  extractDependencies(content: string, _filePath: string): FileDependencyInfo[] {
    const dependencies: FileDependencyInfo[] = [];
    const seenDeps = new Set<string>();

    // Match: [global] using [static] [Alias =] Namespace.Type;
    const usingPattern =
      /(?:^|\n)\s*(?:global\s+)?using\s+(?:static\s+)?(?:(\w+)\s*=\s*)?([A-Z][\w.]*)\s*;/g;

    let match;
    while ((match = usingPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, CSHARP_COMMENT_SYNTAX)) continue;

      // Check for resource disposal pattern
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index + match[0].length);
      const fullLine = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();

      if (/using\s*\(/.test(fullLine) || /using\s+var\s/.test(fullLine)) continue;

      // Check brace depth to skip using inside method bodies
      let braceDepth = 0;
      for (let i = 0; i < match.index; i++) {
        if (content[i] === '{') braceDepth++;
        if (content[i] === '}') braceDepth--;
      }
      if (braceDepth >= 2) continue;

      const alias = match[1] || null;
      const target = match[2];

      const key = target;
      if (seenDeps.has(key)) continue;
      seenDeps.add(key);

      dependencies.push({
        targetFile: target,
        importType: ImportType.MODULE,
        importedNames: alias ? [alias] : [],
      });
    }

    return dependencies;
  }

  getComplexityPatterns(): LanguageComplexityPatterns {
    return {
      conditionals: [
        /\bif\s*\(/g,
        /\belse\s+if\s*\(/g,
        /\bswitch\s*[({]/g,
        /\bcase\s+/g,
        /\?[^?:]+:/g,
      ],
      loops: [
        /\bfor\s*\(/g,
        /\bforeach\s*\(/g,
        /\bwhile\s*\(/g,
        /\bdo\s*\{/g,
      ],
      errorHandling: [
        /\btry\s*\{/g,
        /\bcatch\s*[({]/g,
        /\bfinally\s*\{/g,
      ],
      asyncPatterns: [
        /\basync\s+/g,
        /\bawait\s+/g,
        /Task\./g,
        /Task<\w+>/g,
      ],
    };
  }

  getPatternRules(): PatternRuleSet {
    return {
      apiEndpoints: [
        // ASP.NET Controller attributes: [HttpGet("/path")], [HttpPost]
        {
          pattern: /\[(HttpGet|HttpPost|HttpPut|HttpPatch|HttpDelete)\s*(?:\(\s*"([^"]*)"\s*\))?\s*\]/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => {
            const method = match[1].replace('Http', '').toUpperCase();
            const path = match[2] || '';
            return path ? `${method} ${path}` : method;
          },
        },
        // [Route("api/[controller]")]
        {
          pattern: /\[Route\s*\(\s*"([^"]+)"\s*\)\]/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => `ROUTE ${match[1]}`,
        },
        // Minimal API: app.MapGet("/path", ...)
        {
          pattern: /app\.(MapGet|MapPost|MapPut|MapPatch|MapDelete)\s*\(\s*"([^"]+)"/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => {
            const method = match[1].replace('Map', '').toUpperCase();
            return `${method} ${match[2]}`;
          },
        },
      ],
      apiCalls: [],
      databaseReads: [
        // EF Core: context.Set<Entity>()...
        {
          pattern: /context\.(?:Set<\w+>\s*\(\s*\)\.|(\w+)\.)(?:ToList|Find|First|FirstOrDefault|Single|SingleOrDefault|Any|Count|ToArray)\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: () => 'EF Read',
        },
        // LINQ Where on DbSet
        {
          pattern: /\.Where\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: () => 'LINQ Where',
        },
        // EF Core FromSqlRaw
        {
          pattern: /\.FromSqlRaw\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: () => 'EF FromSqlRaw',
        },
        // Shared SQL read patterns
        ...SQL_READ_PATTERNS.map((r) => ({
          pattern: r.pattern,
          patternType: PatternType.DATABASE_READ,
          value: r.value,
        })),
      ],
      databaseWrites: [
        // EF Core: context.Add/Update/Remove
        {
          pattern: /context\.(Add|Update|Remove|AddRange|UpdateRange|RemoveRange)\s*\(/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: (match) => `EF ${match[1]}`,
        },
        // SaveChanges
        {
          pattern: /\.SaveChanges(?:Async)?\s*\(/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: () => 'EF SaveChanges',
        },
        // EF Core ExecuteSqlRaw
        {
          pattern: /\.ExecuteSqlRaw(?:Async)?\s*\(/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: () => 'EF ExecuteSqlRaw',
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
        // Environment.GetEnvironmentVariable("VAR")
        {
          pattern: /Environment\.GetEnvironmentVariable\s*\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
        // Configuration["Key"]
        {
          pattern: /Configuration\s*\[\s*"([^"]+)"\s*\]/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
        // IConfiguration.GetValue<T>("Key")
        {
          pattern: /\.GetValue<[^>]+>\s*\(\s*"([^"]+)"\s*\)/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
        // IConfiguration.GetSection("Key")
        {
          pattern: /\.GetSection\s*\(\s*"([^"]+)"\s*\)/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
      ],
    };
  }

  getSkipDirectories(): string[] {
    return ['bin', 'obj', '.vs', 'packages'];
  }

  getTestFilePatterns(): RegExp[] {
    return [/Tests?\.cs$/, /\.Tests\//];
  }
}
