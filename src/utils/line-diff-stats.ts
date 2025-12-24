/**
 * Line-level Diff Statistics Utilities
 * Computes statistics for line-based diff views (side-by-side, inline)
 * This matches the algorithm used in SideBySideView for consistency
 */

import { prettyPrintXML } from './pretty-print';
import { diffLines } from './line-diff';

export interface LineLevelStats {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  total: number;
  navigableCount: number;
}

/**
 * Compute line-level statistics from two XML strings
 * Uses the same algorithm as SideBySideView for consistency
 */
export function computeLineLevelStats(xmlA: string, xmlB: string): LineLevelStats {
  const formattedA = prettyPrintXML(xmlA);
  const formattedB = prettyPrintXML(xmlB);
  const linesA = formattedA.split('\n');
  const linesB = formattedB.split('\n');
  
  return computeLineLevelStatsFromLines(linesA, linesB);
}

/**
 * Compute line-level statistics from two arrays of lines
 */
export function computeLineLevelStatsFromLines(linesA: string[], linesB: string[]): LineLevelStats {
  const { ops } = diffLines(linesA, linesB);
  let added = 0;
  let removed = 0;
  let modified = 0;
  let unchanged = 0;
  let navigableCount = 0;

  let idx = 0;

  while (idx < ops.length) {
    if (ops[idx].type === 'equal') {
      unchanged++;
      idx++;
      continue;
    }

    let removedCount = 0;
    let addedCount = 0;

    while (idx < ops.length && ops[idx].type !== 'equal') {
      if (ops[idx].type === 'delete') {
        removedCount++;
      } else {
        addedCount++;
      }
      idx++;
    }

    const paired = Math.min(removedCount, addedCount);
    modified += paired;
    removed += removedCount - paired;
    added += addedCount - paired;
    navigableCount += Math.max(removedCount, addedCount);
  }
  
  return { added, removed, modified, unchanged, total: added + removed + modified + unchanged, navigableCount };
}



