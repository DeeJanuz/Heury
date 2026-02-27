/**
 * Java Language Extractor
 *
 * Extracts code units, dependencies, and patterns from Java source files.
 * Implements the LanguageExtractor interface for the multi-language registry.
 *
 * Detects:
 * - Classes: class Name { with modifiers
 * - Interfaces: interface Name {
 * - Enums: enum Name {
 * - Records: record Name(params) { (treated as CLASS)
 * - Methods: public returnType name(params) { as children of classes
 * - Constructors: ClassName(params) {
 *
 * Dependencies:
 * - Single import: import java.util.List;
 * - Wildcard import: import java.util.*;
 * - Static import: import static java.lang.Math.PI;
 *
 * Patterns:
 * - API endpoints: Spring @GetMapping, @PostMapping, @RequestMapping
 * - Database: JPA EntityManager, Spring Data Repository
 * - Env variables: @Value, System.getenv
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
 * Comment syntax for Java
 */
const JAVA_COMMENT_SYNTAX = {
  lineComment: '//',
  blockCommentStart: '/*',
  blockCommentEnd: '*/',
};

/**
 * Java reserved keywords
 */
const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte',
  'case', 'catch', 'char', 'class', 'const',
  'continue', 'default', 'do', 'double', 'else',
  'enum', 'extends', 'final', 'finally', 'float',
  'for', 'goto', 'if', 'implements', 'import',
  'instanceof', 'int', 'interface', 'long', 'native',
  'new', 'package', 'private', 'protected', 'public',
  'return', 'short', 'static', 'strictfp', 'super',
  'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while',
  'var', 'record', 'sealed', 'permits', 'yield',
]);

/**
 * Language extractor for Java files.
 */
export class JavaExtractor implements LanguageExtractor {
  readonly languageId = 'java';
  readonly extensions = ['.java'];

