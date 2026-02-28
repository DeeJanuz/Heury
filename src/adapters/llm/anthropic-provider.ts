import type { ILlmProvider, LlmProviderConfig } from '@/domain/ports/llm-provider.js';

export class AnthropicProvider implements ILlmProvider {
  readonly providerModel: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly baseUrl: string;

  constructor(config: LlmProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'claude-haiku-4-5';
    this.maxTokens = config.maxTokens ?? 300;
    this.baseUrl = config.baseUrl ?? 'https://api.anthropic.com';
    this.providerModel = `anthropic/${this.model}`;
  }

  async generateSummary(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const textBlock = data.content.find((c) => c.type === 'text');
    return textBlock?.text ?? '';
  }
}
