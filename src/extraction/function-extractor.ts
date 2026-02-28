/**
 * Function Extractor
 *
 * Extracts CodeUnitDeclarations (functions, methods, classes) from JavaScript/TypeScript files.
 * Works heuristically without AST parsing for speed.
 *
 * Detects:
 * - Named function declarations
 * - Arrow function expressions
 * - Class declarations with methods
 * - Async functions
 * - Exported declarations
 */

import { CodeUnitType } from '@/domain/models/index.js';

import type { CodeUnitDeclaration } from './types.js';
import { findBlockEnd, findBlockEndIndex, getLineNumber, isInsideStringOrComment } from './shared/block-finder.js';

/**
 * Detection patterns for JavaScript/TypeScript
 */
const PATTERNS = {
  /**
   * Named function declaration
   * Matches: function foo(params) { or export function foo or export async function foo
   */
  namedFunction: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g,

  /**
   * Arrow function assigned to const/let
   * Matches: const foo = (params) => or export const foo = async (params) =>
   */
  arrowFunction:
    /(?:export\s+)?(?:const|let)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*([^=]+))?\s*=>/g,

  /**
   * Class declaration
   * Matches: class Foo { or export class Foo extends Bar implements Baz
   */
  classDeclaration:
    /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+[\w.<>]+)?(?:\s+implements\s+[^{]+)?\s*\{/g,

  /**
   * Method inside class
   * Matches: methodName(params) { or async methodName(params): ReturnType {
   */
  classMethod:
    /(?:(?:public|private|protected|static|async|readonly|override)\s+)*(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g,

  /**
   * Export default function
   * Matches: export default function foo or export default async function foo
   */
  exportDefaultFunction: /export\s+default\s+(?:async\s+)?function\s+(\w+)?\s*\(([^)]*)\)/g,

  /**
   * Export default arrow function
   * Matches: export default (params) => or export default async (params) =>
   */
  exportDefaultArrow: /export\s+default\s+(?:async\s+)?\(([^)]*)\)\s*(?::\s*([^=]+))?\s*=>/g,

  /**
   * Interface declaration
   * Matches: interface Foo { or export interface Foo extends Bar {
   */
  interfaceDeclaration: /(export\s+)?interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*\{/g,

  /**
   * Enum declaration
   * Matches: enum Foo { or export enum Foo { or export const enum Foo {
   */
  enumDeclaration: /(export\s+)?(const\s+)?enum\s+(\w+)\s*\{/g,

  /**
   * Type alias declaration
   * Matches: type Foo = or export type Foo<T> =
   */
  typeAlias: /(export\s+)?type\s+(\w+)\s*(<[^>]*>)?\s*=/g,
};

/**
 * Keywords that should not be treated as function/method names
 */
const RESERVED_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'class', 'new', 'return',
  'throw', 'try', 'typeof', 'void', 'delete', 'instanceof', 'in', 'do', 'else',
  'case', 'break', 'continue', 'default', 'finally', 'with', 'debugger', 'yield',
  'await', 'super', 'this', 'null', 'true', 'false', 'undefined', 'NaN', 'Infinity',
  'import', 'export', 'extends', 'implements', 'interface', 'type', 'enum',
  'namespace', 'module', 'declare', 'abstract', 'as', 'from', 'get', 'set',
]);

/**
 * Extract code units from JS/TS file content.
 * Works heuristically without AST parsing for speed.
 *
 * @param content - The file content to analyze
 * @param filePath - The file path (used for extension check, not read from disk)
 * @returns Array of CodeUnitDeclaration objects
 */
export function extractCodeUnits(content: string, filePath: string): CodeUnitDeclaration[] {
  const units: CodeUnitDeclaration[] = [];
  const seenUnits = new Set<string>();

  // Skip non-JS/TS files
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext || '')) {
    return [];
  }

  // Extract named functions
  extractNamedFunctions(content, units, seenUnits);

  // Extract arrow functions
  extractArrowFunctions(content, units, seenUnits);

  // Extract classes with their methods
  extractClasses(content, units, seenUnits);

  // Extract interfaces
  extractInterfaces(content, units, seenUnits);

  // Extract enums
  extractEnums(content, units, seenUnits);

  // Extract type aliases
  extractTypeAliases(content, units, seenUnits);

  // Sort by line number
  units.sort((a, b) => a.lineStart - b.lineStart);

  return units;
}

function extractNamedFunctions(
  content: string,
  units: CodeUnitDeclaration[],
  seenUnits: Set<string>,
): void {
  const pattern = new RegExp(PATTERNS.namedFunction.source, 'g');
  let match;

  while ((match = pattern.exec(content)) !== null) {
    if (isInsideStringOrComment(content, match.index)) continue;

    const name = match[1];
    if (RESERVED_KEYWORDS.has(name) || seenUnits.has(`function:${name}`)) continue;
    seenUnits.add(`function:${name}`);

    const fullMatch = match[0];
    const isExported = fullMatch.startsWith('export');
    const isAsync = fullMatch.includes('async');
    const params = match[3]?.trim() || '';
    const returnType = match[4]?.trim() || undefined;
    const lineStart = getLineNumber(content, match.index);
    const lineEnd = findBlockEnd(content, match.index + match[0].length - 1);

    units.push({
      name,
      unitType: CodeUnitType.FUNCTION,
      lineStart,
      lineEnd,
      signature: returnType ? `(${params}): ${returnType}` : `(${params})`,
      isAsync,
      isExported,
    });
  }
}

