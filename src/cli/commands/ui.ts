/**
 * CLI ui command - starts the UI viewer server.
 */

import net from 'node:net';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { IFileSystem } from '@/domain/ports/index.js';
import { NodeFileSystem } from '@/adapters/filesystem/node-filesystem.js';
import { createCompositionRoot } from '@/composition-root.js';
import { createUiServer } from '@/adapters/ui/server.js';

/**
 * Check if a port is in use and kill the process using it.
 * Returns true if a process was killed, false if port was free.
 */
export async function killProcessOnPort(port: number): Promise<boolean> {
  const inUse = await isPortInUse(port);
  if (!inUse) {
    return false;
  }

  let pid: string;
  try {
    pid = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();
  } catch {
    // lsof failed — port may have been released
    return false;
  }

  if (!pid) {
    return false;
  }

  const numericPid = Number(pid.split('\n')[0]);
  if (isNaN(numericPid)) {
    return false;
  }

  console.log(`Stopping existing heury ui on port ${port} (PID ${numericPid})...`);

  try {
    process.kill(numericPid, 'SIGTERM');
  } catch {
    return false;
  }

  // Wait up to 2s for process to exit, then SIGKILL
  const exited = await waitForExit(numericPid, 2000);
  if (!exited) {
    try {
      process.kill(numericPid, 'SIGKILL');
    } catch {
      // Process may have already exited
    }
  }

  return true;
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port);
  });
}

function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = (): void => {
      try {
        process.kill(pid, 0); // signal 0 = check if alive
        if (Date.now() - start >= timeoutMs) {
          resolve(false);
        } else {
          setTimeout(check, 100);
        }
      } catch {
        resolve(true); // process no longer exists
      }
    };
    check();
  });
}

export async function uiCommand(
  options: { dir: string; port: string; host: string },
  fileSystem?: IFileSystem,
): Promise<void> {
  const projectDir = path.resolve(options.dir);
  const fs = fileSystem ?? new NodeFileSystem(projectDir);
  const port = Number(options.port);

  try {
    await killProcessOnPort(port);

    const { dependencies } = await createCompositionRoot(fs, {
      dbPath: `${projectDir}/.heury/heury.db`,
    });

    if (
      !dependencies.functionCallRepo ||
      !dependencies.typeFieldRepo ||
      !dependencies.eventFlowRepo ||
      !dependencies.fileClusterRepo
    ) {
      console.error('Error: Required repositories not available. Run heury analyze first.');
      process.exitCode = 1;
      return;
    }

    const server = createUiServer({
      codeUnitRepo: dependencies.codeUnitRepo,
      dependencyRepo: dependencies.dependencyRepo,
      envVarRepo: dependencies.envVarRepo,
      fileSystem: fs,
      functionCallRepo: dependencies.functionCallRepo,
      typeFieldRepo: dependencies.typeFieldRepo,
      eventFlowRepo: dependencies.eventFlowRepo,
      fileClusterRepo: dependencies.fileClusterRepo,
      projectDir,
    });

    await server.start(port, options.host);
    const displayHost = options.host === '0.0.0.0' ? 'localhost' : options.host;
    console.log(`Heury UI available at http://${displayHost}:${port}`);
    console.log('Press Ctrl+C to stop');

    // Keep the process alive
    setInterval(() => {}, 1 << 30);
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      console.error(`Error: Port ${port} is already in use. Try: heury ui -p ${port + 1}`);
    } else {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    process.exitCode = 1;
  }
}
