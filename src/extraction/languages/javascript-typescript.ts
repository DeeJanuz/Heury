/**
 * JavaScript/TypeScript Language Extractor
 *
 * Implements the LanguageExtractor interface for JS/TS files.
 * Delegates code unit extraction to the function-extractor module.
 */

import { PatternType } from '@/domain/models/index.js';

import type { LanguageExtractor } from '../language-registry.js';
import type {
  CodeUnitDeclaration,
  FileDependencyInfo,
  PatternRuleSet,
  LanguageComplexityPatterns,
} from '../types.js';
import { extractCodeUnits as jsExtractCodeUnits } from '../function-extractor.js';
import { extractDependencies as jsExtractDependencies } from '../dependency-extractor.js';

/**
 * Language extractor for JavaScript and TypeScript files.
 */
export class JavaScriptTypeScriptExtractor implements LanguageExtractor {
  readonly languageId = 'javascript-typescript';
  readonly extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

  extractCodeUnits(content: string, filePath: string): CodeUnitDeclaration[] {
    return jsExtractCodeUnits(content, filePath);
  }

  extractDependencies(content: string, filePath: string): FileDependencyInfo[] {
    return jsExtractDependencies(content, filePath);
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
        /\.map\s*\(/g,
        /\.filter\s*\(/g,
        /\.reduce\s*\(/g,
        /\.find\s*\(/g,
        /\.some\s*\(/g,
        /\.every\s*\(/g,
        /\bfor\s*\([^)]*\s+of\s+/g,
        /\bfor\s*\([^)]*\s+in\s+/g,
      ],
      errorHandling: [
        /\btry\s*\{/g,
        /\bcatch\s*\(/g,
        /\bfinally\s*\{/g,
      ],
      asyncPatterns: [
        /\basync\s+/g,
        /\bawait\s+/g,
        /new\s+Promise\s*\(/g,
        /\.then\s*\(/g,
        /\.catch\s*\(/g,
        /Promise\.(all|race|allSettled|any)\s*\(/g,
      ],
    };
  }

  getPatternRules(): PatternRuleSet {
    return {
      apiEndpoints: [
        {
          // Express/Fastify/Hono: app.get/post/put/delete('/path', ...)
          pattern: /\b(?:app|router|server|fastify|hono)\.(get|post|put|patch|delete)\s*\(\s*\n?\s*['"`]([^'"`]+)['"`]/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => `${match[1].toUpperCase()} ${match[2]}`,
        },
        {
          // Next.js App Router: export async function GET/POST/etc
          pattern: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => match[1].toUpperCase(),
        },
        {
          // NestJS decorators: @Get/@Post/@Put/@Delete
          pattern: /@(Get|Post|Put|Patch|Delete)\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g,
          patternType: PatternType.API_ENDPOINT,
          extractValue: (match) => {
            const method = match[1].toUpperCase();
            const path = match[2] || '/';
            return `${method} ${path}`;
          },
        },
      ],
      apiCalls: [
        {
          pattern: /\bfetch\s*\(\s*['"`]?(https?:\/\/[^'"`\s,)]+|[^'"`\s,)]+)/g,
          patternType: PatternType.API_CALL,
          extractValue: (match) => match[1].replace(/['"`]/g, ''),
        },
        {
          pattern: /axios\.(get|post|put|patch|delete|request)\s*\(\s*['"`]?([^'"`\s,)]+)/g,
          patternType: PatternType.API_CALL,
          extractValue: (match) => `${match[1].toUpperCase()} ${match[2].replace(/['"`]/g, '')}`,
        },
        {
          pattern: /\bhttp\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g,
          patternType: PatternType.API_CALL,
          extractValue: (match) => `${match[1].toUpperCase()} ${match[2]}`,
        },
      ],
      databaseReads: [
        {
          pattern: /\b\w+\.(\w+)\.find(?:Many|First|Unique|FirstOrThrow|UniqueOrThrow)/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: (match) => `prisma.${match[1]}.find*`,
        },
        {
          pattern: /\b\w+\.(\w+)\.count\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: (match) => `prisma.${match[1]}.count`,
        },
        {
          pattern: /\b\w+\.(\w+)\.aggregate\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: (match) => `prisma.${match[1]}.aggregate`,
        },
        {
          pattern: /Repository.*\.find(?:One|ById|Many)?\s*\(/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: () => 'TypeORM find',
        },
        {
          pattern: /\.find(?:One|ById)?\s*\(\s*\{/g,
          patternType: PatternType.DATABASE_READ,
          extractValue: () => 'Mongoose find',
        },
      ],
      databaseWrites: [
        {
          pattern: /\b\w+\.(\w+)\.(createMany|updateMany|deleteMany|create|update|delete|upsert)/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: (match) => `prisma.${match[1]}.${match[2]}`,
        },
        {
          pattern: /Repository.*\.save\s*\(/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: () => 'TypeORM save',
        },
        {
          pattern: /\.save\s*\(\s*\)/g,
          patternType: PatternType.DATABASE_WRITE,
          extractValue: () => 'Mongoose save',
        },
      ],
      externalServices: [
        {
          pattern: /new\s+(?:AWS\.)?(\w+Client)\s*\(/g,
          patternType: PatternType.EXTERNAL_SERVICE,
          extractValue: (match) => `AWS ${match[1]}`,
        },
        {
          pattern: /sgMail\.(send|sendMultiple)/g,
          patternType: PatternType.EXTERNAL_SERVICE,
          extractValue: (match) => `sendgrid.${match[1]}`,
        },
        {
          pattern: /resend\.(emails|domains)/gi,
          patternType: PatternType.EXTERNAL_SERVICE,
          extractValue: (match) => `resend.${match[1]}`,
        },
      ],
      envVariables: [
        {
          pattern: /process\.env\.([A-Z_][A-Z0-9_]*)/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
        {
          pattern: /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
        {
          pattern: /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
        {
          pattern: /Deno\.env\.get\s*\(\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\)/g,
          patternType: PatternType.ENV_VARIABLE,
          extractValue: (match) => match[1],
        },
      ],
    };
  }

  getSkipDirectories(): string[] {
    return ['node_modules', '.next', 'coverage'];
  }

  getTestFilePatterns(): RegExp[] {
    return [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /__tests__\//];
  }
}
