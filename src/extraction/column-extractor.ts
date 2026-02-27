/**
 * Column Extractor
 *
 * Extracts column-level access information from database operation patterns.
 * Supports Prisma ORM and raw SQL patterns.
 *
 * Graceful degradation:
 * - Variable indirection -> read/write: ["*"]
 * - No args or empty data objects -> ["*"]
 * - TypeORM/Mongoose patterns -> undefined
 * - Any parsing failure -> undefined
 */

import type { PatternType } from '@/domain/models/index.js';

/**
 * Column-level access information for database operations.
 */
export interface ColumnAccess {
  read?: string[];
  write?: string[];
}

/**
 * Extract column access information from a code snippet containing a database operation.
 *
 * @param code - The code snippet containing the database operation
 * @param patternType - Whether this is a DATABASE_READ or DATABASE_WRITE pattern
 * @returns ColumnAccess if columns could be determined, undefined otherwise
 */
export function extractColumnAccess(
  code: string,
  patternType: PatternType,
): ColumnAccess | undefined {
  // Detect Prisma patterns
  const prismaMatch = code.match(/\b\w+\.(\w+)\.(findMany|findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow|count|aggregate|create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/);
  if (prismaMatch) {
    return extractPrismaColumns(code, prismaMatch);
  }

  // Detect SQL patterns
  if (/\bSELECT\s+/i.test(code)) {
    return extractSqlSelectColumns(code);
  }
  if (/\bINSERT\s+INTO\s+/i.test(code)) {
    return extractSqlInsertColumns(code);
  }
  if (/\bUPDATE\s+\w+\s+SET\b/i.test(code)) {
    return extractSqlUpdateColumns(code);
  }
  if (/\bDELETE\s+FROM\s+/i.test(code)) {
    return extractSqlDeleteColumns(code);
  }

  return undefined;
}

/**
 * Skip past a string literal starting at the given quote character.
 */
function skipString(code: string, quoteIndex: number): number {
  const quote = code[quoteIndex];
  let i = quoteIndex + 1;

  if (quote === '`') {
    while (i < code.length) {
      if (code[i] === '\\') { i += 2; continue; }
      if (code[i] === '`') return i + 1;
      if (code[i] === '$' && code[i + 1] === '{') {
        i += 2;
        let depth = 1;
        while (i < code.length && depth > 0) {
          if (code[i] === '{') depth++;
          else if (code[i] === '}') depth--;
          if (depth > 0) i++;
        }
        i++;
        continue;
      }
      i++;
    }
  } else {
    while (i < code.length) {
      if (code[i] === '\\') { i += 2; continue; }
      if (code[i] === quote) return i + 1;
      i++;
    }
  }

  return i;
}

/**
 * Extract content between balanced brackets starting from a position.
 */
export function extractBracketContent(
  code: string,
  startIndex: number,
  openChar: string = '(',
  closeChar: string = ')',
): string | null {
  let openIndex = -1;
  const searchLimit = Math.min(startIndex + 200, code.length);

  for (let i = startIndex; i < searchLimit; i++) {
    if (code[i] === openChar) {
      openIndex = i;
      break;
    }
  }

  if (openIndex === -1) return null;

  let depth = 1;
  let i = openIndex + 1;

  while (i < code.length && depth > 0) {
    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(code, i);
      continue;
    }
    if (ch === openChar) depth++;
    else if (ch === closeChar) depth--;
    if (depth > 0) i++;
  }

  if (depth !== 0) return null;

  return code.slice(openIndex + 1, i);
}

/**
 * Extract top-level keys from an object literal body.
 */
export function extractObjectKeys(objectLiteral: string, propertyName: string): string[] {
  const propRegex = new RegExp(`(?:^|[,{\\s])${propertyName}\\s*:`);
  const propMatch = propRegex.exec(objectLiteral);
  if (!propMatch) return [];

  const colonPos = objectLiteral.indexOf(':', propMatch.index + propMatch[0].indexOf(propertyName));
  if (colonPos === -1) return [];

  const valueContent = extractBracketContent(objectLiteral, colonPos + 1, '{', '}');
  if (valueContent === null) return [];

  return extractTopLevelKeys(valueContent);
}

