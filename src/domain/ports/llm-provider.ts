export interface LlmProviderConfig {
  readonly provider: 'anthropic' | 'openai' | 'gemini';
  readonly apiKey: string;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly baseUrl?: string;
}

export interface ILlmProvider {
  generateSummary(prompt: string): Promise<string>;
  readonly providerModel: string;
}
