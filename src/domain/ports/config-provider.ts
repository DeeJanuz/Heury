export interface HeuryConfig {
  rootDir: string;
  outputDir: string;
  include: string[];
  exclude: string[];
  embedding: {
    provider: 'local' | 'openai';
    model?: string;
    apiKey?: string;
  };
}

export interface IConfigProvider {
  load(): Promise<HeuryConfig>;
  save(config: HeuryConfig): Promise<void>;
  getDefault(): HeuryConfig;
}
