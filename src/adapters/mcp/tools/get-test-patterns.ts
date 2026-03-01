/**
 * MCP tool: get-test-patterns
 * Finds similar code units and discovers their test files, extracting
 * test structure patterns to help LLMs create tests.
 */

import type {
  IFileSystem,
  ICodeUnitRepository,
  IFileClusterRepository,
  IPatternTemplateRepository,
} from '@/domain/ports/index.js';
import type { CodeUnit } from '@/domain/models/index.js';
import { buildToolResponse, buildErrorResponse } from '../response-builder.js';
import type { ToolDefinition, ToolHandler } from '../tool-registry.js';

interface Dependencies {
  fileSystem: IFileSystem;
  codeUnitRepo: ICodeUnitRepository;
  fileClusterRepo?: IFileClusterRepository;
  patternTemplateRepo?: IPatternTemplateRepository;
}

interface TestFileCandidate {
  testFilePath: string;
  testedFilePath: string;
}

interface TestFileResult {
  testFilePath: string;
  testedFilePath: string;
  source: string;
}

interface TestStructure {
  imports: string[];
  setupPattern: string | null;
  testCount: number;
}

export function createGetTestPatternsTool(deps: Dependencies): {
  definition: ToolDefinition;
  handler: ToolHandler;
} {
  const definition: ToolDefinition = {
    name: 'get-test-patterns',
    description:
      'Find test patterns for a code unit by discovering similar units, locating their test files, and extracting test structure conventions.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'File path to find test patterns for',
        },
        unit_name: {
          type: 'string',
          description: 'Code unit name to find test patterns for',
        },
      },
    },
  };

  const handler: ToolHandler = async (args: Record<string, unknown>) => {
    const filePath = typeof args.file_path === 'string' ? args.file_path : undefined;
    const unitName = typeof args.unit_name === 'string' ? args.unit_name : undefined;

    if (!filePath && !unitName) {
      return buildErrorResponse('at least one of file_path or unit_name is required');
    }

    // 1. Resolve target unit
    const target = resolveTargetUnit(deps.codeUnitRepo, filePath, unitName);
    if (!target) {
      return buildErrorResponse('Target unit not found');
    }

    // 2. Find similar units
    const allUnits = deps.codeUnitRepo.findAll();
    const similarUnits = findSimilarUnits(target, allUnits, deps.fileClusterRepo);

    // 3. Scan for test files
    const filePaths = new Set<string>();
    const candidates: TestFileCandidate[] = [];

    // Check test files for similar units
    for (const unit of similarUnits) {
      const unitCandidates = generateTestFileCandidates(unit.filePath);
      for (const candidate of unitCandidates) {
        if (!filePaths.has(candidate.testFilePath)) {
          candidates.push(candidate);
          filePaths.add(candidate.testFilePath);
        }
      }
    }

    // Check test files for the target unit itself
    const targetCandidates = generateTestFileCandidates(target.filePath);
    for (const candidate of targetCandidates) {
      if (!filePaths.has(candidate.testFilePath)) {
        candidates.push(candidate);
        filePaths.add(candidate.testFilePath);
      }
    }

    // Filter to only existing test files
    const existingTestFiles: TestFileResult[] = [];
    for (const candidate of candidates) {
      const exists = await deps.fileSystem.exists(candidate.testFilePath);
      if (exists) {
        const source = await deps.fileSystem.readFile(candidate.testFilePath);
        existingTestFiles.push({
          testFilePath: candidate.testFilePath,
          testedFilePath: candidate.testedFilePath,
          source,
        });
        // Limit to first 3 test files
        if (existingTestFiles.length >= 3) break;
      }
    }

    // 4. Extract test structure from found files
    const testStructure = existingTestFiles.length > 0
      ? extractTestStructure(existingTestFiles)
      : null;

    // 5. Determine conventions
    const conventions = determineConventions(existingTestFiles);

    const data = {
      targetUnit: {
        name: target.name,
        filePath: target.filePath,
        unitType: target.unitType,
        signature: target.signature,
      },
      similarUnits: similarUnits.map((u) => ({
        name: u.name,
        filePath: u.filePath,
        unitType: u.unitType,
        signature: u.signature,
      })),
      testFiles: existingTestFiles,
      testStructure,
      conventions,
    };

    return buildToolResponse(data);
  };

  return { definition, handler };
}

