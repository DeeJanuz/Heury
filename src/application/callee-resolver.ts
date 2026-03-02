/**
 * Callee Resolver
 *
 * Post-analysis step that resolves function call callee names to actual
 * CodeUnit records. Matches by base name extraction and disambiguates
 * using same-file preference and export status.
 */

import type { CodeUnit } from '@/domain/models/index.js';
import { createFunctionCall } from '@/domain/models/index.js';
import type { ICodeUnitRepository, IFunctionCallRepository } from '@/domain/ports/index.js';

export interface CalleeResolutionResult {
  readonly totalUnresolved: number;
  readonly resolved: number;
  readonly ambiguous: number;
  readonly noMatch: number;
}

interface CalleeResolverDeps {
  readonly codeUnitRepo: ICodeUnitRepository;
  readonly functionCallRepo: IFunctionCallRepository;
}

/**
 * Extract the base name from a callee name string.
 *
 * Strips `new ` and `this.` prefixes, then takes the last segment
 * after any `.` separator.
 */
export function extractCalleeBaseName(calleeName: string): string {
  let name = calleeName;

  // Strip "new " prefix
  if (name.startsWith('new ')) {
    name = name.slice(4);
  }

  // Strip "this." prefix
  if (name.startsWith('this.')) {
    name = name.slice(5);
  }

  // Take last segment after dot
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex !== -1) {
    name = name.slice(dotIndex + 1);
  }

  return name;
}

/**
 * Resolve unresolved function calls to CodeUnit records.
 *
 * Steps:
 * 1. Build a name -> CodeUnit[] lookup from all units (flat, including children)
 * 2. Filter to unresolved calls (no calleeUnitId)
 * 3. For each: extract base name, find candidates, disambiguate
 * 4. Re-save resolved calls via saveBatch
 * 5. Return resolution stats
 */
export function resolveCallees(deps: CalleeResolverDeps): CalleeResolutionResult {
  const allUnits = deps.codeUnitRepo.findAllFlat();
  const nameLookup = buildNameLookup(allUnits);

  // Build a map of unit ID -> filePath for caller lookup
  const unitFilePathMap = new Map<string, string>();
  for (const unit of allUnits) {
    unitFilePathMap.set(unit.id, unit.filePath);
  }

  const allCalls = deps.functionCallRepo.findAll();
  const unresolvedCalls = allCalls.filter((c) => !c.calleeUnitId);

  let resolved = 0;
  let ambiguous = 0;
  let noMatch = 0;
  const resolvedCalls: ReturnType<typeof createFunctionCall>[] = [];

  for (const call of unresolvedCalls) {
    const baseName = extractCalleeBaseName(call.calleeName);
    const candidates = nameLookup.get(baseName);

    if (!candidates || candidates.length === 0) {
      noMatch++;
      continue;
    }

    const callerFilePath = unitFilePathMap.get(call.callerUnitId);
    const winner = disambiguate(candidates, callerFilePath);

    if (!winner) {
      ambiguous++;
      continue;
    }

    resolvedCalls.push(
      createFunctionCall({
        id: call.id,
        callerUnitId: call.callerUnitId,
        calleeName: call.calleeName,
        calleeUnitId: winner.id,
        calleeFilePath: winner.filePath,
        lineNumber: call.lineNumber,
        isAsync: call.isAsync,
      }),
    );
    resolved++;
  }

  if (resolvedCalls.length > 0) {
    deps.functionCallRepo.saveBatch(resolvedCalls);
  }

  return {
    totalUnresolved: unresolvedCalls.length,
    resolved,
    ambiguous,
    noMatch,
  };
}

function buildNameLookup(units: CodeUnit[]): Map<string, CodeUnit[]> {
  const lookup = new Map<string, CodeUnit[]>();
  for (const unit of units) {
    const existing = lookup.get(unit.name);
    if (existing) {
      existing.push(unit);
    } else {
      lookup.set(unit.name, [unit]);
    }
  }
  return lookup;
}

/**
 * Disambiguate multiple candidates for a callee name.
 *
 * 1. If only one candidate, return it
 * 2. Same-file match preferred
 * 3. Exported preferred over non-exported
 * 4. Still ambiguous -> return undefined
 */
function disambiguate(
  candidates: CodeUnit[],
  callerFilePath: string | undefined,
): CodeUnit | undefined {
  if (candidates.length === 1) {
    return candidates[0];
  }

  // Prefer same-file match
  if (callerFilePath) {
    const sameFile = candidates.filter((c) => c.filePath === callerFilePath);
    if (sameFile.length === 1) {
      return sameFile[0];
    }
  }

  // Prefer exported
  const exported = candidates.filter((c) => c.isExported);
  if (exported.length === 1) {
    return exported[0];
  }

  // Still ambiguous
  return undefined;
}