function extractArrowFunctions(
  content: string,
  units: CodeUnitDeclaration[],
  seenUnits: Set<string>,
): void {
  const pattern = new RegExp(PATTERNS.arrowFunction.source, 'g');
  let match;

  while ((match = pattern.exec(content)) !== null) {
    if (isInsideStringOrComment(content, match.index)) continue;

    const name = match[1];
    if (RESERVED_KEYWORDS.has(name) || seenUnits.has(`arrow:${name}`)) continue;
    seenUnits.add(`arrow:${name}`);

    const fullMatch = match[0];
    const isExported = fullMatch.startsWith('export');
    const isAsync = fullMatch.includes('async');
    const params = match[2]?.trim() || '';
    const returnType = match[3]?.trim() || undefined;
    const lineStart = getLineNumber(content, match.index);

    // For arrow functions, find end based on block body or expression body
    let lineEnd = lineStart;
    const afterMatch = content.slice(match.index + fullMatch.length);
    const nextBrace = afterMatch.indexOf('{');
    const nextArrowEnd = afterMatch.indexOf(';');

    if (nextBrace !== -1 && (nextArrowEnd === -1 || nextBrace < nextArrowEnd)) {
      // Has a block body
      lineEnd = findBlockEnd(content, match.index + fullMatch.length + nextBrace);
    } else {
      // Expression body - look for semicolon or end of line
      lineEnd = lineStart + Math.min(5, afterMatch.split('\n').length - 1);
    }

    units.push({
      name,
      unitType: CodeUnitType.ARROW_FUNCTION,
      lineStart,
      lineEnd,
      signature: returnType ? `(${params}): ${returnType}` : `(${params})`,
      isAsync,
      isExported,
    });
  }
}