  extractCodeUnits(content: string, _filePath: string): CodeUnitDeclaration[] {
    const units: CodeUnitDeclaration[] = [];
    const seenUnits = new Set<string>();

    // Track class ranges so we can assign methods as children
    const classRanges: Array<{ name: string; startIndex: number; endLine: number }> = [];

    // Extract class declarations
    const classPattern =
      /(?:(?:public|private|protected|abstract|final|static|sealed|strictfp)\s+)*class\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+[\w.<>,\s]+)?(?:\s+implements\s+[^{]+)?\s*\{/g;

    let match;
    while ((match = classPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, JAVA_COMMENT_SYNTAX)) continue;

      const name = match[1];
      const unitKey = `class:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);
      const isExported = match[0].includes('public');

      classRanges.push({ name, startIndex: match.index, endLine: lineEnd });

      units.push({
        name,
        unitType: CodeUnitType.CLASS,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported,
      });
    }

    // Extract interface declarations
    const interfacePattern =
      /(?:(?:public|private|protected|abstract|static|sealed|strictfp)\s+)*interface\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+[^{]+)?\s*\{/g;

    while ((match = interfacePattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, JAVA_COMMENT_SYNTAX)) continue;

      const name = match[1];
      const unitKey = `interface:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);
      const isExported = match[0].includes('public');

      classRanges.push({ name, startIndex: match.index, endLine: lineEnd });

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
      /(?:(?:public|private|protected|static|strictfp)\s+)*enum\s+(\w+)(?:\s+implements\s+[^{]+)?\s*\{/g;

    while ((match = enumPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, JAVA_COMMENT_SYNTAX)) continue;

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

    // Extract record declarations (treated as CLASS)
    const recordPattern =
      /(?:(?:public|private|protected|static|final|sealed)\s+)*record\s+(\w+)\s*\([^)]*\)(?:\s+implements\s+[^{]+)?\s*\{/g;

    while ((match = recordPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, JAVA_COMMENT_SYNTAX)) continue;

      const name = match[1];
      const unitKey = `record:${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);
      const isExported = match[0].includes('public');

      classRanges.push({ name, startIndex: match.index, endLine: lineEnd });

      units.push({
        name,
        unitType: CodeUnitType.CLASS,
        lineStart,
        lineEnd,
        isAsync: false,
        isExported,
      });
    }

    // Extract methods and constructors
    const methodPattern =
      /(?:(?:@\w+(?:\([^)]*\))?\s*\n?\s*)*)(?:(?:public|private|protected|static|final|abstract|synchronized|native|default|strictfp)\s+)*(?:<[^>]+>\s+)?(?:([\w.<>,[\]]+)\s+)?(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w.,\s]+)?\s*\{/g;

    while ((match = methodPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, JAVA_COMMENT_SYNTAX)) continue;

      const returnType = match[1]?.trim() || null;
      const name = match[2];
      const params = match[3]?.trim() || '';

      // Skip language keywords
      if (JAVA_KEYWORDS.has(name) && name !== 'record') continue;
      if (name === 'class' || name === 'interface' || name === 'enum') continue;

      // Find containing class
      const matchLine = getLineNumber(content, match.index);
      let parentName: string | undefined;
      for (const range of classRanges) {
        const rangeStartLine = getLineNumber(content, range.startIndex);
        if (matchLine > rangeStartLine && matchLine <= range.endLine) {
          parentName = range.name;
        }
      }

      // Skip if no parent class found
      if (!parentName) continue;

      const isConstructor = name === parentName && !returnType;

      const unitKey = isConstructor
        ? `constructor:${parentName}`
        : `method:${parentName}.${name}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);

      const lineStart = getLineNumber(content, match.index);
      const lineEnd = findBlockEnd(content, match.index);
      const isExported = match[0].includes('public');

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

    // Regular import: import [static] package.path.Name;
    // Wildcard import: import [static] package.path.*;
    const importPattern = /\bimport\s+(static\s+)?([\w.]+(?:\.\*)?)\s*;/g;

    let match;
    while ((match = importPattern.exec(content)) !== null) {
      if (isInsideStringOrComment(content, match.index, JAVA_COMMENT_SYNTAX)) continue;

      const isStatic = !!match[1];
      const fullPath = match[2];
      const isWildcard = fullPath.endsWith('.*');

      if (isWildcard) {
        const packagePath = fullPath.slice(0, -2);
        const key = `${packagePath}:wildcard`;
        if (seenDeps.has(key)) continue;
        seenDeps.add(key);

        dependencies.push({
          targetFile: packagePath,
          importType: ImportType.WILDCARD,
          importedNames: ['*'],
        });
      } else {
        let targetFile: string;
        let importedName: string;

        if (isStatic) {
          const lastDot = fullPath.lastIndexOf('.');
          targetFile = fullPath.slice(0, lastDot);
          importedName = fullPath.slice(lastDot + 1);
        } else {
          targetFile = fullPath;
          const lastDot = fullPath.lastIndexOf('.');
          importedName = lastDot >= 0 ? fullPath.slice(lastDot + 1) : fullPath;
        }

        const key = `${targetFile}:${importedName}`;
        if (seenDeps.has(key)) continue;
        seenDeps.add(key);

        dependencies.push({
          targetFile,
          importType: ImportType.PACKAGE,
          importedNames: [importedName],
        });
      }
    }

    return dependencies;
  }

  getComplexityPatterns(): LanguageComplexityPatterns {
    return {
      conditionals: [
        /\bif\s*\(/g,
        /\belse\s+if\s*\(/g,
        /\bswitch\s*\(/g,
        /\bcase\s+/g,
        /\?[^?:]+:/g,
      ],
      loops: [
        /\bfor\s*\(/g,
        /\bwhile\s*\(/g,
        /\bdo\s*\{/g,
        /\.forEach\s*\(/g,
        /\.stream\s*\(/g,
      ],
      errorHandling: [
        /\btry\s*[({]/g,
        /\bcatch\s*\(/g,
        /\bfinally\s*\{/g,
      ],
      asyncPatterns: [
        /CompletableFuture/g,
        /\.thenApply\s*\(/g,
        /\.thenAccept\s*\(/g,
        /\.thenCompose\s*\(/g,
      ],
    };
  }

  getPatternRules(): PatternRuleSet {
    return {
      apiEndpoints: [
        // Spring: @GetMapping("/path"), @PostMapping("/path")
        {
          pattern: /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping)\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => {
            const method = match[1].replace('Mapping', '').toUpperCase();
            return `${method} ${match[2]}`;
          },
        },
        // Spring: @GetMapping without path = "/"
        {
          pattern: /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping)\s*$/gm,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => {
            const method = match[1].replace('Mapping', '').toUpperCase();
            return `${method} /`;
          },
        },
        // Spring: @RequestMapping with value/path and method
        {
          pattern: /@RequestMapping\s*\(.*?(?:value|path)\s*=\s*["']([^"']+)["'].*?(?:method\s*=\s*RequestMethod\.(\w+))?\)/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => {
            const method = match[2] || 'GET';
            return `${method} ${match[1]}`;
          },
        },
      ],
      apiCalls: [
        {
          pattern: /restTemplate\.(getForObject|getForEntity|postForObject|postForEntity|exchange)\s*\(/g,
          patternType: PatternType.API_CALL,
          extractValue: (match) => `RestTemplate.${match[1]}`,
        },
        {
          pattern: /webClient\.(get|post|put|delete|patch)\s*\(\)/g,
          patternType: PatternType.API_CALL,
          extractValue: (match) => `WebClient.${match[1]}`,
        },
      ],
      databaseReads: [
        // JPA EntityManager
        {
          pattern: /entityManager\.(find|createQuery|createNamedQuery|createNativeQuery)\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: (match) => `EntityManager.${match[1]}`,
        },
        // Spring Data Repository
        {
          pattern: /repository\.(findBy\w+|findAll|findById|getById|getOne|count|exists)\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: (match) => `Repository.${match[1]}`,
        },
        // @Query annotation with SELECT
        {
          pattern: /@Query\s*\(\s*["']SELECT\s/gi,
          patternType: PatternType.DATABASE_READ,
          extractValue: () => '@Query SELECT',
        },
        // Shared SQL read patterns
        ...SQL_READ_PATTERNS.map((r) => ({
          pattern: r.pattern,
          patternType: PatternType.DATABASE_READ,
          value: r.value,
        })),
      ],
      databaseWrites: [
        // JPA EntityManager
        {
          pattern: /entityManager\.(persist|merge|remove|flush)\s*\(/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: (match) => `EntityManager.${match[1]}`,
        },
        // Spring Data Repository
        {
          pattern: /repository\.(save|saveAll|saveAndFlush|delete|deleteById|deleteAll)\s*\(/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: (match) => `Repository.${match[1]}`,
        },
        // @Query with modification
        {
          pattern: /@Query\s*\(\s*["'](?:INSERT|UPDATE|DELETE)\s/gi,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: () => '@Query modification',
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
        // @Value("${property.name}")
        {
          pattern: /@Value\s*\(\s*["']\$\{([^}]+)\}["']\s*\)/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
        // System.getenv("VAR")
        {
          pattern: /System\.getenv\s*\(\s*["']([A-Z_][A-Z0-9_]*)["']\s*\)/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
        // System.getProperty("prop")
        {
          pattern: /System\.getProperty\s*\(\s*["']([^"']+)["']\s*\)/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
      ],
    };
  }

  getSkipDirectories(): string[] {
    return ['target', '.gradle', '.idea', '.mvn'];
  }

  getTestFilePatterns(): RegExp[] {
    return [/Test\.java$/, /Tests\.java$/, /IT\.java$/, /src\/test\//];
  }
}
