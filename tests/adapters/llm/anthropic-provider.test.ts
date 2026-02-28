import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicProvider } from '@/adapters/llm/anthropic-provider.js';
import type { LlmProviderConfig } from '@/domain/ports/llm-provider.js';

function makeConfig(overrides: Partial<LlmProviderConfig> = {}): LlmProviderConfig {
  return {
    provider: 'anthropic',
    apiKey: 'test-api-key',
    ...overrides,
  };
}

describe('AnthropicProvider', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should set providerModel with default model', () => {
      const provider = new AnthropicProvider(makeConfig());
      expect(provider.providerModel).toBe('anthropic/claude-haiku-4-5');
    });

    it('should set providerModel with custom model', () => {
      const provider = new AnthropicProvider(makeConfig({ model: 'claude-sonnet-4-20250514' }));
      expect(provider.providerModel).toBe('anthropic/claude-sonnet-4-20250514');
    });
  });

  describe('generateSummary', () => {
    it('should call Anthropic API with correct headers and body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Summary response' }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new AnthropicProvider(makeConfig());
      await provider.generateSummary('Analyze this code');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(options.method).toBe('POST');

      const headers = options.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['x-api-key']).toBe('test-api-key');
      expect(headers['anthropic-version']).toBe('2023-06-01');

      const body = JSON.parse(options.body as string);
      expect(body.model).toBe('claude-haiku-4-5');
      expect(body.max_tokens).toBe(300);
      expect(body.messages).toEqual([{ role: 'user', content: 'Analyze this code' }]);
    });

    it('should use custom baseUrl when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'response' }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new AnthropicProvider(makeConfig({ baseUrl: 'https://custom.api.com' }));
      await provider.generateSummary('prompt');

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe('https://custom.api.com/v1/messages');
    });

    it('should use custom maxTokens when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'response' }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new AnthropicProvider(makeConfig({ maxTokens: 500 }));
      await provider.generateSummary('prompt');

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.max_tokens).toBe(500);
    });

    it('should return text from successful response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'This function processes user data.' }],
        }),
      }));

      const provider = new AnthropicProvider(makeConfig());
      const result = await provider.generateSummary('prompt');
      expect(result).toBe('This function processes user data.');
    });

    it('should return empty string when no text block in response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'tool_use', id: 'tool-1' }],
        }),
      }));

      const provider = new AnthropicProvider(makeConfig());
      const result = await provider.generateSummary('prompt');
      expect(result).toBe('');
    });

    it('should throw on API error response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      }));

      const provider = new AnthropicProvider(makeConfig());
      await expect(provider.generateSummary('prompt')).rejects.toThrow(
        'Anthropic API error (401): Invalid API key',
      );
    });

    it('should throw on API error with status 429', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      }));

      const provider = new AnthropicProvider(makeConfig());
      await expect(provider.generateSummary('prompt')).rejects.toThrow(
        'Anthropic API error (429): Rate limit exceeded',
      );
    });
  });
});
