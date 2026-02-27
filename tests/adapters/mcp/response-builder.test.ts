import { describe, it, expect } from 'vitest';
import { stripDefaults, buildErrorResponse, buildToolResponse } from '@/adapters/mcp/response-builder.js';

describe('response-builder', () => {
  describe('stripDefaults', () => {
    it('should remove null, undefined, and empty arrays', () => {
      const input = {
        name: 'test',
        value: null,
        missing: undefined,
        items: [],
        nested: { keep: 'yes', remove: null, empty: [] },
      };

      const result = stripDefaults(input);

      expect(result).toEqual({
        name: 'test',
        nested: { keep: 'yes' },
      });
    });

    it('should preserve non-empty values including false and zero', () => {
      const input = {
        name: 'test',
        count: 0,
        active: false,
        items: [1, 2],
        nested: { value: '' },
      };

      const result = stripDefaults(input);

      expect(result).toEqual({
        name: 'test',
        count: 0,
        active: false,
        items: [1, 2],
        nested: { value: '' },
      });
    });
  });

  describe('buildErrorResponse', () => {
    it('should return response with isError flag and message', () => {
      const result = buildErrorResponse('Something went wrong');

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Something went wrong' }],
        isError: true,
      });
    });
  });

  describe('buildToolResponse', () => {
    it('should include data and meta with result count', () => {
      const data = [{ id: '1', name: 'test' }];
      const result = buildToolResponse(data);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toEqual(data);
      expect(parsed.meta.result_count).toBe(1);
    });

    it('should include pagination meta when provided', () => {
      const data = [{ id: '1' }];
      const result = buildToolResponse(data, {
        resultCount: 1,
        totalCount: 50,
        hasMore: true,
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.meta.result_count).toBe(1);
      expect(parsed.meta.total_count).toBe(50);
      expect(parsed.meta.has_more).toBe(true);
    });

    it('should include context for empty results', () => {
      const result = buildToolResponse([], {
        context: { reason: 'no_matches', detail: 'Try a broader query' },
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toEqual([]);
      expect(parsed.meta.result_count).toBe(0);
      expect(parsed.meta.context).toEqual({
        reason: 'no_matches',
        detail: 'Try a broader query',
      });
    });
  });
});
