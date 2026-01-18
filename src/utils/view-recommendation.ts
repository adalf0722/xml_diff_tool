export type ViewMode = 'side-by-side' | 'inline' | 'tree' | 'schema';

export type ViewRecommendationReason =
  | 'missing-inputs'
  | 'schema-structure'
  | 'tree-structure'
  | 'inline-scan'
  | 'side-precision';

export type ViewRecommendationConfidence = 'high' | 'medium' | 'low';

export interface ViewRecommendation {
  view: ViewMode;
  reason: ViewRecommendationReason;
  confidence: ViewRecommendationConfidence;
}

export interface ViewRecommendationInput {
  hasXmlA: boolean;
  hasXmlB: boolean;
  schemaStats?: {
    tableAdded: number;
    tableRemoved: number;
    tableModified?: number;
    fieldAdded: number;
    fieldRemoved: number;
    fieldModified: number;
  };
  treeSummary?: {
    added: number;
    removed: number;
    modified: number;
    total: number;
  };
  lineStats?: {
    added: number;
    removed: number;
    modified: number;
    total: number;
  };
  inlineStats?: {
    added: number;
    removed: number;
    total: number;
  };
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function scoreSchema(stats?: ViewRecommendationInput['schemaStats']): number {
  if (!stats) return 0;
  const tableChanges = stats.tableAdded + stats.tableRemoved + (stats.tableModified ?? 0);
  const fieldChanges = stats.fieldAdded + stats.fieldRemoved + stats.fieldModified;
  if (tableChanges >= 1) return 3;
  if (fieldChanges >= 5) return 2;
  if (fieldChanges >= 1) return 1;
  return 0;
}

function scoreTree(summary?: ViewRecommendationInput['treeSummary']): number {
  if (!summary || summary.total <= 0) return 0;
  const changed = summary.added + summary.removed + summary.modified;
  const changeRatio = ratio(changed, summary.total);
  if (changeRatio >= 0.4) return 3;
  if (changeRatio >= 0.2) return 2;
  return 0;
}

function scoreInline(input: ViewRecommendationInput): number {
  const lineStats = input.lineStats;
  if (!lineStats || lineStats.total <= 0) return 0;
  const addedRemoved = lineStats.added + lineStats.removed;
  const changed = addedRemoved + lineStats.modified;
  const changeRatio = ratio(changed, lineStats.total);
  const modifiedRatio = ratio(lineStats.modified, lineStats.total);
  const addedRemovedRatio = ratio(addedRemoved, lineStats.total);
  const addedRemovedDominant = addedRemoved >= lineStats.modified * 2;

  // Inline is best when changes are mostly add/remove, not "modified".
  if (addedRemovedDominant && addedRemovedRatio >= 0.25 && modifiedRatio <= 0.15) return 3;
  if (addedRemovedDominant && changeRatio >= 0.4 && modifiedRatio <= 0.1) return 2;
  return 0;
}

export function recommendView(input: ViewRecommendationInput): ViewRecommendation {
  if (!input.hasXmlA || !input.hasXmlB) {
    return { view: 'side-by-side', reason: 'missing-inputs', confidence: 'high' };
  }

  const schemaScore = scoreSchema(input.schemaStats);
  const treeScore = scoreTree(input.treeSummary);
  const inlineScore = scoreInline(input);
  const maxScore = Math.max(schemaScore, treeScore, inlineScore);

  if (schemaScore === maxScore && schemaScore > 0) {
    return {
      view: 'schema',
      reason: 'schema-structure',
      confidence: schemaScore >= 3 ? 'high' : 'medium',
    };
  }

  if (treeScore === maxScore && treeScore > 0) {
    return {
      view: 'tree',
      reason: 'tree-structure',
      confidence: treeScore >= 3 ? 'high' : 'medium',
    };
  }

  if (inlineScore === maxScore && inlineScore > 0) {
    return {
      view: 'inline',
      reason: 'inline-scan',
      confidence: inlineScore >= 3 ? 'high' : 'medium',
    };
  }

  return { view: 'side-by-side', reason: 'side-precision', confidence: 'low' };
}
