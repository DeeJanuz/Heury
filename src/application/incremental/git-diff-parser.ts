/**
 * Git Diff Parser
 *
 * Parses `git diff --name-status` output into structured changed-file
 * records for incremental analysis. Also provides a helper that shells
 * out to git to obtain the diff since a given commit.
 */

import { execFile } from 'node:child_process';

export interface ChangedFile {
  readonly filePath: string;
  readonly changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  readonly oldPath?: string;
}

/**
 * Map a single-character git status code to a ChangedFile changeType.
 * Returns undefined for unrecognised codes.
 */
function statusToChangeType(
  status: string,
): ChangedFile['changeType'] | undefined {
  switch (status) {
    case 'A':
      return 'added';
    case 'M':
      return 'modified';
    case 'D':
      return 'deleted';
    default:
      return undefined;
  }
}

/**
 * Parse the output of `git diff --name-status` into structured records.
 *
 * Expected line format (tab-separated):
 *   STATUS\tFILE_PATH
 *   R<score>\tOLD_PATH\tNEW_PATH
 *   C<score>\tORIGINAL_PATH\tCOPY_PATH
 *
 * Unknown status codes and malformed lines are silently skipped.
 */
export function parseGitDiff(diffOutput: string): ChangedFile[] {
  const results: ChangedFile[] = [];

  const lines = diffOutput.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;

    const parts = trimmed.split('\t');
    if (parts.length < 2) continue;

    const statusCode = parts[0];
    const firstChar = statusCode.charAt(0);

    // Rename: R or R<score>
    if (firstChar === 'R') {
      if (parts.length < 3) continue;
      results.push({
        filePath: parts[2],
        changeType: 'renamed',
        oldPath: parts[1],
      });
      continue;
    }

    // Copy: C or C<score> — treat as added (destination path)
    if (firstChar === 'C') {
      if (parts.length < 3) continue;
      results.push({
        filePath: parts[2],
        changeType: 'added',
      });
      continue;
    }

    // Simple statuses: A, M, D
    const changeType = statusToChangeType(statusCode);
    if (changeType === undefined) continue;

    results.push({
      filePath: parts[1],
      changeType,
    });
  }

  return results;
}

/**
 * Get changed files since a specific commit by running
 * `git diff --name-status <commitHash> HEAD`.
 *
 * @throws If the git command fails (e.g. invalid commit hash, not a repo).
 */
export function getChangedFilesSinceCommit(
  commitHash: string,
  cwd: string,
): Promise<ChangedFile[]> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['diff', '--name-status', commitHash, 'HEAD'],
      { cwd },
      (error, stdout, _stderr) => {
        if (error) {
          reject(
            new Error(
              `Failed to get changed files since ${commitHash}: ${error.message}`,
            ),
          );
          return;
        }
        resolve(parseGitDiff(stdout));
      },
    );
  });
}
