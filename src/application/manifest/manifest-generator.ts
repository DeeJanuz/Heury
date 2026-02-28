import type {
  ICodeUnitRepository,
  IFileDependencyRepository,
  IEnvVariableRepository,
  IFileSystem,
} from '@/domain/ports/index.js';
import { allocateBudget } from './token-budgeter.js';
import { generateModulesManifest } from './modules-generator.js';
import { generatePatternsManifest } from './patterns-generator.js';
import { generateDependenciesManifest } from './dependencies-generator.js';
import { generateHotspotsManifest } from './hotspots-generator.js';

const DEFAULT_TOKEN_BUDGET = 5000;

export interface ManifestDependencies {
  readonly codeUnitRepo: ICodeUnitRepository;
  readonly dependencyRepo: IFileDependencyRepository;
  readonly envVarRepo: IEnvVariableRepository;
  readonly fileSystem: IFileSystem;
}

export interface ManifestOptions {
  readonly outputDir: string;
  readonly totalTokenBudget?: number;
}

/**
 * Generate all 4 manifest files and write them to the output directory.
 */
export async function generateManifests(
  deps: ManifestDependencies,
  options: ManifestOptions,
): Promise<void> {
  const totalBudget = options.totalTokenBudget ?? DEFAULT_TOKEN_BUDGET;
  const budget = allocateBudget(totalBudget);
  const outputDir = options.outputDir;

  // Ensure output directory exists
  await deps.fileSystem.mkdir(outputDir);

  const modules = generateModulesManifest(deps.codeUnitRepo, deps.dependencyRepo, budget.modules);
  const patterns = generatePatternsManifest(
    deps.codeUnitRepo,
    deps.envVarRepo,
    budget.patterns,
  );
  const dependencies = generateDependenciesManifest(
    deps.dependencyRepo,
    budget.dependencies,
  );
  const hotspots = generateHotspotsManifest(deps.codeUnitRepo, budget.hotspots);

  await Promise.all([
    deps.fileSystem.writeFile(`${outputDir}/MODULES.md`, modules),
    deps.fileSystem.writeFile(`${outputDir}/PATTERNS.md`, patterns),
    deps.fileSystem.writeFile(`${outputDir}/DEPENDENCIES.md`, dependencies),
    deps.fileSystem.writeFile(`${outputDir}/HOTSPOTS.md`, hotspots),
  ]);
}
