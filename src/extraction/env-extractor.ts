/**
 * Environment Variable Extractor
 *
 * Parses .env.example and similar files to extract environment variable declarations.
 * Extracts variable names, descriptions from comments, and detects if defaults exist.
 */

/**
 * Represents an extracted environment variable.
 */
export interface EnvVariable {
  readonly name: string;
  readonly description?: string;
  readonly hasDefault: boolean;
  readonly lineNumber: number;
}

/**
 * Regex for environment variable lines: VARIABLE_NAME=value or VARIABLE_NAME=
 */
const ENV_VAR_PATTERN = /^([A-Z][A-Z0-9_]*)=(.*)$/;

function isComment(line: string): boolean {
  return line.trimStart().startsWith('#');
}

function extractCommentText(line: string): string {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('#')) {
    return trimmed.slice(1).trim();
  }
  return '';
}

function hasDefaultValue(value: string | undefined): boolean {
  if (value === undefined) return false;
  const unquoted = value.replace(/^["']|["']$/g, '').trim();
  return unquoted.length > 0;
}

/**
 * Extract environment variables from .env file content.
 *
 * @param content - The .env file content
 * @returns Array of extracted environment variables
 */
export function extractEnvVariables(content: string): EnvVariable[] {
  const lines = content.split('\n');
  const variables: EnvVariable[] = [];
  let pendingComments: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    if (line.trim() === '') {
      pendingComments = [];
      continue;
    }

    if (isComment(line)) {
      const commentText = extractCommentText(line);
      if (commentText) {
        pendingComments.push(commentText);
      }
      continue;
    }

    const match = line.match(ENV_VAR_PATTERN);
    if (match) {
      const name = match[1];
      const value = match[2];
      const description =
        pendingComments.length > 0 ? pendingComments.join(' ') : undefined;

      variables.push({
        name,
        description,
        hasDefault: hasDefaultValue(value),
        lineNumber,
      });

      pendingComments = [];
    } else {
      pendingComments = [];
    }
  }

  return variables;
}

/**
 * Check if a file path is an env example file that should be processed.
 *
 * @param filePath - The file path to check
 * @returns true if this is an env example file
 */
export function isEnvExampleFile(filePath: string): boolean {
  const name = filePath.split('/').pop()?.toLowerCase() || '';

  return (
    name === '.env.example' ||
    name === '.env.sample' ||
    name === '.env.template' ||
    name === 'env.example' ||
    name === 'env.sample' ||
    name === '.env.local.example' ||
    name === '.env.development.example' ||
    name === '.env.production.example'
  );
}
