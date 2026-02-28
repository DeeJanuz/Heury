import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAiProvider } from '@/adapters/llm/openai-provider.js';
import type { LlmProviderConfig } from '@/domain/ports/llm-provider.js';

function makeConfig(overrides: Partial<LlmProviderConfig> = {}): LlmProviderConfig {
  return {
    provider: 'openai',
    apiKey: 'test-api-key',
    ...overrides,
  };
}

describe('OpenAiProvider', () => {
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
      const provider = new OpenAiProvider(makeConfig());
      expect(provider.providerModel).toBe('openai/gpt-4o-mini');
    });

    it('should set providerModel with custom model', () => {
      const provider = new OpenAiProvider(makeConfig({ model: 'gpt-4o' }));
      expect(provider.providerModel).toBe('openai/gpt-4o');
    });
  });

  describe('generateSummary', () => {
    it('should call OpenAI API with correct headers and body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Summary response' } }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAiProvider(makeConfig());
      await provider.generateSummary('Analyze this code');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(options.method).toBe('POST');

      const headers = options.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Authorization']).toBe('Bearer test-api-key');

      const body = JSON.parse(options.body as string);
      expect(body.model).toBe('gpt-4o-mini');
      expect(body.max_tokens).toBe(300);
      expect(body.messages).toEqual([{ role: 'user', content: 'Analyze this code' }]);
    });

    it('should use custom baseUrl when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAiProvider(makeConfig({ baseUrl: 'https://custom.openai.com' }));
      await provider.generateSummary('prompt');

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe('https://custom.openai.com/v1/chat/completions');
    });

    it('should use custom maxTokens when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAiProvider(makeConfig({ maxTokens: 1000 }));
      await provider.generateSummary('prompt');

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.max_tokens).toBe(1000);
    });

    it('should return content from successful response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'This function processes user data.' } }],
        }),
      }));

      const provider = new OpenAiProvider(makeConfig());
      const result = await provider.generateSummary('prompt');
      expect(result).toBe('This function processes user data.');
    });

    it('should return empty string when no choices in response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [],
        }),
      }));

      const provider = new OpenAiProvider(makeConfig());
      const result = await provider.generateSummary('prompt');
      expect(result).toBe('');
    });

    it('should throw on API error response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      }));

      const provider = new OpenAiProvider(makeConfig());
      await expect(provider.generateSummary('prompt')).rejects.toThrow(
        'OpenAI API error (401): Invalid API key',
      );
    });

    it('should throw on API error with status 429', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      }));

      const provider = new OpenAiProvider(makeConfig());
      await expect(provider.generateSummary('prompt')).rejects.toThrow(
        'OpenAI API error (429): Rate limit exceeded',
      );
    });
  });
});
