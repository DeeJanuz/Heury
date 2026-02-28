import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from '@/adapters/llm/gemini-provider.js';
import type { LlmProviderConfig } from '@/domain/ports/llm-provider.js';

function makeConfig(overrides: Partial<LlmProviderConfig> = {}): LlmProviderConfig {
  return {
    provider: 'gemini',
    apiKey: 'test-api-key',
    ...overrides,
  };
}

describe('GeminiProvider', () => {
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
      const provider = new GeminiProvider(makeConfig());
      expect(provider.providerModel).toBe('gemini/gemini-2.0-flash');
    });

    it('should set providerModel with custom model', () => {
      const provider = new GeminiProvider(makeConfig({ model: 'gemini-pro' }));
      expect(provider.providerModel).toBe('gemini/gemini-pro');
    });
  });

  describe('generateSummary', () => {
    it('should call Gemini API with correct URL and body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Summary response' }] } }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new GeminiProvider(makeConfig());
      await provider.generateSummary('Analyze this code');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=test-api-key',
      );
      expect(options.method).toBe('POST');

      const headers = options.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body as string);
      expect(body.contents).toEqual([{ parts: [{ text: 'Analyze this code' }] }]);
      expect(body.generationConfig.maxOutputTokens).toBe(300);
    });

    it('should use custom baseUrl when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'response' }] } }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new GeminiProvider(makeConfig({ baseUrl: 'https://custom.gemini.com' }));
      await provider.generateSummary('prompt');

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain('https://custom.gemini.com/');
    });

    it('should use custom maxTokens when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'response' }] } }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new GeminiProvider(makeConfig({ maxTokens: 800 }));
      await provider.generateSummary('prompt');

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.generationConfig.maxOutputTokens).toBe(800);
    });

    it('should return text from successful response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'This function processes user data.' }] } }],
        }),
      }));

      const provider = new GeminiProvider(makeConfig());
      const result = await provider.generateSummary('prompt');
      expect(result).toBe('This function processes user data.');
    });

    it('should return empty string when no candidates in response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [],
        }),
      }));

      const provider = new GeminiProvider(makeConfig());
      const result = await provider.generateSummary('prompt');
      expect(result).toBe('');
    });

    it('should throw on API error response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'API key not valid',
      }));

      const provider = new GeminiProvider(makeConfig());
      await expect(provider.generateSummary('prompt')).rejects.toThrow(
        'Gemini API error (403): API key not valid',
      );
    });

    it('should throw on API error with status 429', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      }));

      const provider = new GeminiProvider(makeConfig());
      await expect(provider.generateSummary('prompt')).rejects.toThrow(
        'Gemini API error (429): Rate limit exceeded',
      );
    });
  });
});