function extractTopLevelKeys(content: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let i = 0;

  while (i < content.length) {
    const ch = content[i];

    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(content, i);
      continue;
    }

    if (ch === '{' || ch === '(' || ch === '[') { depth++; i++; continue; }
    if (ch === '}' || ch === ')' || ch === ']') { depth--; i++; continue; }

    if (depth === 0) {
      if (/[\s,]/.test(ch)) { i++; continue; }

      if (content.slice(i, i + 3) === '...') {
        i += 3;
        while (i < content.length && depth === 0) {
          const c = content[i];
          if (c === '{' || c === '(' || c === '[') depth++;
          else if (c === '}' || c === ')' || c === ']') depth--;
          else if (c === ',' && depth === 0) break;
          i++;
        }
        continue;
      }

      const keyMatch = content.slice(i).match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (keyMatch) {
        const key = keyMatch[1];
        i += key.length;

        const afterKey = content.slice(i).match(/^\s*(:|\s*[,}\n]|$)/);
        if (afterKey) {
          keys.push(key);
          if (afterKey[1] === ':') {
            i += afterKey[0].indexOf(':') + 1;
            while (i < content.length) {
              const vc = content[i];
              if (vc === '"' || vc === "'" || vc === '`') {
                i = skipString(content, i);
                continue;
              }
              if (vc === '{' || vc === '(' || vc === '[') depth++;
              else if (vc === '}' || vc === ')' || vc === ']') depth--;
              else if (vc === ',' && depth === 0) break;
              i++;
            }
          }
        } else {
          i++;
        }
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return keys.filter(
    (k) => k !== 'true' && k !== 'false' && k !== 'null' && k !== 'undefined',
  );
}

/**
 * Extract columns from Prisma operations.
 */
function extractPrismaColumns(
  code: string,
  prismaMatch: RegExpMatchArray,
): ColumnAccess | undefined {
  const method = prismaMatch[2];
  const isReadMethod =
    method.startsWith('find') || method === 'count' || method === 'aggregate';

  const argContent = extractBracketContent(code, prismaMatch.index! + prismaMatch[0].length - 1, '(', ')');

  if (argContent === null || argContent.trim() === '') {
    return isReadMethod ? { read: ['*'] } : { write: ['*'] };
  }

  const trimmed = argContent.trim();
  if (!trimmed.startsWith('{')) {
    return isReadMethod ? { read: ['*'] } : { write: ['*'] };
  }

  const normalizedMethod = method.startsWith('find') ? 'find' : method;

  switch (normalizedMethod) {
    case 'find':
    case 'count':
    case 'aggregate': {
      const selectKeys = extractObjectKeys(trimmed, 'select');
      const whereKeys = extractObjectKeys(trimmed, 'where');
      if (selectKeys.length > 0 && whereKeys.length > 0) {
        const combined = new Set([...selectKeys, ...whereKeys]);
        return { read: [...combined] };
      }
      if (selectKeys.length > 0) return { read: selectKeys };
      return { read: ['*'] };
    }

    case 'create':
    case 'createMany': {
      const dataKeys = extractObjectKeys(trimmed, 'data');
      return dataKeys.length > 0 ? { write: dataKeys } : { write: ['*'] };
    }

    case 'update':
    case 'updateMany': {
      const whereKeys = extractObjectKeys(trimmed, 'where');
      const dataKeys = extractObjectKeys(trimmed, 'data');
      const result: ColumnAccess = {};
      if (whereKeys.length > 0) result.read = whereKeys;
      if (dataKeys.length > 0) result.write = dataKeys;
      if (!result.write) result.write = ['*'];
      return result;
    }

    case 'upsert': {
      const whereKeys = extractObjectKeys(trimmed, 'where');
      const createKeys = extractObjectKeys(trimmed, 'create');
      const updateKeys = extractObjectKeys(trimmed, 'update');
      const result: ColumnAccess = {};
      if (whereKeys.length > 0) result.read = whereKeys;
      const writeSet = new Set([...createKeys, ...updateKeys]);
      if (writeSet.size > 0) result.write = [...writeSet];
      if (!result.write) result.write = ['*'];
      return result;
    }

    case 'delete':
    case 'deleteMany': {
      const whereKeys = extractObjectKeys(trimmed, 'where');
      return whereKeys.length > 0 ? { read: whereKeys } : undefined;
    }

    default:
      return undefined;
  }
}

/**
 * Extract columns from SQL SELECT statements.
 */
function extractSqlSelectColumns(code: string): ColumnAccess | undefined {
  const selectMatch = code.match(/SELECT\s+([\s\S]+?)\s+FROM\s/i);
  if (!selectMatch) return { read: ['*'] };

  const columnList = selectMatch[1].trim();
  if (columnList === '*') return { read: ['*'] };

  const columns = columnList.split(',').map((col) => {
    const trimmed = col.trim();
    const asMatch = trimmed.match(/^(.+?)\s+(?:AS\s+)?(\w+)$/i);
    if (asMatch) {
      const source = asMatch[1].trim();
      const dotParts = source.split('.');
      return dotParts[dotParts.length - 1].trim();
    }
    const dotParts = trimmed.split('.');
    return dotParts[dotParts.length - 1].trim();
  }).filter((col) => col.length > 0 && col !== '*');

  return columns.length > 0 ? { read: columns } : { read: ['*'] };
}

/**
 * Extract columns from SQL INSERT INTO statements.
 */
function extractSqlInsertColumns(code: string): ColumnAccess | undefined {
  const insertContent = extractBracketContent(code, 0, '(', ')');
  if (!insertContent) return { write: ['*'] };

  const columns = insertContent
    .split(',')
    .map((col) => col.trim().replace(/["`[\]]/g, ''))
    .filter((col) => col.length > 0);

  return columns.length > 0 ? { write: columns } : { write: ['*'] };
}

/**
 * Extract columns from SQL UPDATE SET statements.
 */
function extractSqlUpdateColumns(code: string): ColumnAccess | undefined {
  const setMatch = code.match(/SET\s+([\s\S]+?)(?:\s+WHERE\s|$)/i);
  const writeColumns: string[] = [];

  if (setMatch) {
    const assignments = setMatch[1].split(',');
    for (const assignment of assignments) {
      const eqMatch = assignment.trim().match(/^["`]?(\w+)["`]?\s*=/);
      if (eqMatch) writeColumns.push(eqMatch[1]);
    }
  }

  const whereMatch = code.match(/WHERE\s+([\s\S]+?)(?:;|\s*$|\s+ORDER|\s+LIMIT)/i);
  const readColumns = whereMatch ? extractWhereColumns(whereMatch[1]) : [];

  const result: ColumnAccess = {};
  if (readColumns.length > 0) result.read = readColumns;
  if (writeColumns.length > 0) result.write = writeColumns;
  if (!result.write) result.write = ['*'];

  return result;
}

/**
 * Extract columns from SQL DELETE FROM statements.
 */
function extractSqlDeleteColumns(code: string): ColumnAccess | undefined {
  const whereMatch = code.match(/WHERE\s+([\s\S]+?)(?:;|\s*$|\s+ORDER|\s+LIMIT)/i);
  if (!whereMatch) return undefined;

  const columns = extractWhereColumns(whereMatch[1]);
  return columns.length > 0 ? { read: columns } : undefined;
}

/**
 * Extract column names referenced in a WHERE clause.
 */
function extractWhereColumns(whereClause: string): string[] {
  const columns: string[] = [];
  const colRegex = /["`]?(\w+)["`]?\s*(?:=|!=|<>|>=|<=|>|<|LIKE|IN|IS|BETWEEN)/gi;
  let match;

  while ((match = colRegex.exec(whereClause)) !== null) {
    const col = match[1];
    if (!['AND', 'OR', 'NOT', 'NULL', 'TRUE', 'FALSE'].includes(col.toUpperCase())) {
      columns.push(col);
    }
  }

  return [...new Set(columns)];
}
