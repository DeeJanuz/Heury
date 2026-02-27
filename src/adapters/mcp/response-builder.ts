/**
 * MCP response builder utilities for token-efficient responses.
 */

/** Strip empty/null/undefined/false values for token efficiency. */
export function stripDefaults(obj: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    return obj.map(stripDefaults);
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      const stripped = stripDefaults(value);
      if (stripped !== undefined) {
        result[key] = stripped;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return obj;
}

/** Build an error response. */
export function buildErrorResponse(
  message: string,
): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

/** Build a tool response with data and meta. */
export function buildToolResponse(
  data: unknown,
  options?: {
    resultCount?: number;
    totalCount?: number;
    hasMore?: boolean;
    context?: { reason: string; detail?: string };
  },
): { content: Array<{ type: 'text'; text: string }> } {
  const isArray = Array.isArray(data);
  const resultCount = options?.resultCount ?? (isArray ? data.length : 1);

  const meta: Record<string, unknown> = {
    result_count: resultCount,
  };

  if (options?.totalCount !== undefined) {
    meta.total_count = options.totalCount;
  }
  if (options?.hasMore !== undefined) {
    meta.has_more = options.hasMore;
  }
  if (options?.context !== undefined) {
    meta.context = options.context;
  }

  const response = { data, meta };

  return {
    content: [{ type: 'text', text: JSON.stringify(response) }],
  };
}
