import type { ILlmProvider, LlmProviderConfig } from '@/domain/ports/llm-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { OpenAiProvider } from './openai-provider.js';
import { GeminiProvider } from './gemini-provider.js';

export function createLlmProvider(config: LlmProviderConfig): ILlmProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAiProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    default:
      throw new Error(`Unsupported LLM provider: ${(config as LlmProviderConfig).provider}`);
  }
}
