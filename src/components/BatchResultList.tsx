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
const EMPTY_PARSE_RESULT: ParseResult = { success: false, root: null, error: null, rawXML: '' };
const EMPTY_LINE_STATS: LineLevelStats = {
  added: 0,
  removed: 0,
  modified: 0,
  unchanged: 0,
  total: 0,
  navigableCount: 0,
};

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
  const [overviewModePref, setOverviewModePref] = useState<OverviewModePreference>('auto');
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
    setOverviewModePref('auto');

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

  const isLargeFileMode = useMemo(() => {
    return Math.max(detailXmlA.length, detailXmlB.length) >= LARGE_FILE_CHAR_THRESHOLD;
  }, [detailXmlA.length, detailXmlB.length]);

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
            {t.backToList}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-[var(--color-text-secondary)]" />
          <span className="text-[var(--color-text-primary)] font-medium">
            {matchResults.length} {t.filesCompared}
          </span>
        </div>
        <div className="flex items-center gap-4 ml-auto text-sm">
          <span className="flex items-center gap-1.5 text-green-400">
            <Check size={14} />
            {noDiffCount} {t.noDiff}
          </span>
          <span className="flex items-center gap-1.5 text-yellow-400">
            <AlertCircle size={14} />
            {hasDiffCount} {t.hasDiff}
          </span>
          {failedCount > 0 && (
            <span className="flex items-center gap-1.5 text-red-400">
              <X size={14} />
              {failedCount} {t.failed}
            </span>
          )}
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
                Status
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)] w-24">
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {matchResults.map((pair) => {
              const diffResult = diffMap.get(pair.id);
              const isSuccess = diffResult?.success;
              
              // Calculate line-level stats for matched files (consistent with detail view)
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
              
              const hasDiff = summary && (summary.added > 0 || summary.removed > 0 || summary.modified > 0);
              
              return (
                <tr 
                  key={pair.id}
                  className="hover:bg-[var(--color-bg-tertiary)]/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-[var(--color-text-secondary)]" />
                      <span className="text-[var(--color-text-primary)]">{pair.name}</span>
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
                      <span className={summary.added > 0 ? 'text-green-400 font-medium' : 'text-[var(--color-text-tertiary)]'}>
                        {summary.added}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isSuccess && summary ? (
                      <span className={summary.removed > 0 ? 'text-red-400 font-medium' : 'text-[var(--color-text-tertiary)]'}>
                        {summary.removed}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isSuccess && summary ? (
                      <span className={summary.modified > 0 ? 'text-yellow-400 font-medium' : 'text-[var(--color-text-tertiary)]'}>
                        {summary.modified}
                      </span>
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
                        className="flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline ml-auto"
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

