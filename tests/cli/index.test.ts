import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

/**
 * Tests for CLI command registration in index.ts.
 *
 * We test that the CLI program is properly configured by importing
 * and creating a program the same way index.ts does, then verifying
 * commands and options are registered.
 */

// Mock all command handlers to prevent execution
vi.mock('@/cli/commands/init.js', () => ({
  initCommand: vi.fn(),
}));
vi.mock('@/cli/commands/analyze.js', () => ({
  analyzeCommand: vi.fn(),
}));
vi.mock('@/cli/commands/serve.js', () => ({
  serveCommand: vi.fn(),
}));
vi.mock('@/cli/commands/hook.js', () => ({
  hookInstallCommand: vi.fn(),
  hookRemoveCommand: vi.fn(),
}));

/**
 * Build a program matching the CLI's index.ts structure.
 * We reconstruct it here because index.ts calls program.parse() at module level.
 */
async function buildProgram(): Promise<Command> {
  const { analyzeCommand } = await import('@/cli/commands/analyze.js');
  const { initCommand } = await import('@/cli/commands/init.js');
  const { serveCommand } = await import('@/cli/commands/serve.js');
  const { hookInstallCommand, hookRemoveCommand } = await import(
    '@/cli/commands/hook.js'
  );

  const program = new Command();

  program
    .name('heury')
    .description('Local-first codebase analysis tool for LLM discovery')
    .version('0.1.0')
    .exitOverride();

  program
    .command('init')
    .description('Initialize heury in the current directory')
    .option('-d, --dir <directory>', 'Target directory', '.')
    .action((options) => initCommand(options));

  program
    .command('analyze')
    .description('Analyze the codebase')
    .option('-d, --dir <directory>', 'Project directory', '.')
    .option('--full', 'Force full re-analysis', false)
    .option('--incremental', 'Only analyze files changed in the last commit')
    .option('--enrich', 'Enrich code units with LLM summaries', false)
    .option('--enrich-force', 'Re-enrich all units even if summaries exist', false)
    .action((options) => analyzeCommand(options));

  const hook = program
    .command('hook')
    .description('Manage git hooks');

  hook
    .command('install')
    .description('Install post-commit hook for incremental analysis')
    .option('-d, --dir <directory>', 'Project root directory', '.')
    .action((options) => hookInstallCommand(options));

  hook
    .command('remove')
    .description('Remove post-commit hook')
    .option('-d, --dir <directory>', 'Project root directory', '.')
    .action((options) => hookRemoveCommand(options));

  program
    .command('serve')
    .description('Start the MCP server')
    .option('-d, --dir <directory>', 'Project directory', '.')
    .option('--transport <type>', 'Transport type (stdio|http)', 'stdio')
    .action((options) => serveCommand(options));

  return program;
}

describe('CLI index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register the analyze command with --incremental option', async () => {
    const { analyzeCommand } = await import('@/cli/commands/analyze.js');
    const program = await buildProgram();

    program.parse(['analyze', '--incremental'], {
      from: 'user',
    });

    expect(analyzeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ incremental: true }),
    );
  });

  it('should register the hook install subcommand', async () => {
    const { hookInstallCommand } = await import('@/cli/commands/hook.js');
    const program = await buildProgram();

    program.parse(['hook', 'install'], { from: 'user' });

    expect(hookInstallCommand).toHaveBeenCalledWith(
      expect.objectContaining({ dir: '.' }),
    );
  });

  it('should register the hook remove subcommand', async () => {
    const { hookRemoveCommand } = await import('@/cli/commands/hook.js');
    const program = await buildProgram();

    program.parse(['hook', 'remove'], { from: 'user' });

    expect(hookRemoveCommand).toHaveBeenCalledWith(
      expect.objectContaining({ dir: '.' }),
    );
  });

  it('should pass custom dir to hook install', async () => {
    const { hookInstallCommand } = await import('@/cli/commands/hook.js');
    const program = await buildProgram();

    program.parse(['hook', 'install', '-d', '/my/project'], {
      from: 'user',
    });

    expect(hookInstallCommand).toHaveBeenCalledWith(
      expect.objectContaining({ dir: '/my/project' }),
    );
  });
});
