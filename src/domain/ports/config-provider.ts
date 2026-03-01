export interface HeuryConfig {
  rootDir: string;
  outputDir: string;
  include: string[];
  exclude: string[];
  manifestTokenBudget?: number;
}

export interface IConfigProvider {
  load(): Promise<HeuryConfig>;
  save(config: HeuryConfig): Promise<void>;
  getDefault(): HeuryConfig;
}
