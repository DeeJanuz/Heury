/**
 * Cross-Language Pattern Rules
 *
 * These patterns detect SQL operations and external services
 * regardless of the host programming language. They work on embedded SQL
 * strings and universal SDK naming conventions.
 *
 * Language-specific patterns (e.g., Prisma for JS/TS, SQLAlchemy for Python)
 * are defined in each language's extractor, not here.
 */

import { PatternType } from '@/domain/models/index.js';

/**
 * A shared pattern rule that works across languages.
 */
export interface SharedPatternRule {
  readonly pattern: RegExp;
  readonly patternType: PatternType;
  readonly value?: string;
}

/**
 * SQL SELECT patterns detected as DATABASE_READ.
 */
export const SQL_READ_PATTERNS: SharedPatternRule[] = [
  {
    pattern: /\bSELECT\s+.+?\s+FROM\s+(\w+)/gi,
    patternType: PatternType.DATABASE_READ,
    value: 'SELECT FROM',
  },
];

/**
 * SQL write patterns detected as DATABASE_WRITE.
 */
export const SQL_WRITE_PATTERNS: SharedPatternRule[] = [
  {
    pattern: /\bINSERT\s+INTO\s+(\w+)/gi,
    patternType: PatternType.DATABASE_WRITE,
    value: 'INSERT INTO',
  },
  {
    pattern: /\bUPDATE\s+(\w+)\s+SET/gi,
    patternType: PatternType.DATABASE_WRITE,
    value: 'UPDATE',
  },
  {
    pattern: /\bDELETE\s+FROM\s+(\w+)/gi,
    patternType: PatternType.DATABASE_WRITE,
    value: 'DELETE FROM',
  },
];

/**
 * External service SDK patterns detected as EXTERNAL_SERVICE.
 */
export const EXTERNAL_SERVICE_PATTERNS: SharedPatternRule[] = [
  {
    pattern: /stripe\.(checkout|customers|subscriptions|invoices|paymentIntents|paymentMethods)/gi,
    patternType: PatternType.EXTERNAL_SERVICE,
    value: 'stripe',
  },
  {
    pattern: /openai\.(chat|completions|embeddings|images|audio)/gi,
    patternType: PatternType.EXTERNAL_SERVICE,
    value: 'openai',
  },
  {
    pattern: /twilio\.(messages|calls|verify)/gi,
    patternType: PatternType.EXTERNAL_SERVICE,
    value: 'twilio',
  },
  {
    pattern: /firebase\.(\w+)\s*\(/g,
    patternType: PatternType.EXTERNAL_SERVICE,
    value: 'firebase',
  },
];
