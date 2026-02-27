/**
 * Python Language Extractor
 *
 * Implements the LanguageExtractor interface for Python files.
 * Extracts functions, classes, methods, lambdas, imports, and
 * detects patterns for Flask, FastAPI, Django, SQLAlchemy, and more.
 *
 * Uses indentation-based block detection via findIndentationBlockEnd()
 * from shared/block-finder.ts.
 */

import { CodeUnitType, ImportType, PatternType } from '@/domain/models/index.js';

import type { LanguageExtractor } from '../language-registry.js';
import type {
  CodeUnitDeclaration,
  FileDependencyInfo,
  PatternRuleSet,
  LanguageComplexityPatterns,
} from '../types.js';
import { findIndentationBlockEnd } from '../shared/block-finder.js';

/**
 * Language extractor for Python files.
 */
export class PythonExtractor implements LanguageExtractor {
  readonly languageId = 'python';
  readonly extensions = ['.py', '.pyw'];

  extractCodeUnits(content: string, _filePath: string): CodeUnitDeclaration[] {
    const units: CodeUnitDeclaration[] = [];
    const lines = content.split('\n');

    // Parse __all__ if present to determine explicit exports
    const allExports = this.parseAllExports(content);

    // Track class ranges for determining method parentage
    const classRanges: Array<{
      name: string;
      lineStart: number;
      lineEnd: number;
      indent: number;
    }> = [];

    // First pass: extract classes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const classMatch = line.match(/^(\s*)class\s+(\w+)(?:\(([^)]*)\))?\s*:/);
      if (!classMatch) continue;

      const indent = classMatch[1].length;
      const className = classMatch[2];
      const bases = classMatch[3]?.trim() || null;
      const lineStart = i + 1; // 1-indexed
      const charIndex = this.lineToCharIndex(lines, i);
      const lineEnd = findIndentationBlockEnd(content, charIndex);

      const signature = bases ? `(${bases})` : undefined;

      classRanges.push({ name: className, lineStart, lineEnd, indent });

      units.push({
        name: className,
        unitType: CodeUnitType.CLASS,
        lineStart,
        lineEnd,
        signature,
        isAsync: false,
        isExported: this.isExportedName(className, indent === 0, allExports),
      });
    }

    // Second pass: extract functions, methods, and lambdas
    // Handle multi-line signatures by joining continuation lines
    const joinedContent = this.joinMultiLineSignatures(content);
    const joinedLines = joinedContent.split('\n');

    // Map from joined line index to original line number
    const lineMapping = this.buildLineMapping(content, joinedContent);

    for (let i = 0; i < joinedLines.length; i++) {
      const line = joinedLines[i];
      const originalLineNum = lineMapping[i] + 1; // 1-indexed

      // Check for def / async def
      const funcMatch = line.match(
        /^(\s*)(?:(async)\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/
      );
      if (funcMatch) {
        const indent = funcMatch[1].length;
        const isAsync = funcMatch[2] === 'async';
        const name = funcMatch[3];
        const rawParams = funcMatch[4]?.trim() || '';
        const returnType = funcMatch[5]?.trim() || null;

        // Find original char index for block end calculation
        const charIndex = this.lineToCharIndex(lines, lineMapping[i]);
        const lineEnd = findIndentationBlockEnd(content, charIndex);

        // Determine if this is a method (inside a class)
        const parentClass = this.findParentClass(
          originalLineNum, indent, classRanges
        );

        // Strip self/cls parameter from methods
        const params = parentClass
          ? this.stripSelfParam(rawParams)
          : rawParams;

        const signature = returnType
          ? `(${params}) -> ${returnType}`
          : `(${params})`;

        const isTopLevel = indent === 0;
        const unitType = parentClass ? CodeUnitType.METHOD : CodeUnitType.FUNCTION;

        units.push({
          name,
          unitType,
          lineStart: originalLineNum,
          lineEnd,
          signature,
          isAsync,
          isExported: parentClass
            ? false
            : this.isExportedName(name, isTopLevel, allExports),
        });
        continue;
      }

      // Check for lambda assignment
      const lambdaMatch = line.match(
        /^(\s*)(\w+)\s*=\s*lambda\s+([^:]*)\s*:/
      );
      if (lambdaMatch) {
        const indent = lambdaMatch[1].length;
        const name = lambdaMatch[2];
        const params = lambdaMatch[3]?.trim() || '';

        const isTopLevel = indent === 0;

        units.push({
          name,
          unitType: CodeUnitType.ARROW_FUNCTION,
          lineStart: originalLineNum,
          lineEnd: originalLineNum,
          signature: `(${params})`,
          isAsync: false,
          isExported: this.isExportedName(name, isTopLevel, allExports),
        });
      }
    }

    // Sort by line number
    units.sort((a, b) => a.lineStart - b.lineStart);

    return units;
  }