function extractClasses(
  content: string,
  units: CodeUnitDeclaration[],
  seenUnits: Set<string>,
): void {
  const classPattern = new RegExp(PATTERNS.classDeclaration.source, 'g');
  let match;

  while ((match = classPattern.exec(content)) !== null) {
    if (isInsideStringOrComment(content, match.index)) continue;

    const className = match[1];
    if (RESERVED_KEYWORDS.has(className) || seenUnits.has(`class:${className}`)) continue;
    seenUnits.add(`class:${className}`);

    const fullMatch = match[0];
    const isExported = fullMatch.startsWith('export');
    const lineStart = getLineNumber(content, match.index);
    const lineEnd = findBlockEnd(content, match.index + match[0].length - 1);

    // Build signature from extends/implements
    let signature: string | undefined;
    const extendsMatch = fullMatch.match(/extends\s+([\w.<>]+)/);
    const implementsMatch = fullMatch.match(/implements\s+([^{]+)/);
    if (extendsMatch || implementsMatch) {
      const parts: string[] = [];
      if (extendsMatch) parts.push(`extends ${extendsMatch[1].trim()}`);
      if (implementsMatch) parts.push(`implements ${implementsMatch[1].trim()}`);
      signature = parts.join(' ');
    }

    // Extract methods within this class
    const children = extractClassMethods(content, match, className, lineStart, lineEnd, seenUnits);

    units.push({
      name: className,
      unitType: CodeUnitType.CLASS,
      lineStart,
      lineEnd,
      signature,
      isAsync: false,
      isExported,
      children,
    });
  }
}

function extractClassMethods(
  content: string,
  classMatch: RegExpExecArray,
  className: string,
  classLineStart: number,
  classLineEnd: number,
  seenUnits: Set<string>,
): CodeUnitDeclaration[] {
  const methods: CodeUnitDeclaration[] = [];
  const classEndIndex = findBlockEndIndex(content, classMatch.index + classMatch[0].length - 1);
  const classContent = classEndIndex !== -1
    ? content.slice(classMatch.index, classEndIndex + 1)
    : content.slice(classMatch.index);
  const methodPattern = new RegExp(PATTERNS.classMethod.source, 'g');
  let methodMatch;

  while ((methodMatch = methodPattern.exec(classContent)) !== null) {
    const methodName = methodMatch[1];

    // Skip constructor, reserved keywords, and already seen methods
    if (
      methodName === 'constructor' ||
      RESERVED_KEYWORDS.has(methodName) ||
      seenUnits.has(`method:${className}.${methodName}`)
    ) {
      continue;
    }
    seenUnits.add(`method:${className}.${methodName}`);

    const methodFullMatch = methodMatch[0];
    const methodIsAsync = methodFullMatch.includes('async');
    const methodParams = methodMatch[3]?.trim() || '';
    const methodReturnType = methodMatch[4]?.trim() || undefined;
    const methodLineStart = classLineStart + getLineNumber(classContent, methodMatch.index) - 1;
    let methodLineEnd = findBlockEnd(classContent, methodMatch.index + methodMatch[0].length - 1) + classLineStart - 1;
    if (methodLineEnd < methodLineStart) {
      methodLineEnd = methodLineStart;
    }

    methods.push({
      name: methodName,
      unitType: CodeUnitType.METHOD,
      lineStart: methodLineStart,
      lineEnd: Math.min(methodLineEnd, classLineEnd),
      signature: methodReturnType
        ? `(${methodParams}): ${methodReturnType}`
        : `(${methodParams})`,
      isAsync: methodIsAsync,
      isExported: false,
    });
  }

  return methods;
}

function extractInterfaces(
  content: string,
  units: CodeUnitDeclaration[],
  seenUnits: Set<string>,
): void {
  const pattern = new RegExp(PATTERNS.interfaceDeclaration.source, 'g');
  let match;

  while ((match = pattern.exec(content)) !== null) {
    if (isInsideStringOrComment(content, match.index)) continue;

    const name = match[2];
    if (RESERVED_KEYWORDS.has(name) || seenUnits.has(`interface:${name}`)) continue;
    seenUnits.add(`interface:${name}`);

    const isExported = !!match[1];
    const extendsClause = match[3]?.trim() || undefined;
    const lineStart = getLineNumber(content, match.index);
    const lineEnd = findBlockEnd(content, match.index + match[0].length - 1);

    const signature = extendsClause ? `extends ${extendsClause}` : undefined;

    units.push({
      name,
      unitType: CodeUnitType.INTERFACE,
      lineStart,
      lineEnd,
      signature,
      isAsync: false,
      isExported,
    });
  }
}

function extractEnums(
  content: string,
  units: CodeUnitDeclaration[],
  seenUnits: Set<string>,
): void {
  const pattern = new RegExp(PATTERNS.enumDeclaration.source, 'g');
  let match;

  while ((match = pattern.exec(content)) !== null) {
    if (isInsideStringOrComment(content, match.index)) continue;

    const name = match[3];
    if (RESERVED_KEYWORDS.has(name) || seenUnits.has(`enum:${name}`)) continue;
    seenUnits.add(`enum:${name}`);

    const isExported = !!match[1];
    const lineStart = getLineNumber(content, match.index);
    const braceStart = match.index + match[0].length - 1;
    const lineEnd = findBlockEnd(content, braceStart);

    // Extract member names from block content for signature
    const blockEndIndex = findBlockEndIndex(content, braceStart);
    let signature: string | undefined;
    if (blockEndIndex !== -1) {
      const blockContent = content.slice(braceStart + 1, blockEndIndex);
      const memberNames = blockContent
        .split(/[,\n]/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.split(/[\s=]/)[0])
        .filter((name) => name.length > 0);
      if (memberNames.length > 0) {
        signature = `{ ${memberNames.join(', ')} }`;
      }
    }

    units.push({
      name,
      unitType: CodeUnitType.ENUM,
      lineStart,
      lineEnd,
      signature,
      isAsync: false,
      isExported,
    });
  }
}

/**
 * Find the terminating semicolon of a type alias, skipping semicolons inside braces.
 */
function findTypeAliasEnd(content: string, startIndex: number): number {
  let depth = 0;
  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    if (char === '{' || char === '(') {
      depth++;
    } else if (char === '}' || char === ')') {
      depth--;
    } else if (char === ';' && depth === 0) {
      return i;
    }
  }
  return -1;
}

function extractTypeAliases(
  content: string,
  units: CodeUnitDeclaration[],
  seenUnits: Set<string>,
): void {
  const pattern = new RegExp(PATTERNS.typeAlias.source, 'g');
  let match;

  while ((match = pattern.exec(content)) !== null) {
    if (isInsideStringOrComment(content, match.index)) continue;

    const name = match[2];
    if (RESERVED_KEYWORDS.has(name) || seenUnits.has(`type:${name}`)) continue;
    seenUnits.add(`type:${name}`);

    const isExported = !!match[1];
    const lineStart = getLineNumber(content, match.index);

    // Find the end of the type alias by looking for `;` outside braces
    const equalsIndex = match.index + match[0].length;
    const terminatorIndex = findTypeAliasEnd(content, equalsIndex);
    const lineEnd = terminatorIndex !== -1
      ? getLineNumber(content, terminatorIndex)
      : lineStart;

    // Extract the RHS as signature
    let rhs: string | undefined;
    if (terminatorIndex !== -1) {
      rhs = content.slice(equalsIndex, terminatorIndex).trim();
    } else {
      // No semicolon found, take to end of line
      const eolIndex = content.indexOf('\n', equalsIndex);
      rhs = content.slice(equalsIndex, eolIndex !== -1 ? eolIndex : undefined).trim();
    }

    const signature = rhs && rhs.length > 100 ? rhs.slice(0, 100) : rhs || undefined;

    units.push({
      name,
      unitType: CodeUnitType.TYPE_ALIAS,
      lineStart,
      lineEnd,
      signature,
      isAsync: false,
      isExported,
    });
  }
}
