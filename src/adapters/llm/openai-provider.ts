import type { ILlmProvider, LlmProviderConfig } from '@/domain/ports/llm-provider.js';

export class OpenAiProvider implements ILlmProvider {
  readonly providerModel: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly baseUrl: string;

  constructor(config: LlmProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gpt-4o-mini';
    this.maxTokens = config.maxTokens ?? 300;
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com';
    this.providerModel = `openai/${this.model}`;
  }

  async generateSummary(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content ?? '';
  }
}