  extractDependencies(content: string, filePath: string): FileDependencyInfo[] {
    const dependencies: FileDependencyInfo[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith('#')) continue;

      // from X import Y, Z
      const fromImportMatch = trimmed.match(
        /^from\s+(\.{0,3}[\w.]*)\s+import\s+(.+)$/
      );
      if (fromImportMatch) {
        const target = fromImportMatch[1];
        const namesStr = fromImportMatch[2].trim();

        // Skip __future__ imports
        if (target === '__future__') continue;

        // Wildcard import
        if (namesStr === '*') {
          const resolvedTarget = this.resolveImportTarget(target, filePath);
          dependencies.push({
            targetFile: resolvedTarget,
            importType: ImportType.NAMESPACE,
            importedNames: [],
          });
          continue;
        }

        // Named imports
        const names = namesStr
          .split(',')
          .map(n => {
            // Handle "name as alias" - take original name
            const parts = n.trim().split(/\s+as\s+/);
            return parts[0].trim();
          })
          .filter(n => n.length > 0);

        // For bare relative imports like `from . import sibling`, the imported
        // names are module names, not symbols. Resolve each as a submodule.
        const isPureRelative = /^\.+$/.test(target);
        if (isPureRelative && names.length > 0) {
          for (const name of names) {
            const resolvedTarget = this.resolveImportTarget(target + name, filePath);
            dependencies.push({
              targetFile: resolvedTarget,
              importType: ImportType.NAMED,
              importedNames: [name],
            });
          }
        } else {
          const resolvedTarget = this.resolveImportTarget(target, filePath);
          dependencies.push({
            targetFile: resolvedTarget,
            importType: ImportType.NAMED,
            importedNames: names,
          });
        }
        continue;
      }

      // import X, import X as Y
      const importMatch = trimmed.match(/^import\s+([\w.]+)(?:\s+as\s+\w+)?$/);
      if (importMatch) {
        const target = importMatch[1];
        dependencies.push({
          targetFile: target,
          importType: ImportType.NAMED,
          importedNames: [],
        });
      }
    }

