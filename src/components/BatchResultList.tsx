/**
 * Batch Result List Component
 * Displays the results of batch comparison
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Check, 
  X, 
  AlertCircle, 
  FileText, 
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type { BatchResultItem, DiffResultPayload, InlineLineStats, SingleDiffProgress } from '../hooks/useDiffWorker';
import type { MatchedFilePair } from '../utils/file-matcher';
import { SideBySideView } from './SideBySideView';
import { InlineView } from './InlineView';
import { TreeView } from './TreeView';
import { SchemaView } from './SchemaView';
import { ViewTabs, type ViewMode } from './ViewTabs';
import { DiffSummary } from './DiffSummary';
import { DiffNavigation } from './DiffNavigation';
import { SingleFileProcessor } from './SingleFileProcessor';
import type { DiffResult, DiffType, UnifiedDiffLine } from '../core/xml-diff';
import type { ParseResult } from '../core/xml-parser';
import type { LineDiffOp } from '../utils/line-diff';
import { computeLineLevelStats, type LineLevelStats } from '../utils/line-diff-stats';
import { buildSchemaDiff, type SchemaDiffResult, type SchemaExtractConfig, type SchemaPresetId } from '../core/schema-diff';

const LARGE_FILE_CHAR_THRESHOLD = 1_000_000;
type OverviewMode = 'minimap' | 'hybrid' | 'chunks';
type OverviewModePreference = 'auto' | OverviewMode;
const OVERVIEW_THRESHOLDS = {
  min: 0.4,
  max: 0.8,
  chunkCount: 200,
};
const OVERVIEW_MODE_STORAGE_KEY = 'xmldiff-overview-mode';
const OVERVIEW_MODE_OPTIONS: OverviewModePreference[] = ['auto', 'minimap', 'hybrid', 'chunks'];
const EMPTY_PARSE_RESULT: ParseResult = { success: false, root: null, error: null, rawXML: '' };
const EMPTY_LINE_STATS: LineLevelStats = {
  added: 0,
  removed: 0,
  modified: 0,
  unchanged: 0,
  total: 0,
  navigableCount: 0,
};

function normalizeOverviewModePref(value: string | null): OverviewModePreference {
  if (value && OVERVIEW_MODE_OPTIONS.includes(value as OverviewModePreference)) {
    return value as OverviewModePreference;
  }
  return 'auto';
}

function createEmptySchemaDiff(): SchemaDiffResult {
  return {
    items: [],
    stats: {
      added: 0,
      removed: 0,
      modified: 0,
      unchanged: 0,
      total: 0,
      tableAdded: 0,
      tableRemoved: 0,
      fieldAdded: 0,
      fieldRemoved: 0,
      fieldModified: 0,
      fieldUnchanged: 0,
    },
  };
}

function countChunksFromOps(ops?: LineDiffOp[]): number {
  if (!ops || ops.length === 0) return 0;
  let count = 0;
  let inChunk = false;
  for (const op of ops) {
    const isDiff = op.type !== 'equal';
    if (isDiff && !inChunk) {
      count += 1;
      inChunk = true;
      continue;
    }
    if (!isDiff) {
      inChunk = false;
    }
  }
  return count;
}

function countChunksFromInline(lines?: UnifiedDiffLine[]): number {
  if (!lines || lines.length === 0) return 0;
  let count = 0;
  let inChunk = false;
  for (const line of lines) {
    const isDiff = line.type !== 'context';
    if (isDiff && !inChunk) {
      count += 1;
      inChunk = true;
      continue;
    }
    if (!isDiff) {
      inChunk = false;
    }
  }
  return count;
}

interface BatchResultListProps {
  matchResults: MatchedFilePair[];
  diffResults: BatchResultItem[];
  onReset: () => void;
  xmlContentsA: Map<string, string>;
  xmlContentsB: Map<string, string>;
  computeDiff: (
    xmlA: string,
    xmlB: string,
    onProgress?: (progress: SingleDiffProgress) => void
  ) => Promise<DiffResultPayload>;
  schemaPresetId: SchemaPresetId;
  onSchemaPresetChange: (presetId: SchemaPresetId) => void;
  schemaCustomConfig: SchemaExtractConfig;
  onSchemaCustomConfigChange: (config: SchemaExtractConfig) => void;
  schemaConfig: SchemaExtractConfig;
}

type ViewState = 
  | { type: 'list' }
  | { type: 'detail'; item: BatchResultItem; pair: MatchedFilePair };

type BatchStatusFilter = 'all' | 'hasDiff' | 'noDiff' | 'failed' | 'onlyA' | 'onlyB';
type BatchSortKey = 'name' | 'added' | 'removed' | 'modified' | 'status';
type BatchSortOrder = 'asc' | 'desc';

export function BatchResultList({ 
  matchResults, 
  diffResults, 
  onReset,
  xmlContentsA,
  xmlContentsB,
  computeDiff,
  schemaPresetId,
  onSchemaPresetChange,
  schemaCustomConfig,
  onSchemaCustomConfigChange,
  schemaConfig,
}: BatchResultListProps) {
  const { t } = useLanguage();
  const [viewState, setViewState] = useState<ViewState>({ type: 'list' });
  const [activeView, setActiveView] = useState<ViewMode>('side-by-side');
  const [activeFilters, setActiveFilters] = useState<Set<DiffType>>(
    new Set(['added', 'removed', 'modified'])
  );
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0);
  const [overviewModePref, setOverviewModePref] = useState<OverviewModePreference>(() => {
    if (typeof window === 'undefined') return 'auto';
    return normalizeOverviewModePref(localStorage.getItem(OVERVIEW_MODE_STORAGE_KEY));
  });
  const [detailState, setDetailState] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [detailProgress, setDetailProgress] = useState<SingleDiffProgress | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailParseA, setDetailParseA] = useState<ParseResult>(EMPTY_PARSE_RESULT);
  const [detailParseB, setDetailParseB] = useState<ParseResult>(EMPTY_PARSE_RESULT);
  const [detailDiffResults, setDetailDiffResults] = useState<DiffResult[]>([]);
  const [detailLineDiffOps, setDetailLineDiffOps] = useState<LineDiffOp[]>([]);
  const [detailInlineLineDiff, setDetailInlineLineDiff] = useState<UnifiedDiffLine[]>([]);
  const [detailLineStats, setDetailLineStats] = useState<LineLevelStats>(EMPTY_LINE_STATS);
  const [detailInlineStats, setDetailInlineStats] = useState<InlineLineStats | null>(null);
  const [detailInlineDiffCount, setDetailInlineDiffCount] = useState(0);
  const [detailSideDiffCount, setDetailSideDiffCount] = useState(0);
  const [detailSchemaDiff, setDetailSchemaDiff] = useState<SchemaDiffResult>(createEmptySchemaDiff());
  const [detailSchemaDiffCount, setDetailSchemaDiffCount] = useState(0);
  const [detailSchemaScope, setDetailSchemaScope] = useState<'all' | 'table' | 'field'>('all');
  const [detailTreeNavCount, setDetailTreeNavCount] = useState(0);
  const [detailTreeScope, setDetailTreeScope] = useState<'full' | 'diff-only'>('full');
  const [detailTreeSummary, setDetailTreeSummary] = useState<{
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
    total: number;
  } | null>(null);
  const [detailDisplayXmlA, setDetailDisplayXmlA] = useState('');
  const [detailDisplayXmlB, setDetailDisplayXmlB] = useState('');
  const [detailLargeFileModeOverride, setDetailLargeFileModeOverride] = useState<boolean | null>(
    null
  );
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [batchStatusFilter, setBatchStatusFilter] = useState<BatchStatusFilter>('all');
  const [batchDiffTypeFilter, setBatchDiffTypeFilter] = useState<Set<DiffType>>(
    new Set(['added', 'removed', 'modified'])
  );
  const [batchSortKey, setBatchSortKey] = useState<BatchSortKey>('name');
  const [batchSortOrder, setBatchSortOrder] = useState<BatchSortOrder>('asc');

  // Create a map of diff results by id
  const diffMap = new Map<string, BatchResultItem>();
  for (const result of diffResults) {
    diffMap.set(result.id, result);
  }

  // Stats
  const successCount = diffResults.filter(r => r.success).length;
  const failedCount = diffResults.filter(r => !r.success).length;
  const noDiffCount = diffResults.filter(r => r.success && r.summary && 
    r.summary.added === 0 && r.summary.removed === 0 && r.summary.modified === 0
  ).length;
  const hasDiffCount = successCount - noDiffCount;
  const isDetailView = viewState.type === 'detail';
  const detailPair = isDetailView ? viewState.pair : null;
  const detailItem = isDetailView ? viewState.item : null;
  const detailXmlA = useMemo(() => {
    if (!detailPair?.fileA) return '';
    const keyA = detailPair.fileA.name.toLowerCase();
    return xmlContentsA.get(keyA) || detailPair.fileA.content || '';
  }, [detailPair, xmlContentsA]);
  const detailXmlB = useMemo(() => {
    if (!detailPair?.fileB) return '';
    const keyB = detailPair.fileB.name.toLowerCase();
    return xmlContentsB.get(keyB) || detailPair.fileB.content || '';
  }, [detailPair, xmlContentsB]);
  const formatSize = useCallback((size: number) => {
    if (size >= 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (size >= 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${size} B`;
  }, []);
  const countLines = useCallback((value: string) => {
    if (!value) return 0;
    return value.split('\n').length;
  }, []);
  const getParseStatus = useCallback(
    (value: string, parseResult: ParseResult) => {
      if (!value.trim()) {
        return { label: t.emptyXml, className: 'text-[var(--color-text-muted)]' };
      }
      if (parseResult.error) {
        return { label: t.invalidXml, className: 'text-red-400' };
      }
      if (parseResult.success) {
        return { label: t.parseStatusValid, className: 'text-green-400' };
      }
      return { label: t.processing, className: 'text-yellow-400' };
    },
    [t]
  );
  const detailSummaryA = useMemo(() => {
    const status = getParseStatus(detailDisplayXmlA, detailParseA);
    return {
      chars: detailDisplayXmlA.length,
      lines: countLines(detailDisplayXmlA),
      size: formatSize(detailDisplayXmlA.length),
      status,
    };
  }, [countLines, detailDisplayXmlA, detailParseA, formatSize, getParseStatus]);
  const detailSummaryB = useMemo(() => {
    const status = getParseStatus(detailDisplayXmlB, detailParseB);
    return {
      chars: detailDisplayXmlB.length,
      lines: countLines(detailDisplayXmlB),
      size: formatSize(detailDisplayXmlB.length),
      status,
    };
  }, [countLines, detailDisplayXmlB, detailParseB, formatSize, getParseStatus]);

  const handleViewDetail = useCallback((pair: MatchedFilePair) => {
    const diffResult = diffMap.get(pair.id);
    if (diffResult) {
      setViewState({ type: 'detail', item: diffResult, pair });
    }
  }, [diffMap]);

  const handleBack = useCallback(() => {
    setViewState({ type: 'list' });
  }, []);

  const handleFilterToggle = useCallback((type: DiffType) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleResetFilters = useCallback(() => {
    setActiveFilters(new Set(['added', 'removed', 'modified']));
  }, []);

  const totalNavigableDiffs = useMemo(() => {
    if (activeView === 'tree') return detailTreeNavCount;
    if (activeView === 'schema') return detailSchemaDiffCount;
    if (activeView === 'inline') return detailInlineDiffCount;
    return detailSideDiffCount;
  }, [activeView, detailInlineDiffCount, detailSchemaDiffCount, detailSideDiffCount, detailTreeNavCount]);

  const handleNavigateToDiff = useCallback((index: number) => {
    if (index < 0 || index >= totalNavigableDiffs) return;
    setCurrentDiffIndex(index);
  }, [totalNavigableDiffs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(OVERVIEW_MODE_STORAGE_KEY, overviewModePref);
  }, [overviewModePref]);

  const handleJumpComplete = useCallback((index: number) => {
    setCurrentDiffIndex(prev => (prev === index ? prev : index));
  }, []);

  const filteredDiffResults = useMemo(() => {
    return detailDiffResults.filter(result => activeFilters.has(result.type));
  }, [detailDiffResults, activeFilters]);

  useEffect(() => {
    if (!detailPair) {
      setDetailState('idle');
      setDetailProgress(null);
      setDetailError(null);
      setDetailLargeFileModeOverride(null);
      return;
    }

    let cancelled = false;
    setDetailState('processing');
    setDetailProgress(null);
    setDetailError(null);
    setDetailParseA({ ...EMPTY_PARSE_RESULT, rawXML: detailXmlA });
    setDetailParseB({ ...EMPTY_PARSE_RESULT, rawXML: detailXmlB });
    setDetailDiffResults([]);
    setDetailLineDiffOps([]);
    setDetailInlineLineDiff([]);
    setDetailLineStats(EMPTY_LINE_STATS);
    setDetailInlineStats(null);
    setDetailInlineDiffCount(0);
    setDetailSideDiffCount(0);
    setDetailSchemaDiff(createEmptySchemaDiff());
    setDetailSchemaDiffCount(0);
    setDetailSchemaScope('all');
    setDetailTreeNavCount(0);
    setDetailTreeScope('full');
    setDetailTreeSummary(null);
    setDetailDisplayXmlA(detailXmlA);
    setDetailDisplayXmlB(detailXmlB);
    setActiveView('side-by-side');
    setActiveFilters(new Set(['added', 'removed', 'modified']));
    setCurrentDiffIndex(0);
    setDetailLargeFileModeOverride(null);

    if (!detailXmlA.trim() || !detailXmlB.trim()) {
      setDetailState('error');
      setDetailError(t.emptyXml);
      return () => {
        cancelled = true;
      };
    }

    computeDiff(detailXmlA, detailXmlB, (progress) => {
      if (!cancelled) {
        setDetailProgress(progress);
      }
    })
      .then(result => {
        if (cancelled) return;
        setDetailParseA(result.parseA);
        setDetailParseB(result.parseB);
        setDetailDiffResults(result.results);
        setDetailLineDiffOps(result.lineDiff.ops);
        setDetailInlineLineDiff(result.lineDiff.inlineLines);
        setDetailLineStats(result.lineDiff.sideBySideStats);
        setDetailInlineStats(result.lineDiff.inlineStats);
        setDetailInlineDiffCount(result.lineDiff.inlineDiffCount);
        setDetailSideDiffCount(result.lineDiff.sideBySideStats.navigableCount);
        setDetailDisplayXmlA(result.lineDiff.formattedXmlA || detailXmlA);
        setDetailDisplayXmlB(result.lineDiff.formattedXmlB || detailXmlB);
        setDetailState('done');
      })
      .catch(error => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        setDetailParseA({
          success: false,
          root: null,
          error: message,
          rawXML: detailXmlA,
        });
        setDetailParseB({
          success: false,
          root: null,
          error: message,
          rawXML: detailXmlB,
        });
        setDetailDiffResults([]);
        setDetailLineDiffOps([]);
        setDetailInlineLineDiff([]);
        setDetailLineStats(EMPTY_LINE_STATS);
        setDetailInlineStats(null);
        setDetailInlineDiffCount(0);
        setDetailSideDiffCount(0);
        setDetailState('error');
        setDetailError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [computeDiff, detailPair, detailXmlA, detailXmlB, t.emptyXml]);

  useEffect(() => {
    if (!detailPair) return;
    if (!detailParseA.success && !detailParseB.success) {
      setDetailSchemaDiff(createEmptySchemaDiff());
      return;
    }
    setDetailSchemaDiff(buildSchemaDiff(detailParseA.root, detailParseB.root, schemaConfig));
  }, [detailPair, detailParseA, detailParseB, schemaConfig]);

  useEffect(() => {
    setCurrentDiffIndex(prev => {
      if (totalNavigableDiffs <= 0) return 0;
      return Math.min(prev, totalNavigableDiffs - 1);
    });
  }, [totalNavigableDiffs]);

  useEffect(() => {
    setCurrentDiffIndex(0);
    setActiveFilters(new Set(['added', 'removed', 'modified']));
  }, [activeView]);

  const isLargeFile = useMemo(() => {
    return Math.max(detailXmlA.length, detailXmlB.length) >= LARGE_FILE_CHAR_THRESHOLD;
  }, [detailXmlA.length, detailXmlB.length]);
  const isLargeFileMode = useMemo(
    () => detailLargeFileModeOverride ?? isLargeFile,
    [detailLargeFileModeOverride, isLargeFile]
  );

  useEffect(() => {
    if (!isLargeFile) {
      setDetailLargeFileModeOverride(null);
    }
  }, [isLargeFile]);

  const lineCoverage = useMemo(() => {
    if (!detailLineStats.total) return 0;
    return (
      (detailLineStats.added + detailLineStats.removed + detailLineStats.modified) /
      detailLineStats.total
    );
  }, [detailLineStats]);

  const inlineCoverage = useMemo(() => {
    if (!detailInlineStats?.total) return 0;
    return (detailInlineStats.added + detailInlineStats.removed) / detailInlineStats.total;
  }, [detailInlineStats]);

  const treeCoverage = useMemo(() => {
    if (!detailTreeSummary?.total) return 0;
    return (
      (detailTreeSummary.added + detailTreeSummary.removed + detailTreeSummary.modified) /
      detailTreeSummary.total
    );
  }, [detailTreeSummary]);

  const activeCoverage = useMemo(() => {
    if (activeView === 'inline') return inlineCoverage;
    if (activeView === 'tree') return treeCoverage;
    return lineCoverage;
  }, [activeView, inlineCoverage, lineCoverage, treeCoverage]);

  const sideChunkCount = useMemo(() => countChunksFromOps(detailLineDiffOps), [detailLineDiffOps]);
  const inlineChunkCount = useMemo(
    () => countChunksFromInline(detailInlineLineDiff),
    [detailInlineLineDiff]
  );
  const activeChunkCount = useMemo(() => {
    if (activeView === 'inline') return inlineChunkCount;
    if (activeView === 'tree') return detailTreeNavCount;
    return sideChunkCount;
  }, [activeView, detailTreeNavCount, inlineChunkCount, sideChunkCount]);

  const autoOverviewMode: OverviewMode = useMemo(() => {
    if (activeCoverage > OVERVIEW_THRESHOLDS.max || activeChunkCount > OVERVIEW_THRESHOLDS.chunkCount) {
      return 'chunks';
    }
    if (activeCoverage >= OVERVIEW_THRESHOLDS.min) return 'hybrid';
    return 'minimap';
  }, [activeChunkCount, activeCoverage]);

  const overviewMode: OverviewMode = overviewModePref === 'auto' ? autoOverviewMode : overviewModePref;
  const overviewModeOptions = useMemo(
    () => [
      { value: 'auto' as const, label: t.overviewModeAuto },
      { value: 'minimap' as const, label: t.overviewModeMinimap },
      { value: 'hybrid' as const, label: t.overviewModeHybrid },
      { value: 'chunks' as const, label: t.overviewModeChunks },
    ],
    [t]
  );
  const overviewModeLabels = useMemo(
    () => ({
      minimap: t.overviewModeMinimap,
      hybrid: t.overviewModeHybrid,
      chunks: t.overviewModeChunks,
    }),
    [t]
  );
  const showOverviewControls = activeView === 'side-by-side' || activeView === 'inline';
  const overviewCoverageText = useMemo(
    () =>
      t.overviewCoverageLabel.replace('{percent}', Math.round(activeCoverage * 100).toString()),
    [activeCoverage, t]
  );
  const showOverviewHint =
    overviewModePref === 'auto' &&
    overviewMode === 'chunks' &&
    (activeCoverage > 0 || activeChunkCount > 0);

  const batchRows = useMemo(() => {
    return matchResults.map((pair) => {
      const diffResult = diffMap.get(pair.id);
      const isSuccess = diffResult?.success;

      let summary = diffResult?.summary;
      if (isSuccess && pair.status === 'matched' && pair.fileA && pair.fileB) {
        const keyA = pair.fileA.name.toLowerCase();
        const keyB = pair.fileB.name.toLowerCase();
        const xmlA = xmlContentsA.get(keyA) || pair.fileA.content || '';
        const xmlB = xmlContentsB.get(keyB) || pair.fileB.content || '';

        if (xmlA && xmlB) {
          const lineStats = computeLineLevelStats(xmlA, xmlB);
          summary = {
            added: lineStats.added,
            removed: lineStats.removed,
            modified: lineStats.modified,
            unchanged: lineStats.unchanged,
            total: lineStats.added + lineStats.removed + lineStats.modified + lineStats.unchanged,
          };
        }
      }

      const hasDiff = Boolean(summary && (summary.added > 0 || summary.removed > 0 || summary.modified > 0));
      let status: BatchStatusFilter = 'all';
      if (pair.status === 'only-in-a') {
        status = 'onlyA';
      } else if (pair.status === 'only-in-b') {
        status = 'onlyB';
      } else if (!diffResult) {
        status = 'all';
      } else if (!isSuccess) {
        status = 'failed';
      } else if (hasDiff) {
        status = 'hasDiff';
      } else {
        status = 'noDiff';
      }

      return {
        pair,
        diffResult,
        summary,
        isSuccess: Boolean(isSuccess),
        hasDiff,
        status,
      };
    });
  }, [diffMap, matchResults, xmlContentsA, xmlContentsB]);

  const batchStatusCounts = useMemo(() => {
    return batchRows.reduce(
      (acc, row) => {
        if (row.status === 'hasDiff') acc.hasDiff += 1;
        if (row.status === 'noDiff') acc.noDiff += 1;
        if (row.status === 'failed') acc.failed += 1;
        if (row.status === 'onlyA') acc.onlyA += 1;
        if (row.status === 'onlyB') acc.onlyB += 1;
        return acc;
      },
      { hasDiff: 0, noDiff: 0, failed: 0, onlyA: 0, onlyB: 0 }
    );
  }, [batchRows]);

  const batchDiffTypeFilterActive = batchDiffTypeFilter.size < 3;

  const batchStatusOptions = useMemo(
    () => [
      { value: 'all' as const, label: t.batchFilterAll, count: matchResults.length },
      { value: 'hasDiff' as const, label: t.batchFilterHasDiff, count: batchStatusCounts.hasDiff },
      { value: 'noDiff' as const, label: t.batchFilterNoDiff, count: batchStatusCounts.noDiff },
      { value: 'failed' as const, label: t.batchFilterFailed, count: batchStatusCounts.failed },
      { value: 'onlyA' as const, label: t.batchFilterOnlyA, count: batchStatusCounts.onlyA },
      { value: 'onlyB' as const, label: t.batchFilterOnlyB, count: batchStatusCounts.onlyB },
    ],
    [batchStatusCounts, matchResults.length, t]
  );

  const batchSortOptions = useMemo(
    () => [
      { value: 'name' as const, label: t.batchSortName },
      { value: 'added' as const, label: t.batchSortAdded },
      { value: 'removed' as const, label: t.batchSortRemoved },
      { value: 'modified' as const, label: t.batchSortModified },
      { value: 'status' as const, label: t.batchSortStatus },
    ],
    [t]
  );

  const filteredBatchRows = useMemo(() => {
    const query = batchSearchQuery.trim().toLowerCase();
    const selectedTypes = batchDiffTypeFilter;
    const filterByDiffType = batchDiffTypeFilterActive;

    return batchRows.filter((row) => {
      if (query && !row.pair.name.toLowerCase().includes(query)) {
        return false;
      }
      if (batchStatusFilter !== 'all' && row.status !== batchStatusFilter) {
        return false;
      }
      if (!filterByDiffType) {
        return true;
      }
      if (!row.summary) {
        return batchStatusFilter !== 'all';
      }
      return (
        (selectedTypes.has('added') && row.summary.added > 0) ||
        (selectedTypes.has('removed') && row.summary.removed > 0) ||
        (selectedTypes.has('modified') && row.summary.modified > 0)
      );
    });
  }, [batchDiffTypeFilter, batchDiffTypeFilterActive, batchRows, batchSearchQuery, batchStatusFilter]);

  const sortedBatchRows = useMemo(() => {
    const sorted = [...filteredBatchRows];
    const direction = batchSortOrder === 'asc' ? 1 : -1;
    const statusRank: Record<BatchStatusFilter, number> = {
      all: 99,
      failed: 0,
      onlyA: 1,
      onlyB: 2,
      hasDiff: 3,
      noDiff: 4,
    };

    sorted.sort((a, b) => {
      if (batchSortKey === 'name') {
        return a.pair.name.localeCompare(b.pair.name) * direction;
      }
      if (batchSortKey === 'status') {
        return (statusRank[a.status] - statusRank[b.status]) * direction;
      }
      const aSummary = a.summary;
      const bSummary = b.summary;
      const getValue = (summary?: { added: number; removed: number; modified: number }) => {
        if (!summary) return 0;
        if (batchSortKey === 'added') return summary.added;
        if (batchSortKey === 'removed') return summary.removed;
        return summary.modified;
      };
      return (getValue(aSummary) - getValue(bSummary)) * direction;
    });
    return sorted;
  }, [batchSortKey, batchSortOrder, filteredBatchRows]);

  const handleBatchDiffTypeToggle = useCallback((type: DiffType) => {
    setBatchDiffTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
        if (next.size === 0) {
          return prev;
        }
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleBatchResetFilters = useCallback(() => {
    setBatchSearchQuery('');
    setBatchStatusFilter('all');
    setBatchDiffTypeFilter(new Set(['added', 'removed', 'modified']));
    setBatchSortKey('name');
    setBatchSortOrder('asc');
  }, []);

  // Detail view
  if (viewState.type === 'detail') {
    return (
      <div className="flex flex-col gap-4">
        {/* Back button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft size={16} />
            {t.backToList}
          </button>
          <span className="text-[var(--color-text-primary)] font-medium">
            {detailPair?.name || detailItem?.name}
          </span>
        </div>

        {detailState === 'processing' && (
          <SingleFileProcessor progress={detailProgress} />
        )}

        {detailError && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {detailError}
          </div>
        )}

        {detailState === 'done' && !detailError && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] rounded-lg">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-2 px-4 pt-3 text-xs text-[var(--color-text-secondary)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 md:divide-x md:divide-[var(--color-border)]">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:pr-4">
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    A
                  </span>
                  <span className="text-[var(--color-text-primary)] font-medium">{t.xmlALabel}</span>
                  <span>{detailSummaryA.size}</span>
                  <span className="text-[var(--color-text-muted)]">|</span>
                  <span className="hidden lg:inline">
                    {detailSummaryA.chars.toLocaleString()} {t.characters}
                  </span>
                  <span className="text-[var(--color-text-muted)]">|</span>
                  <span>{detailSummaryA.lines.toLocaleString()} {t.lines}</span>
                  <span className="text-[var(--color-text-muted)]">|</span>
                  <span className={`hidden lg:inline ${detailSummaryA.status.className}`}>
                    {detailSummaryA.status.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:pl-4">
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    B
                  </span>
                  <span className="text-[var(--color-text-primary)] font-medium">{t.xmlBLabel}</span>
                  <span>{detailSummaryB.size}</span>
                  <span className="text-[var(--color-text-muted)]">|</span>
                  <span className="hidden lg:inline">
                    {detailSummaryB.chars.toLocaleString()} {t.characters}
                  </span>
                  <span className="text-[var(--color-text-muted)]">|</span>
                  <span>{detailSummaryB.lines.toLocaleString()} {t.lines}</span>
                  <span className="text-[var(--color-text-muted)]">|</span>
                  <span className={`hidden lg:inline ${detailSummaryB.status.className}`}>
                    {detailSummaryB.status.label}
                  </span>
                </div>
              </div>
              {isLargeFile && (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-amber-500/15 text-amber-300 border border-amber-500/40"
                    title={t.largeFileModeDesc}
                  >
                    <span className="hidden sm:inline">{t.largeFileMode}</span>
                    <span className="sm:hidden">{t.largeFileModeShort}</span>
                  </span>
                  {isLargeFileMode ? (
                    <button
                      onClick={() => setDetailLargeFileModeOverride(false)}
                      className="ml-auto px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      {t.showFullRendering}
                    </button>
                  ) : (
                    <button
                      onClick={() => setDetailLargeFileModeOverride(null)}
                      className="ml-auto px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      {t.enableLargeFileMode}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 px-4 pt-2 pb-1 md:flex-row md:items-center md:justify-between">
              <ViewTabs activeView={activeView} onViewChange={setActiveView} compact />
              <div className="self-end md:self-auto">
                <DiffNavigation
                  currentIndex={currentDiffIndex}
                  totalDiffs={totalNavigableDiffs}
                  onNavigate={handleNavigateToDiff}
                />
              </div>
            </div>
            <div className="px-4 pt-1 pb-4">
              <DiffSummary
                diffResults={detailDiffResults}
                activeFilters={activeFilters}
                onFilterToggle={handleFilterToggle}
                onReset={handleResetFilters}
                xmlA={detailDisplayXmlA}
                xmlB={detailDisplayXmlB}
                activeView={activeView}
                lineLevelStats={detailLineStats}
                inlineStats={detailInlineStats}
                treeScope={activeView === 'tree' ? detailTreeScope : undefined}
                treeSummary={activeView === 'tree' ? detailTreeSummary : undefined}
                schemaStats={activeView === 'schema' ? detailSchemaDiff.stats : undefined}
                schemaDiff={activeView === 'schema' ? detailSchemaDiff : undefined}
                schemaScope={activeView === 'schema' ? detailSchemaScope : undefined}
                compact
              />
              {showOverviewControls && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {t.overviewModeLabel}
                  </span>
                  <div className="flex flex-wrap items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30 p-1">
                    {overviewModeOptions.map(option => {
                      const isActive = overviewModePref === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setOverviewModePref(option.value)}
                          className={`rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
                            isActive
                              ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {overviewCoverageText}
                  </span>
                  {overviewModePref === 'auto' && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {t.overviewModeAutoHint.replace('{mode}', overviewModeLabels[overviewMode])}
                    </span>
                  )}
                  {showOverviewHint && (
                    <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                      {t.overviewHighDensityHint}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {detailState === 'done' && !detailError && (
          <div className="h-[70vh] min-h-[420px] border border-[var(--color-border)] rounded-xl overflow-hidden">
            {activeView === 'side-by-side' && (
              <SideBySideView
                xmlA={detailDisplayXmlA}
                xmlB={detailDisplayXmlB}
                formattedXmlA={detailDisplayXmlA}
                formattedXmlB={detailDisplayXmlB}
                lineDiffOps={detailLineDiffOps}
                diffResults={filteredDiffResults}
                activeFilters={activeFilters}
                activeDiffIndex={currentDiffIndex}
                onJumpComplete={handleJumpComplete}
                onNavigate={handleNavigateToDiff}
                onNavCountChange={setDetailSideDiffCount}
                onFilterToggle={handleFilterToggle}
                onResetFilters={handleResetFilters}
                disableSyntaxHighlight={isLargeFileMode}
                progressiveRender={isLargeFileMode}
                collapseUnchanged={isLargeFileMode}
                contextLines={3}
                overviewMode={overviewMode}
              />
            )}
            {activeView === 'inline' && (
              <InlineView
                xmlA={detailDisplayXmlA}
                xmlB={detailDisplayXmlB}
                formattedXmlA={detailDisplayXmlA}
                formattedXmlB={detailDisplayXmlB}
                lineDiff={detailInlineLineDiff}
                activeFilters={activeFilters}
                activeDiffIndex={currentDiffIndex}
                onJumpComplete={handleJumpComplete}
                onNavigate={handleNavigateToDiff}
                onNavCountChange={setDetailInlineDiffCount}
                onFilterToggle={handleFilterToggle}
                onResetFilters={handleResetFilters}
                disableSyntaxHighlight={isLargeFileMode}
                progressiveRender={isLargeFileMode}
                collapseUnchanged={isLargeFileMode}
                contextLines={3}
                overviewMode={overviewMode}
              />
            )}
            {activeView === 'tree' && (
              <TreeView
                diffResults={detailDiffResults}
                activeFilters={activeFilters}
                parseResultA={detailParseA}
                parseResultB={detailParseB}
                isLargeFileMode={isLargeFileMode}
                activeDiffIndex={currentDiffIndex}
                onNavigate={handleNavigateToDiff}
                onFilterToggle={handleFilterToggle}
                onResetFilters={handleResetFilters}
                onJumpComplete={handleJumpComplete}
                onNavCountChange={setDetailTreeNavCount}
                onScopeChange={setDetailTreeScope}
                onSummaryChange={setDetailTreeSummary}
              />
            )}
            {activeView === 'schema' && (
              <SchemaView
                schemaDiff={detailSchemaDiff}
                activeFilters={activeFilters}
                schemaScope={detailSchemaScope}
                onScopeChange={setDetailSchemaScope}
                schemaPresetId={schemaPresetId}
                onPresetChange={onSchemaPresetChange}
                schemaCustomConfig={schemaCustomConfig}
                onCustomConfigChange={onSchemaCustomConfigChange}
                activeDiffIndex={currentDiffIndex}
                onNavigate={handleNavigateToDiff}
                onNavCountChange={setDetailSchemaDiffCount}
                onJumpComplete={handleJumpComplete}
                onFilterToggle={handleFilterToggle}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t.batchResults}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors"
          >
            <ArrowLeft size={14} />
            {t.backToBatch}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-h-[86px] items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-semibold text-[var(--color-text-primary)]">
              {matchResults.length}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">{t.filesCompared}</div>
          </div>
        </div>
        <div className="flex min-h-[86px] items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-green-500/15 text-green-400">
            <Check size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-semibold text-[var(--color-text-primary)]">
              {noDiffCount}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">{t.noDiff}</div>
          </div>
        </div>
        <div className="flex min-h-[86px] items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-500/15 text-amber-400">
            <AlertCircle size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-semibold text-[var(--color-text-primary)]">
              {hasDiffCount}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">{t.hasDiff}</div>
          </div>
        </div>
        {failedCount > 0 && (
          <div className="flex min-h-[86px] items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-red-500/15 text-red-400">
              <X size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-semibold text-[var(--color-text-primary)]">
                {failedCount}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">{t.failed}</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={batchSearchQuery}
                onChange={(event) => setBatchSearchQuery(event.target.value)}
                placeholder={t.batchSearchPlaceholder}
                className="h-9 w-full max-w-xs rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div className="flex flex-col gap-2 text-xs text-[var(--color-text-secondary)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t.batchFilterStatusLabel}
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {batchStatusOptions.map((option) => {
                    const isActive = batchStatusFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setBatchStatusFilter(option.value)}
                        className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
                          isActive
                            ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                            : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                        }`}
                      >
                        <span>{option.label}</span>
                        <span className="ml-1 text-[9px] text-[var(--color-text-muted)]">
                          {option.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--color-border)]/60">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t.batchFilterDiffLabel}
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {(['added', 'removed', 'modified'] as DiffType[]).map((type) => {
                    const isActive = batchDiffTypeFilter.has(type);
                    const label =
                      type === 'added' ? t.added : type === 'removed' ? t.removed : t.modified;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleBatchDiffTypeToggle(type)}
                        className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
                          isActive
                            ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                            : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)] lg:flex-col lg:items-end lg:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {t.batchSortLabel}
              </span>
              <select
                value={batchSortKey}
                onChange={(event) => setBatchSortKey(event.target.value as BatchSortKey)}
                className="h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              >
                {batchSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setBatchSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                className="h-8 rounded-md border border-[var(--color-border)] px-2 text-[10px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                {batchSortOrder === 'asc' ? t.batchSortAsc : t.batchSortDesc}
              </button>
            </div>
            <button
              type="button"
              onClick={handleBatchResetFilters}
              className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              {t.resetFilters}
            </button>
          </div>
        </div>
      </div>

      {/* Results list */}
      <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">
                {t.xmlFiles}
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-secondary)] w-24">
                {t.added}
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-secondary)] w-24">
                {t.removed}
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-secondary)] w-24">
                {t.modified}
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-secondary)] w-28">
                {t.batchStatusLabel}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)] w-24">
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {sortedBatchRows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]"
                >
                  {t.batchNoResults}
                </td>
              </tr>
            )}
            {sortedBatchRows.map((row) => {
              const { pair, diffResult, summary, isSuccess, hasDiff } = row;
              const showAdded = batchDiffTypeFilter.has('added');
              const showRemoved = batchDiffTypeFilter.has('removed');
              const showModified = batchDiffTypeFilter.has('modified');
              const showAccent = row.status !== 'all';
              const rowAccentClass =
                row.status === 'onlyA'
                  ? 'bg-red-500/70'
                  : row.status === 'onlyB'
                    ? 'bg-emerald-500/70'
                    : row.status === 'failed'
                      ? 'bg-red-400/70'
                      : row.status === 'hasDiff'
                        ? 'bg-amber-400/70'
                        : row.status === 'noDiff'
                          ? 'bg-green-400/50'
                          : 'bg-transparent';
              return (
                <tr 
                  key={pair.id}
                  className="hover:bg-[var(--color-bg-tertiary)]/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="relative flex items-center gap-2 pl-2">
                      {showAccent && (
                        <span
                          className={`absolute left-0 top-1 bottom-1 w-1 rounded-full ${rowAccentClass}`}
                        />
                      )}
                      <FileText size={16} className="text-[var(--color-text-secondary)]" />
                      <span className="text-[var(--color-text-primary)] font-semibold">{pair.name}</span>
                      {pair.status === 'only-in-a' && (
                        <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                          {t.onlyInA}
                        </span>
                      )}
                      {pair.status === 'only-in-b' && (
                        <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                          {t.onlyInB}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isSuccess && summary ? (
                      showAdded ? (
                        <span className={summary.added > 0 ? 'text-green-400 font-medium' : 'text-[var(--color-text-tertiary)]'}>
                          {summary.added}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)]">-</span>
                      )
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isSuccess && summary ? (
                      showRemoved ? (
                        <span className={summary.removed > 0 ? 'text-red-400 font-medium' : 'text-[var(--color-text-tertiary)]'}>
                          {summary.removed}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)]">-</span>
                      )
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isSuccess && summary ? (
                      showModified ? (
                        <span className={summary.modified > 0 ? 'text-yellow-400 font-medium' : 'text-[var(--color-text-tertiary)]'}>
                          {summary.modified}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)]">-</span>
                      )
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!diffResult ? (
                      <span className="text-[var(--color-text-tertiary)]">-</span>
                    ) : !isSuccess ? (
                      <span 
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded cursor-help"
                        title={diffResult.error || 'Unknown error'}
                      >
                        <X size={12} />
                        {t.failed}
                      </span>
                    ) : hasDiff ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                        <AlertCircle size={12} />
                        {t.hasDiff}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                        <Check size={12} />
                        {t.noDiff}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isSuccess && pair.status === 'matched' && (
                      <button
                        onClick={() => handleViewDetail(pair)}
                        className="ml-auto inline-flex h-8 w-24 items-center justify-center gap-1 rounded-md border border-[var(--color-border)] text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                      >
                        {t.viewDetails}
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BatchResultList;

