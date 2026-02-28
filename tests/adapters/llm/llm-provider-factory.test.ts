import { describe, it, expect } from 'vitest';
import { createLlmProvider } from '@/adapters/llm/llm-provider-factory.js';
import { AnthropicProvider } from '@/adapters/llm/anthropic-provider.js';
import { OpenAiProvider } from '@/adapters/llm/openai-provider.js';
import { GeminiProvider } from '@/adapters/llm/gemini-provider.js';
import type { LlmProviderConfig } from '@/domain/ports/llm-provider.js';

describe('createLlmProvider', () => {
  it('should return AnthropicProvider for anthropic config', () => {
    const config: LlmProviderConfig = {
      provider: 'anthropic',
      apiKey: 'test-key',
    };
    const provider = createLlmProvider(config);
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.providerModel).toBe('anthropic/claude-haiku-4-5');
  });

  it('should return OpenAiProvider for openai config', () => {
    const config: LlmProviderConfig = {
      provider: 'openai',
      apiKey: 'test-key',
    };
    const provider = createLlmProvider(config);
    expect(provider).toBeInstanceOf(OpenAiProvider);
    expect(provider.providerModel).toBe('openai/gpt-4o-mini');
  });

  it('should return GeminiProvider for gemini config', () => {
    const config: LlmProviderConfig = {
      provider: 'gemini',
      apiKey: 'test-key',
    };
    const provider = createLlmProvider(config);
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.providerModel).toBe('gemini/gemini-2.0-flash');
  });

  it('should throw for unsupported provider', () => {
    const config = {
      provider: 'unknown' as 'anthropic',
      apiKey: 'test-key',
    };
    expect(() => createLlmProvider(config)).toThrow('Unsupported LLM provider: unknown');
  });

  it('should pass custom model through to provider', () => {
    const config: LlmProviderConfig = {
      provider: 'anthropic',
      apiKey: 'test-key',
      model: 'claude-sonnet-4-20250514',
    };
    const provider = createLlmProvider(config);
    expect(provider.providerModel).toBe('anthropic/claude-sonnet-4-20250514');
  });
});
