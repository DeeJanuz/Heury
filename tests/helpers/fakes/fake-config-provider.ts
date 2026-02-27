import type { IConfigProvider, HeuryConfig } from '@/domain/ports/index.js';

export class FakeConfigProvider implements IConfigProvider {
  private config: HeuryConfig | undefined;

  async load(): Promise<HeuryConfig> {
    return this.config ?? this.getDefault();
  }

  async save(config: HeuryConfig): Promise<void> {
    this.config = { ...config };
  }

  getDefault(): HeuryConfig {
    return {
      rootDir: '.',
      outputDir: '.heury',
      include: ['**/*.ts', '**/*.js', '**/*.py', '**/*.go', '**/*.java', '**/*.rs', '**/*.cs'],
      exclude: ['node_modules', 'dist', '.git', 'vendor', 'target'],
      embedding: {
        provider: 'local',
      },
    };
  }
}