    return dependencies;
  }

  getComplexityPatterns(): LanguageComplexityPatterns {
    return {
      conditionals: [
        /\bif\s/g,
        /\belif\s/g,
        /\bif\s+.*\belse\b/g,
      ],
      loops: [
        /\bfor\s+\w+\s+in\s/g,
        /\bwhile\s/g,
      ],
      errorHandling: [
        /\btry\s*:/g,
        /\bexcept\s/g,
        /\bfinally\s*:/g,
      ],
      asyncPatterns: [
        /\basync\s+def/g,
        /\bawait\s/g,
        /\basyncio\./g,
      ],
    };
  }

  getPatternRules(): PatternRuleSet {
    return {
      apiEndpoints: [
        // Flask: @app.route('/path', methods=['GET'])
        {
          pattern: /@(?:app|blueprint)\.route\s*\(\s*['"]([^'"]+)['"](?:.*methods\s*=\s*\[([^\]]+)\])?\)/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => {
            const path = match[1];
            const methods = match[2]
              ? match[2].replace(/['"]/g, '').split(',').map(m => m.trim()).join('|')
              : 'GET';
            return `${methods} ${path}`;
          },
        },
        // FastAPI: @app.get('/path'), @router.post('/path')
        {
          pattern: /@(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => `${match[1].toUpperCase()} ${match[2]}`,
        },
        // Django: @api_view(['GET', 'POST'])
        {
          pattern: /@api_view\s*\(\s*\[([^\]]+)\]\s*\)/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => {
            const methods = match[1].replace(/['"]/g, '').split(',').map(m => m.trim()).join('|');
            return methods;
          },
        },
        // Django URL conf: path('users/', views.user_list)
        {
          pattern: /(?:path|re_path)\s*\(\s*r?['"]([^'"]+)['"]/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => `ROUTE ${match[1]}`,
        },
        // Django REST Framework ViewSets
        {
          pattern: /class\s+(\w+(?:ViewSet|View))\s*\(/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => `VIEWSET ${match[1]}`,
        },
      ],
      apiCalls: [
        // requests library
        {
          pattern: /requests\.(get|post|put|patch|delete|head|options)\s*\(\s*['"]([^'"]+)['"]/g,
          patternType: PatternType.API_CALL,
          extractValue: (match) => `${match[1].toUpperCase()} ${match[2]}`,
        },
        // httpx
        {
          pattern: /httpx\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g,
          patternType: PatternType.API_CALL,
          extractValue: (match) => `${match[1].toUpperCase()} ${match[2]}`,
        },
        // urllib
        {
          pattern: /urllib\.request\.urlopen\s*\(\s*['"]([^'"]+)['"]/g,
          patternType: PatternType.API_CALL,
          extractValue: (match) => match[1],
        },
      ],
      databaseReads: [
        // Django ORM reads
        {
          pattern: /(\w+)\.objects\.(filter|get|all|values|values_list|exclude|first|last|count|exists|aggregate)\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: (match) => `${match[1]}.objects.${match[2]}`,
        },
        // SQLAlchemy: session.query(Model)
        {
          pattern: /session\.query\s*\(\s*(\w+)\s*\)/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: (match) => `session.query(${match[1]})`,
        },
        // SQLAlchemy: session.execute(select(...))
        {
          pattern: /session\.execute\s*\(\s*select\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: () => 'session.execute(select(...))',
        },
      ],
      databaseWrites: [
        // Django ORM writes
        {
          pattern: /(\w+)\.objects\.(create|update|delete|bulk_create|bulk_update|get_or_create|update_or_create)\s*\(/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: (match) => `${match[1]}.objects.${match[2]}`,
        },
        // Django model instance save/delete
        {
          pattern: /\.save\s*\(\s*\)/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: () => 'model.save()',
        },
        // SQLAlchemy session writes
        {
          pattern: /session\.(add|delete|merge|commit|flush|bulk_save_objects|bulk_insert_mappings)\s*\(/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: (match) => `session.${match[1]}`,
        },
      ],
      externalServices: [
        // boto3 (AWS SDK for Python)
        {
          pattern: /boto3\.client\s*\(\s*['"](\w+)['"]/g,
          patternType: PatternType.EXTERNAL_SERVICE,
          extractValue: (match) => `AWS ${match[1]}`,
        },
      ],
      envVariables: [
        // os.environ['VAR']
        {
          pattern: /os\.environ\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
        // os.environ.get('VAR')
        {
          pattern: /os\.environ\.get\s*\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
        // os.getenv('VAR')
        {
          pattern: /os\.getenv\s*\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
      ],
    };
  }

  getSkipDirectories(): string[] {
    return ['__pycache__', '.venv', 'venv', '.tox', '.mypy_cache', '.pytest_cache'];
  }

  getTestFilePatterns(): RegExp[] {
    return [/test_.*\.py$/, /.*_test\.py$/, /conftest\.py$/];
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse __all__ list from content if present.
   * Returns null if no __all__ found, or a Set of exported names.
   */
  private parseAllExports(content: string): Set<string> | null {
    const allMatch = content.match(
      /__all__\s*=\s*\[([^\]]*)\]/
    );
    if (!allMatch) return null;

    const names = allMatch[1]
      .split(',')
      .map(n => n.trim().replace(/['"]/g, ''))
      .filter(n => n.length > 0);

    return new Set(names);
  }

  /**
   * Determine whether a name should be marked as exported.
   * If __all__ is defined, only names in __all__ are exported.
   * Otherwise, top-level names not starting with _ are exported.
   */
  private isExportedName(
    name: string,
    isTopLevel: boolean,
    allExports: Set<string> | null
  ): boolean {
    if (allExports !== null) {
      return allExports.has(name);
    }
    // Convention: underscore-prefixed names are private
    if (name.startsWith('_')) {
      return false;
    }
    return isTopLevel;
  }

  /**
   * Find the parent class for a method based on line number and indentation.
   */
  private findParentClass(
    lineNum: number,
    indent: number,
    classRanges: Array<{ name: string; lineStart: number; lineEnd: number; indent: number }>
  ): string | undefined {
    for (const cls of classRanges) {
      if (
        lineNum > cls.lineStart &&
        lineNum <= cls.lineEnd &&
        indent > cls.indent
      ) {
        return cls.name;
      }
    }
    return undefined;
  }

  /**
   * Strip self/cls first parameter from method parameter string.
   */
  private stripSelfParam(params: string): string {
    return params
      .split(',')
      .map(p => p.trim())
      .filter(p => p !== 'self' && p !== 'cls')
      .join(', ');
  }

  /**
   * Convert a 0-indexed line number to a character index in the content.
   */
  private lineToCharIndex(lines: string[], lineIndex: number): number {
    let charIndex = 0;
    for (let i = 0; i < lineIndex; i++) {
      charIndex += lines[i].length + 1; // +1 for newline
    }
    return charIndex;
  }

  /**
   * Join multi-line function signatures into a single line for easier parsing.
   */
  private joinMultiLineSignatures(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const defMatch = line.match(/^(\s*)(?:async\s+)?def\s+\w+\s*\(/);
      if (defMatch && !line.includes('):') && !line.match(/\)\s*->\s*[^:]+\s*:/)) {
        let accumulated = line;
        i++;
        while (i < lines.length) {
          accumulated += ' ' + lines[i].trim();
          if (lines[i].includes('):') || lines[i].match(/\)\s*->\s*[^:]+\s*:/)) {
            break;
          }
          i++;
        }
        result.push(accumulated);
      } else {
        result.push(line);
      }
      i++;
    }

    return result.join('\n');
  }

  /**
   * Build a mapping from joined-content line indices to original content line indices.
   */
  private buildLineMapping(originalContent: string, joinedContent: string): number[] {
    const originalLines = originalContent.split('\n');
    const joinedLines = joinedContent.split('\n');
    const mapping: number[] = [];

    let originalIdx = 0;
    for (let joinedIdx = 0; joinedIdx < joinedLines.length; joinedIdx++) {
      mapping.push(originalIdx);
      if (originalIdx < originalLines.length) {
        const origLine = originalLines[originalIdx];
        const defMatch = origLine.match(/^(\s*)(?:async\s+)?def\s+\w+\s*\(/);
        if (defMatch && !origLine.includes('):') && !origLine.match(/\)\s*->\s*[^:]+\s*:/)) {
          originalIdx++;
          while (originalIdx < originalLines.length) {
            if (originalLines[originalIdx - 1].includes('):') ||
                originalLines[originalIdx - 1].match(/\)\s*->\s*[^:]+\s*:/)) {
              break;
            }
            originalIdx++;
          }
        } else {
          originalIdx++;
        }
      }
    }

    return mapping;
  }

  /**
   * Resolve a Python import target to a file path.
   * Handles relative imports (dot prefixed) and absolute imports.
   */
  private resolveImportTarget(target: string, filePath: string): string {
    const dotMatch = target.match(/^(\.+)(.*)/);
    if (!dotMatch) {
      return target;
    }

    const dots = dotMatch[1].length;
    const remainder = dotMatch[2];

    const pathParts = filePath.split('/');
    pathParts.pop(); // Remove filename

    // Go up directories based on dot count (1 dot = current, 2 dots = parent, etc.)
    for (let i = 1; i < dots; i++) {
      pathParts.pop();
    }

    if (remainder) {
      const remainderParts = remainder.split('.').filter(p => p.length > 0);
      pathParts.push(...remainderParts);
    }

    return pathParts.join('/');
  }
}
