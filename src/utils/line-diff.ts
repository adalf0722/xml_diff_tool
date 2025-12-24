export type LineDiffOp = {
  type: 'equal' | 'insert' | 'delete';
  line: string;
};

export interface LineDiffResult {
  ops: LineDiffOp[];
  isCoarse: boolean;
}

const DEFAULT_MAX_CELLS = 2_000_000;

export function diffLines(
  oldLines: string[],
  newLines: string[],
  maxCells: number = DEFAULT_MAX_CELLS
): LineDiffResult {
  const ops: LineDiffOp[] = [];

  let start = 0;
  let endA = oldLines.length - 1;
  let endB = newLines.length - 1;

  while (start <= endA && start <= endB && oldLines[start] === newLines[start]) {
    ops.push({ type: 'equal', line: oldLines[start] });
    start++;
  }

  while (endA >= start && endB >= start && oldLines[endA] === newLines[endB]) {
    endA--;
    endB--;
  }

  const midA = oldLines.slice(start, endA + 1);
  const midB = newLines.slice(start, endB + 1);
  let isCoarse = false;

  if (midA.length > 0 || midB.length > 0) {
    if (midA.length * midB.length > maxCells) {
      isCoarse = true;
      for (const line of midA) {
        ops.push({ type: 'delete', line });
      }
      for (const line of midB) {
        ops.push({ type: 'insert', line });
      }
    } else {
      ops.push(...diffLinesByLcs(midA, midB));
    }
  }

  for (let i = endA + 1; i < oldLines.length; i++) {
    ops.push({ type: 'equal', line: oldLines[i] });
  }

  return { ops, isCoarse };
}

function diffLinesByLcs(oldLines: string[], newLines: string[]): LineDiffOp[] {
  const ops: LineDiffOp[] = [];
  const lcs = computeLCS(oldLines, newLines);

  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx]) {
      if (newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
        ops.push({ type: 'equal', line: oldLines[oldIdx] });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else {
        ops.push({ type: 'insert', line: newLines[newIdx] });
        newIdx++;
      }
    } else if (lcsIdx < lcs.length && newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
      ops.push({ type: 'delete', line: oldLines[oldIdx] });
      oldIdx++;
    } else {
      if (oldIdx < oldLines.length) {
        ops.push({ type: 'delete', line: oldLines[oldIdx] });
        oldIdx++;
      }
      if (newIdx < newLines.length) {
        ops.push({ type: 'insert', line: newLines[newIdx] });
        newIdx++;
      }
    }
  }

  return ops;
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcs: string[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}