function resolveTargetUnit(
  codeUnitRepo: ICodeUnitRepository,
  filePath?: string,
  unitName?: string,
): CodeUnit | undefined {
  if (filePath) {
    const units = codeUnitRepo.findByFilePath(filePath);
    return units[0];
  }
  if (unitName) {
    const allUnits = codeUnitRepo.findAll();
    return allUnits.find((u) => u.name === unitName);
  }
  return undefined;
}

function findSimilarUnits(
  target: CodeUnit,
  allUnits: CodeUnit[],
  fileClusterRepo?: IFileClusterRepository,
): CodeUnit[] {
  const targetPatternTypes = new Set(target.patterns.map((p) => p.patternType));

  // Look up the target's file cluster
  let targetClusterFilePaths: Set<string> | undefined;
  if (fileClusterRepo) {
    const clusterResult = fileClusterRepo.findByFilePath(target.filePath);
    if (clusterResult) {
      targetClusterFilePaths = new Set(clusterResult.members.map((m) => m.filePath));
    }
  }

  const scored = allUnits
    .filter((u) => u.id !== target.id)
    .map((unit) => {
      let score = 0;

      // Same unit type: +2
      if (unit.unitType === target.unitType) {
        score += 2;
      }

      // Overlapping pattern types: +1 per match
      for (const pattern of unit.patterns) {
        if (targetPatternTypes.has(pattern.patternType)) {
          score += 1;
        }
      }

      // Same file cluster: +1
      if (targetClusterFilePaths?.has(unit.filePath)) {
        score += 1;
      }

      return { unit, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map((s) => s.unit);
}

function generateTestFileCandidates(filePath: string): TestFileCandidate[] {
  // For a source file like src/foo/bar.ts, generate test file candidates
  const candidates: TestFileCandidate[] = [];

  // Extract the path components
  // Handle both src/foo/bar.ts and other patterns
  const ext = getExtension(filePath);
  const withoutExt = filePath.replace(new RegExp(`\\.${ext}$`), '');

  // If it starts with src/, generate tests/ mirror candidates
  if (filePath.startsWith('src/')) {
    const relativePath = filePath.slice(4); // Remove "src/"
    const relativeWithoutExt = relativePath.replace(new RegExp(`\\.${ext}$`), '');

    // tests/ mirror: tests/foo/bar.test.ts and tests/foo/bar.spec.ts
    candidates.push({
      testFilePath: `tests/${relativeWithoutExt}.test.${ext}`,
      testedFilePath: filePath,
    });
    candidates.push({
      testFilePath: `tests/${relativeWithoutExt}.spec.${ext}`,
      testedFilePath: filePath,
    });

    // Co-located __tests__: src/foo/__tests__/bar.test.ts
    const dirParts = filePath.split('/');
    const fileName = dirParts.pop()!;
    const dir = dirParts.join('/');
    const fileNameWithoutExt = fileName.replace(new RegExp(`\\.${ext}$`), '');
    candidates.push({
      testFilePath: `${dir}/__tests__/${fileNameWithoutExt}.test.${ext}`,
      testedFilePath: filePath,
    });

    // Co-located: src/foo/bar.test.ts
    candidates.push({
      testFilePath: `${withoutExt}.test.${ext}`,
      testedFilePath: filePath,
    });
  } else {
    // Non-src paths: just check co-located patterns
    candidates.push({
      testFilePath: `${withoutExt}.test.${ext}`,
      testedFilePath: filePath,
    });
    candidates.push({
      testFilePath: `${withoutExt}.spec.${ext}`,
      testedFilePath: filePath,
    });
  }

  return candidates;
}

function getExtension(filePath: string): string {
  const match = filePath.match(/\.(\w+)$/);
  return match ? match[1] : 'ts';
}

function extractTestStructure(testFiles: TestFileResult[]): TestStructure {
  const allImports: string[] = [];
  let totalTestCount = 0;
  let setupPattern: string | null = null;

  for (const testFile of testFiles) {
    const { source } = testFile;

    // Extract imports
    const importLines = source.split('\n').filter((line) =>
      /^\s*import\s/.test(line),
    );
    allImports.push(...importLines);

    // Count it() blocks
    const itMatches = source.match(/\bit\s*\(/g);
    if (itMatches) {
      totalTestCount += itMatches.length;
    }

    // Extract setup pattern
    if (!setupPattern) {
      if (/beforeEach\s*\(/.test(source)) {
        // Extract a brief description of what's in beforeEach
        const beforeEachMatch = source.match(/beforeEach\s*\(\s*(?:async\s*)?\(\)\s*=>\s*\{([^}]*)\}/s);
        if (beforeEachMatch) {
          const body = beforeEachMatch[1].trim();
          setupPattern = `beforeEach with ${summarizeSetupBody(body)}`;
        } else {
          setupPattern = 'beforeEach';
        }
      } else if (/beforeAll\s*\(/.test(source)) {
        setupPattern = 'beforeAll';
      }
    }
  }

  // Deduplicate imports
  const uniqueImports = [...new Set(allImports)];

  return {
    imports: uniqueImports,
    setupPattern,
    testCount: totalTestCount,
  };
}

function summarizeSetupBody(body: string): string {
  // Try to identify what's being set up
  const assignments = body.match(/(\w+)\s*=\s*new\s+(\w+)/g);
  if (assignments && assignments.length > 0) {
    const repos = assignments.map((a) => {
      const match = a.match(/new\s+(\w+)/);
      return match ? match[1] : '';
    }).filter(Boolean);

    if (repos.some((r) => /repo/i.test(r) || /fake/i.test(r))) {
      return 'fake repos';
    }
    return repos.join(', ');
  }
  return 'initialization';
}

function determineConventions(testFiles: TestFileResult[]): {
  testFileLocation: string;
  namingPattern: string;
} {
  let testFileLocation = 'unknown';
  let namingPattern = '.test.ts';

  if (testFiles.length === 0) {
    return { testFileLocation, namingPattern };
  }

  // Determine location convention from discovered test files
  const locations = new Map<string, number>();
  const namingPatterns = new Map<string, number>();

  for (const testFile of testFiles) {
    const path = testFile.testFilePath;

    // Check location
    if (path.startsWith('tests/')) {
      locations.set('tests/ mirror', (locations.get('tests/ mirror') ?? 0) + 1);
    } else if (path.includes('__tests__/')) {
      locations.set('co-located __tests__', (locations.get('co-located __tests__') ?? 0) + 1);
    } else {
      locations.set('co-located', (locations.get('co-located') ?? 0) + 1);
    }

    // Check naming
    if (path.endsWith('.test.ts') || path.endsWith('.test.js')) {
      const ext = path.endsWith('.test.ts') ? '.test.ts' : '.test.js';
      namingPatterns.set(ext, (namingPatterns.get(ext) ?? 0) + 1);
    } else if (path.endsWith('.spec.ts') || path.endsWith('.spec.js')) {
      const ext = path.endsWith('.spec.ts') ? '.spec.ts' : '.spec.js';
      namingPatterns.set(ext, (namingPatterns.get(ext) ?? 0) + 1);
    }
  }

  // Pick the most common convention
  if (locations.size > 0) {
    testFileLocation = [...locations.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  if (namingPatterns.size > 0) {
    namingPattern = [...namingPatterns.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  return { testFileLocation, namingPattern };
}
