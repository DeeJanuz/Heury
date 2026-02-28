import type { ILlmProvider, LlmProviderConfig } from '@/domain/ports/llm-provider.js';

export class GeminiProvider implements ILlmProvider {
  readonly providerModel: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly baseUrl: string;

  constructor(config: LlmProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gemini-2.0-flash';
    this.maxTokens = config.maxTokens ?? 300;
    this.baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com';
    this.providerModel = `gemini/${this.model}`;
  }

  async generateSummary(prompt: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: this.maxTokens },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> };
      }>;
    };
    return data.candidates[0]?.content?.parts[0]?.text ?? '';
  }
}
