/**
 * Main App Component
 * XML Diff Tool - Compare two XML documents visually
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ArrowRightLeft, AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Info, Columns, AlignLeft, GitBranch, Table } from 'lucide-react';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { Header } from './components/Header';
import type { AppMode } from './components/Header';
import { XMLInputPanel } from './components/XMLInputPanel';
import type { ViewMode } from './components/ViewTabs';
import { DiffSummary } from './components/DiffSummary';
import { DiffNavigation } from './components/DiffNavigation';
import { SideBySideView } from './components/SideBySideView';
import { InlineView } from './components/InlineView';
import { TreeView } from './components/TreeView';
import { SchemaView } from './components/SchemaView';
import { FolderUpload } from './components/FolderUpload';
import { BatchProcessor } from './components/BatchProcessor';
import { BatchResultList } from './components/BatchResultList';
import { SingleFileProcessor } from './components/SingleFileProcessor';
import { PerfDebugPanel } from './components/PerfDebugPanel';
import { EmptyStateCard } from './components/EmptyStateCard';
import { HelpDrawer } from './components/HelpDrawer';
import type { DiffResult, DiffType, UnifiedDiffLine } from './core/xml-diff';
import type { ParseResult } from './core/xml-parser';
import {
  buildSchemaDiff,
  getSchemaPresetConfig,
  DEFAULT_SCHEMA_PRESET_ID,
  type SchemaDiffResult,
  type SchemaExtractConfig,
  type SchemaPresetId,
} from './core/schema-diff';
import { useDiffWorker } from './hooks/useDiffWorker';
import type { BatchProgress, BatchResultItem, InlineLineStats, SingleDiffProgress } from './hooks/useDiffWorker';
import { matchFiles, type FileEntry, type MatchedFilePair } from './utils/file-matcher';
import type { LineDiffOp } from './utils/line-diff';
import {
  markPerf,
  measurePerf,
  clearMarks,
  clearMeasures,
  recordValue,
  startFpsMonitor,
  startLongTaskObserver,
} from './utils/perf-metrics';
import { recommendView, type ViewRecommendation } from './utils/view-recommendation';

// Sample XML for demo
const SAMPLE_XML_A = `<?xml version="1.0" encoding="UTF-8"?>
<bookstore>
  <book category="fiction">
    <title>The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <year>1925</year>
    <price>10.99</price>
  </book>
  <book category="non-fiction">
    <title>Sapiens</title>
    <author>Yuval Noah Harari</author>
    <year>2011</year>
    <price>14.99</price>
  </book>
</bookstore>`;

const SAMPLE_XML_B = `<?xml version="1.0" encoding="UTF-8"?>
<bookstore>
  <book category="fiction">
    <title>The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <year>1925</year>
    <price>12.99</price>
  </book>
  <book category="non-fiction">
    <title>Sapiens</title>
    <author>Yuval Noah Harari</author>
    <year>2014</year>
    <price>14.99</price>
    <isbn>978-0062316097</isbn>
  </book>
  <book category="science">
    <title>A Brief History of Time</title>
    <author>Stephen Hawking</author>
    <year>1988</year>
    <price>9.99</price>
  </book>
</bookstore>`;

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

function normalizeOverviewModePref(value: string | null): OverviewModePreference {
  if (value && OVERVIEW_MODE_OPTIONS.includes(value as OverviewModePreference)) {
    return value as OverviewModePreference;
  }
  return 'auto';
}

const SCHEMA_PRESET_STORAGE_KEY = 'xmldiff-schema-preset';
const SCHEMA_CUSTOM_STORAGE_KEY = 'xmldiff-schema-custom';
const SCHEMA_PRESET_IDS: SchemaPresetId[] = ['struct', 'xsd', 'table', 'custom'];

function isSchemaPresetId(value: string): value is SchemaPresetId {
  return SCHEMA_PRESET_IDS.includes(value as SchemaPresetId);
}

function normalizeSchemaList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const next = value
    .map(item => String(item).trim())
    .filter(item => item.length > 0);
  return next.length > 0 ? next : fallback;
}

function normalizeSchemaListAllowEmpty(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .map(item => String(item).trim())
    .filter(item => item.length > 0);
}

function normalizeSchemaConfig(
  raw: unknown,
  fallback: SchemaExtractConfig
): SchemaExtractConfig {
  const record = (raw ?? {}) as Record<string, unknown>;
  const ignoreNamespaces =
    typeof record.ignoreNamespaces === 'boolean'
      ? record.ignoreNamespaces
      : fallback.ignoreNamespaces ?? false;
  const caseSensitiveNames =
    typeof record.caseSensitiveNames === 'boolean'
      ? record.caseSensitiveNames
      : fallback.caseSensitiveNames ?? true;
  const fieldSearchMode =
    record.fieldSearchMode === 'descendants' || record.fieldSearchMode === 'children'
      ? record.fieldSearchMode
      : fallback.fieldSearchMode ?? 'children';

  return {
    tableTags: normalizeSchemaList(record.tableTags, fallback.tableTags),
    fieldTags: normalizeSchemaList(record.fieldTags, fallback.fieldTags),
    tableNameAttrs: normalizeSchemaList(record.tableNameAttrs, fallback.tableNameAttrs),
    fieldNameAttrs: normalizeSchemaList(record.fieldNameAttrs, fallback.fieldNameAttrs),
    ignoreNodes: normalizeSchemaListAllowEmpty(record.ignoreNodes, fallback.ignoreNodes),
    ignoreNamespaces,
    caseSensitiveNames,
    fieldSearchMode,
  };
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

function AppContent() {
  const { t } = useLanguage();
  
  // App mode state
  const [appMode, setAppMode] = useState<AppMode>('single');
  
  // Input state
  const [xmlA, setXmlA] = useState('');
  const [xmlB, setXmlB] = useState('');
  const [displayXmlA, setDisplayXmlA] = useState('');
  const [displayXmlB, setDisplayXmlB] = useState('');
  
  // View state
  const [activeView, setActiveView] = useState<ViewMode>('side-by-side');
  const [showInputPanel, setShowInputPanel] = useState(true);
  const [inputFocus, setInputFocus] = useState<'none' | 'A' | 'B'>('none');
  const [inspectModeA, setInspectModeA] = useState(false);
  const [inspectModeB, setInspectModeB] = useState(false);
  const inputPanelUserToggledRef = useRef(false);
  const inputPanelAutoCollapsedRef = useRef(false);
  const inputPanelEditedARef = useRef(false);
  const inputPanelEditedBRef = useRef(false);
  const [showFullInputAOverride, setShowFullInputAOverride] = useState<boolean | null>(null);
  const [showFullInputBOverride, setShowFullInputBOverride] = useState<boolean | null>(null);
  const [largeFileModeOverride, setLargeFileModeOverride] = useState<boolean | null>(null);
  const [viewSwitching, setViewSwitching] = useState(false);
  const [overviewModePref, setOverviewModePref] = useState<OverviewModePreference>(() => {
    if (typeof window === 'undefined') return 'auto';
    return normalizeOverviewModePref(localStorage.getItem(OVERVIEW_MODE_STORAGE_KEY));
  });
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [strictXmlMode, setStrictXmlMode] = useState(false);
  const [showWarningDetails, setShowWarningDetails] = useState(false);
  const [inspectJumpA, setInspectJumpA] = useState<{ path: string; token: number } | null>(null);
  const [inspectJumpB, setInspectJumpB] = useState<{ path: string; token: number } | null>(null);

  // Filter state - which diff types to show (unchanged is always shown, not a filter)
  const [activeFilters, setActiveFilters] = useState<Set<DiffType>>(
    new Set(['added', 'removed', 'modified'])
  );

  // Navigation state
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0);
  const [treeNavCount, setTreeNavCount] = useState(0);
  const [treeScope, setTreeScope] = useState<'full' | 'diff-only'>('full');
  const [treeSummary, setTreeSummary] = useState<{
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
    total: number;
  } | null>(null);

  // Batch comparison state
  const [batchState, setBatchState] = useState<'idle' | 'processing' | 'done'>('idle');
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResultItem[]>([]);
  const [matchResults, setMatchResults] = useState<MatchedFilePair[]>([]);
  const [xmlContentsA, setXmlContentsA] = useState<Map<string, string>>(new Map());
  const [xmlContentsB, setXmlContentsB] = useState<Map<string, string>>(new Map());
  
  // Web Worker for batch and single file processing
  const { batchDiff, cancelAll, computeDiff } = useDiffWorker();

  // Single file comparison state
  const [singleFileState, setSingleFileState] = useState<'idle' | 'processing' | 'done'>('idle');
  const [singleFileProgress, setSingleFileProgress] = useState<SingleDiffProgress | null>(null);
  const [parseResultA, setParseResultA] = useState<ParseResult>({
    success: false,
    root: null,
    error: null,
    warnings: [],
    rawXML: '',
  });
  const [parseResultB, setParseResultB] = useState<ParseResult>({
    success: false,
    root: null,
    error: null,
    warnings: [],
    rawXML: '',
  });
  const [diffResults, setDiffResults] = useState<DiffResult[]>([]);
  const [lineDiffOps, setLineDiffOps] = useState<LineDiffOp[]>([]);
  const [inlineLineDiff, setInlineLineDiff] = useState<UnifiedDiffLine[]>([]);
  const [lineLevelStats, setLineLevelStats] = useState<{ added: number; removed: number; modified: number; unchanged: number; total: number }>({
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    total: 0,
  });
  const [inlineStats, setInlineStats] = useState<InlineLineStats | null>(null);
  const [inlineDiffCount, setInlineDiffCount] = useState(0);
  const [sideBySideDiffCount, setSideBySideDiffCount] = useState(0);
  const [schemaDiff, setSchemaDiff] = useState<SchemaDiffResult>(() => createEmptySchemaDiff());
  const [schemaDiffCount, setSchemaDiffCount] = useState(0);
  const [schemaScope, setSchemaScope] = useState<'all' | 'table' | 'field'>('all');
  const [viewRecommendation, setViewRecommendation] = useState<ViewRecommendation>(() =>
    recommendView({ hasXmlA: false, hasXmlB: false })
  );
  const defaultSchemaCustomConfig = useMemo(
    () => getSchemaPresetConfig(DEFAULT_SCHEMA_PRESET_ID),
    []
  );
  const [schemaPresetId, setSchemaPresetId] = useState<SchemaPresetId>(() => {
    if (typeof window === 'undefined') return DEFAULT_SCHEMA_PRESET_ID;
    const saved = localStorage.getItem(SCHEMA_PRESET_STORAGE_KEY);
    return saved && isSchemaPresetId(saved) ? saved : DEFAULT_SCHEMA_PRESET_ID;
  });
  const [schemaCustomConfig, setSchemaCustomConfig] = useState<SchemaExtractConfig>(() => {
    if (typeof window === 'undefined') return defaultSchemaCustomConfig;
    const saved = localStorage.getItem(SCHEMA_CUSTOM_STORAGE_KEY);
    if (!saved) return defaultSchemaCustomConfig;
    try {
      return normalizeSchemaConfig(JSON.parse(saved), defaultSchemaCustomConfig);
    } catch {
      return defaultSchemaCustomConfig;
    }
  });
  const schemaConfig = useMemo(() => {
    if (schemaPresetId === 'custom') {
      return normalizeSchemaConfig(schemaCustomConfig, defaultSchemaCustomConfig);
    }
    return getSchemaPresetConfig(schemaPresetId);
  }, [defaultSchemaCustomConfig, schemaCustomConfig, schemaPresetId]);
  const activeViewRef = useRef<ViewMode>(activeView);
  const pendingJumpIndexRef = useRef<number | null>(null);
  
  const hasParseError = Boolean(parseResultA.error || parseResultB.error);
  const mixedContentWarningA = useMemo(
    () => parseResultA.warnings?.find(warning => warning.code === 'mixed-content'),
    [parseResultA.warnings]
  );
  const mixedContentWarningB = useMemo(
    () => parseResultB.warnings?.find(warning => warning.code === 'mixed-content'),
    [parseResultB.warnings]
  );
  const mixedContentCountA = mixedContentWarningA?.count ?? 0;
  const mixedContentCountB = mixedContentWarningB?.count ?? 0;
  const mixedContentSamplesA = mixedContentWarningA?.samples ?? [];
  const mixedContentSamplesB = mixedContentWarningB?.samples ?? [];
  const hasParseWarnings = mixedContentCountA + mixedContentCountB > 0;
  const showParseWarnings = (hasParseWarnings || strictXmlMode) && (xmlA.trim() || xmlB.trim());
  const parseWarningText = t.xmlWarningMixedContent
    .replace('{countA}', String(mixedContentCountA))
    .replace('{countB}', String(mixedContentCountB));
  const showParseError = hasParseError && singleFileState !== 'processing';
  const warningGroups = useMemo(
    () => [
      {
        key: 'A',
        label: t.xmlALabel,
        count: mixedContentCountA,
        samples: mixedContentSamplesA,
      },
      {
        key: 'B',
        label: t.xmlBLabel,
        count: mixedContentCountB,
        samples: mixedContentSamplesB,
      },
    ],
    [t, mixedContentCountA, mixedContentCountB, mixedContentSamplesA, mixedContentSamplesB]
  );
  const formatWarningAttributes = useCallback(
    (attributes: Record<string, string>) => {
      const entries = Object.entries(attributes);
      if (entries.length === 0) return t.xmlWarningNoAttributes;
      const preview = entries
        .slice(0, 2)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      const suffix = entries.length > 2 ? ` +${entries.length - 2}` : '';
      return `${preview}${suffix}`;
    },
    [t]
  );
  useEffect(() => {
    if (!hasParseWarnings) {
      setShowWarningDetails(false);
    }
  }, [hasParseWarnings]);
  const showSingleFileProgress =
    singleFileState === 'processing' && singleFileProgress?.stage !== 'done';
  const isEmptyInputs = !xmlA.trim() && !xmlB.trim();
  const showEmptyState = appMode === 'single' && isEmptyInputs && !showSingleFileProgress;
  const isInputFocused = inputFocus !== 'none';
  const isInspectModeActive = inspectModeA || inspectModeB;
  const inputPanelHeightClass = isInputFocused
    ? 'h-[70vh] max-h-[720px] min-h-[420px]'
    : isInspectModeActive
      ? 'h-[360px] md:h-[520px]'
      : 'h-[280px]';
  const showInputA = inputFocus !== 'B';
  const showInputB = inputFocus !== 'A';
  const showSwapButton = showInputA && showInputB;
  const maxInputSize = Math.max(xmlA.length, xmlB.length);
  const isLargeFile = maxInputSize >= LARGE_FILE_CHAR_THRESHOLD;
  const isLargeInputA = xmlA.length >= LARGE_FILE_CHAR_THRESHOLD;
  const isLargeInputB = xmlB.length >= LARGE_FILE_CHAR_THRESHOLD;
  const showFullInputA = showFullInputAOverride ?? !isLargeInputA;
  const showFullInputB = showFullInputBOverride ?? !isLargeInputB;
  const isLargeFileMode = largeFileModeOverride ?? isLargeFile;
  const activeViewLabel = useMemo(() => {
    if (activeView === 'inline') return t.inline;
    if (activeView === 'tree') return t.treeView;
    if (activeView === 'schema') return t.schemaView;
    return t.sideBySide;
  }, [activeView, t]);
  const viewLabelMap = useMemo(
    () => ({
      'side-by-side': t.sideBySide,
      inline: t.inline,
      tree: t.treeView,
      schema: t.schemaView,
    }),
    [t]
  );
  const viewHintMap = useMemo(
    () => ({
      'side-by-side': t.helpViewSide,
      inline: t.helpViewInline,
      tree: t.helpViewTree,
      schema: t.helpViewSchema,
    }),
    [t]
  );
  const activeViewHint = viewHintMap[activeView];
  const recommendationReasonMap = useMemo(
    () => ({
      'missing-inputs': t.viewRecommendReasonMissing,
      'schema-structure': t.viewRecommendReasonSchema,
      'tree-structure': t.viewRecommendReasonTree,
      'inline-scan': t.viewRecommendReasonInline,
      'side-precision': t.viewRecommendReasonSide,
    }),
    [t]
  );
  const recommendationLabel = viewLabelMap[viewRecommendation.view];
  const recommendationReason = recommendationReasonMap[viewRecommendation.reason];
  const viewModeChips = useMemo(
    () => [
      {
        id: 'side-by-side' as const,
        label: t.sideBySide,
        desc: t.viewModeShortSide,
        className: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
        icon: <Columns size={12} />,
      },
      {
        id: 'inline' as const,
        label: t.inline,
        desc: t.viewModeShortInline,
        className: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
        icon: <AlignLeft size={12} />,
      },
      {
        id: 'tree' as const,
        label: t.treeView,
        desc: t.viewModeShortTree,
        className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
        icon: <GitBranch size={12} />,
      },
      {
        id: 'schema' as const,
        label: t.schemaView,
        desc: t.viewModeShortSchema,
        className: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
        icon: <Table size={12} />,
      },
    ],
    [t]
  );
  const showCompareHint = !xmlA.trim() || !xmlB.trim();
  const lineCoverage = useMemo(() => {
    if (!lineLevelStats.total) return 0;
    return (lineLevelStats.added + lineLevelStats.removed + lineLevelStats.modified) / lineLevelStats.total;
  }, [lineLevelStats]);
  const inlineCoverage = useMemo(() => {
    if (!inlineStats?.total) return 0;
    return (inlineStats.added + inlineStats.removed) / inlineStats.total;
  }, [inlineStats]);
  const treeCoverage = useMemo(() => {
    if (!treeSummary?.total) return 0;
    return (treeSummary.added + treeSummary.removed + treeSummary.modified) / treeSummary.total;
  }, [treeSummary]);
  const activeCoverage = useMemo(() => {
    if (activeView === 'inline') return inlineCoverage;
    if (activeView === 'tree') return treeCoverage;
    return lineCoverage;
  }, [activeView, inlineCoverage, lineCoverage, treeCoverage]);
  const sideChunkCount = useMemo(() => countChunksFromOps(lineDiffOps), [lineDiffOps]);
  const inlineChunkCount = useMemo(() => countChunksFromInline(inlineLineDiff), [inlineLineDiff]);
  const activeChunkCount = useMemo(() => {
    if (activeView === 'inline') return inlineChunkCount;
    if (activeView === 'tree') return treeNavCount;
    return sideChunkCount;
  }, [activeView, inlineChunkCount, sideChunkCount, treeNavCount]);
  const autoOverviewMode: OverviewMode = useMemo(() => {
    if (activeCoverage > OVERVIEW_THRESHOLDS.max || activeChunkCount > OVERVIEW_THRESHOLDS.chunkCount) {
      return 'chunks';
    }
    if (activeCoverage >= OVERVIEW_THRESHOLDS.min) return 'hybrid';
    return 'minimap';
  }, [activeChunkCount, activeCoverage]);
  const overviewMode: OverviewMode = overviewModePref === 'auto' ? autoOverviewMode : overviewModePref;

  // Filter diff results based on active filters
  const filteredDiffResults = useMemo(() => {
    return diffResults.filter(result => activeFilters.has(result.type));
  }, [diffResults, activeFilters]);

  const overviewCoverageText = t.overviewCoverageLabel.replace(
    '{percent}',
    Math.round(activeCoverage * 100).toString()
  );
  const showOverviewControls = activeView === 'side-by-side' || activeView === 'inline';
  const showOverviewHint =
    overviewModePref === 'auto' &&
    overviewMode === 'chunks' &&
    (activeCoverage > 0 || activeChunkCount > 0);
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
  const overviewModeSummary = useMemo(() => {
    if (overviewModePref === 'auto') {
      return `${t.overviewModeAuto} · ${overviewModeLabels[overviewMode]}`;
    }
    return overviewModeLabels[overviewModePref];
  }, [overviewMode, overviewModeLabels, overviewModePref, t]);
  const showRecommendationHint = viewRecommendation.view !== activeView;
  
  const resetLineDiffState = useCallback(() => {
    setLineDiffOps([]);
    setInlineLineDiff([]);
    setLineLevelStats({ added: 0, removed: 0, modified: 0, unchanged: 0, total: 0 });
    setInlineStats(null);
    setInlineDiffCount(0);
    setSideBySideDiffCount(0);
    setSchemaDiff(createEmptySchemaDiff());
    setSchemaDiffCount(0);
  }, []);

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

  const getParseStatus = useCallback((value: string, parseResult: ParseResult) => {
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
  }, [t]);

  const summaryA = useMemo(() => {
    const status = getParseStatus(xmlA, parseResultA);
    return {
      chars: xmlA.length,
      lines: countLines(xmlA),
      size: formatSize(xmlA.length),
      status,
    };
  }, [countLines, formatSize, getParseStatus, parseResultA, xmlA]);

  const summaryB = useMemo(() => {
    const status = getParseStatus(xmlB, parseResultB);
    return {
      chars: xmlB.length,
      lines: countLines(xmlB),
      size: formatSize(xmlB.length),
      status,
    };
  }, [countLines, formatSize, getParseStatus, parseResultB, xmlB]);


  // Get total navigable diffs based on active view
  const totalNavigableDiffs = useMemo(() => {
    if (activeView === 'tree') {
      return treeNavCount;
    } else if (activeView === 'schema') {
      return schemaDiffCount;
    } else if (activeView === 'inline') {
      return inlineDiffCount;
    } else {
      return sideBySideDiffCount;
    }
  }, [activeView, treeNavCount, schemaDiffCount, inlineDiffCount, sideBySideDiffCount]);

  useEffect(() => {
    setCurrentDiffIndex(prev => {
      if (totalNavigableDiffs <= 0) return 0;
      return Math.min(prev, totalNavigableDiffs - 1);
    });
  }, [totalNavigableDiffs]);

  // Reset navigation index and filters when view changes
  useEffect(() => {
    setCurrentDiffIndex(0);
    setActiveFilters(new Set(['added', 'removed', 'modified']));
  }, [activeView]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SCHEMA_PRESET_STORAGE_KEY, schemaPresetId);
  }, [schemaPresetId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SCHEMA_CUSTOM_STORAGE_KEY, JSON.stringify(schemaCustomConfig));
  }, [schemaCustomConfig]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(OVERVIEW_MODE_STORAGE_KEY, overviewModePref);
  }, [overviewModePref]);

  // Toggle a filter
  const handleFilterToggle = useCallback((type: DiffType) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(type)) {
        newFilters.delete(type);
      } else {
        newFilters.add(type);
      }
      return newFilters;
    });
  }, []);

  // Reset filters to default state
  const handleResetFilters = useCallback(() => {
    setActiveFilters(new Set(['added', 'removed', 'modified']));
  }, []);

  // Navigate to diff
  const handleNavigateToDiff = useCallback((index: number) => {
    if (index < 0 || index >= totalNavigableDiffs) return;
    
    pendingJumpIndexRef.current = index;
    markPerf('jump:start');
    setCurrentDiffIndex(index);
  }, [totalNavigableDiffs]);

  const handleJumpComplete = useCallback((index: number) => {
    if (pendingJumpIndexRef.current !== index) return;
    markPerf('jump:end');
    measurePerf('measure:jump', 'jump:start', 'jump:end', {
      view: activeViewRef.current,
      index,
    });
    clearMarks(['jump:start', 'jump:end']);
    clearMeasures('measure:jump');
    pendingJumpIndexRef.current = null;
  }, []);

  // Toggle input panel
  const handleToggleInput = useCallback(() => {
    inputPanelUserToggledRef.current = true;
    setShowInputPanel(prev => {
      const next = !prev;
      if (!next) {
        setInputFocus('none');
      }
      return next;
    });
  }, []);

  const handleToggleFocusA = useCallback(() => {
    setInputFocus(prev => (prev === 'A' ? 'none' : 'A'));
  }, []);

  const handleToggleFocusB = useCallback(() => {
    setInputFocus(prev => (prev === 'B' ? 'none' : 'B'));
  }, []);

  const handleWarningJump = useCallback((side: 'A' | 'B', path: string) => {
    setShowInputPanel(true);
    setInputFocus(side);
    if (side === 'A') {
      setInspectModeA(true);
      setInspectJumpA({ path, token: Date.now() });
    } else {
      setInspectModeB(true);
      setInspectJumpB({ path, token: Date.now() });
    }
  }, []);

  // Swap XML content
  const handleSwap = useCallback(() => {
    inputPanelEditedARef.current = true;
    inputPanelEditedBRef.current = true;
    setXmlA(xmlB);
    setXmlB(xmlA);
  }, [xmlA, xmlB]);

  const handleXmlAChange = useCallback((value: string) => {
    inputPanelEditedARef.current = true;
    setXmlA(value);
  }, []);

  const handleXmlBChange = useCallback((value: string) => {
    inputPanelEditedBRef.current = true;
    setXmlB(value);
  }, []);

  const handleOpenHelp = useCallback(() => {
    setIsHelpOpen(true);
  }, []);

  const handleCloseHelp = useCallback(() => {
    setIsHelpOpen(false);
  }, []);

  const handleUseSample = useCallback(() => {
    inputPanelEditedARef.current = true;
    inputPanelEditedBRef.current = true;
    setXmlA(SAMPLE_XML_A);
    setXmlB(SAMPLE_XML_B);
    setShowInputPanel(true);
    setShowFullInputAOverride(null);
    setShowFullInputBOverride(null);
    setLargeFileModeOverride(null);
    setIsHelpOpen(false);
  }, []);

  const handleXmlAUpload = useCallback(() => {
    if (typeof window === 'undefined') return;
    setOverviewModePref(normalizeOverviewModePref(localStorage.getItem(OVERVIEW_MODE_STORAGE_KEY)));
  }, []);

  const handleXmlBUpload = useCallback(() => {
    if (typeof window === 'undefined') return;
    setOverviewModePref(normalizeOverviewModePref(localStorage.getItem(OVERVIEW_MODE_STORAGE_KEY)));
  }, []);

  // Handle batch folder selection
  const handleFoldersSelected = useCallback(async (filesA: FileEntry[], filesB: FileEntry[]) => {
    // Create content maps for later detail view
    const mapA = new Map<string, string>();
    const mapB = new Map<string, string>();
    
    for (const file of filesA) {
      mapA.set(file.name.toLowerCase(), file.content);
    }
    for (const file of filesB) {
      mapB.set(file.name.toLowerCase(), file.content);
    }
    
    setXmlContentsA(mapA);
    setXmlContentsB(mapB);
    
    // Match files
    const matched = matchFiles(filesA, filesB);
    setMatchResults(matched.all);
    
    // Prepare batch input (only matched files)
    const batchInput = matched.matched.map(pair => ({
      id: pair.id,
      name: pair.name,
      xmlA: pair.fileA ? (mapA.get(pair.fileA.name.toLowerCase()) || '') : '',
      xmlB: pair.fileB ? (mapB.get(pair.fileB.name.toLowerCase()) || '') : '',
    }));
    
    // Start processing
    setBatchState('processing');
    setBatchProgress(null);
    
    try {
      const results = await batchDiff(batchInput, (progress) => {
        setBatchProgress(progress);
      });
      
      setBatchResults(results.results);
      setBatchState('done');
    } catch (error) {
      console.error('Batch diff error:', error);
      setBatchState('idle');
    }
  }, [batchDiff]);

  // Cancel batch processing
  const handleCancelBatch = useCallback(() => {
    cancelAll();
    setBatchState('idle');
    setBatchProgress(null);
  }, [cancelAll]);

  // Reset batch state
  const handleResetBatch = useCallback(() => {
    setBatchState('idle');
    setBatchProgress(null);
    setBatchResults([]);
    setMatchResults([]);
    setXmlContentsA(new Map());
    setXmlContentsB(new Map());
  }, []);

  // Handle mode change
  const handleModeChange = useCallback((mode: AppMode) => {
    setAppMode(mode);
    if (mode === 'single') {
      handleResetBatch();
    }
  }, [handleResetBatch]);

  // Handle single file processing with Worker (with debounce and dual-file check)
  const processingRef = useRef(false);
  const pendingDiffRef = useRef(false);
  const lastXmlARef = useRef(xmlA);
  const lastXmlBRef = useRef(xmlB);
  
  const runDiff = useCallback(async (inputA: string, inputB: string) => {
    markPerf('diff:start');
    processingRef.current = true;
    setSingleFileState('processing');
    setSingleFileProgress(null);

    try {
      const result = await computeDiff(
        inputA,
        inputB,
        (progress) => {
          setSingleFileProgress(progress);
        },
        { strictMode: strictXmlMode }
      );

      markPerf('diff:done');
      measurePerf('measure:diff', 'diff:start', 'diff:done', {
        view: activeViewRef.current,
      });
      clearMarks(['diff:start']);
      clearMeasures('measure:diff');

      setParseResultA(result.parseA);
      setParseResultB(result.parseB);
      setDiffResults(result.results);
      const nextSchemaDiff = buildSchemaDiff(result.parseA.root, result.parseB.root, schemaConfig);
      const nextLineStats = {
        added: result.lineDiff.sideBySideStats.added,
        removed: result.lineDiff.sideBySideStats.removed,
        modified: result.lineDiff.sideBySideStats.modified,
        unchanged: result.lineDiff.sideBySideStats.unchanged,
        total: result.lineDiff.sideBySideStats.total,
      };

      setSchemaDiff(nextSchemaDiff);
      setLineDiffOps(result.lineDiff.ops);
      setInlineLineDiff(result.lineDiff.inlineLines);
      setLineLevelStats(nextLineStats);
      setInlineStats(result.lineDiff.inlineStats);
      setInlineDiffCount(result.lineDiff.inlineDiffCount);
      setSideBySideDiffCount(result.lineDiff.sideBySideStats.navigableCount);
      setDisplayXmlA(result.lineDiff.formattedXmlA || inputA);
      setDisplayXmlB(result.lineDiff.formattedXmlB || inputB);
      setViewRecommendation(
        recommendView({
          hasXmlA: Boolean(inputA.trim()),
          hasXmlB: Boolean(inputB.trim()),
          schemaStats: nextSchemaDiff.stats,
          lineStats: {
            added: nextLineStats.added,
            removed: nextLineStats.removed,
            modified: nextLineStats.modified,
            total: nextLineStats.total,
          },
          inlineStats: result.lineDiff.inlineStats ?? undefined,
        })
      );
      setSingleFileState('done');
    } catch (error) {
      console.error('Single file diff error:', error);
      setParseResultA({ 
        success: false, 
        root: null, 
        error: error instanceof Error ? error.message : 'Unknown error',
        warnings: [],
        rawXML: inputA 
      });
      setParseResultB({ 
        success: false, 
        root: null, 
        error: error instanceof Error ? error.message : 'Unknown error',
        warnings: [],
        rawXML: inputB 
      });
      setDiffResults([]);
      resetLineDiffState();
      setViewRecommendation(recommendView({ hasXmlA: Boolean(inputA.trim()), hasXmlB: Boolean(inputB.trim()) }));
      setSingleFileState('idle');
    } finally {
      processingRef.current = false;
      if (pendingDiffRef.current) {
        pendingDiffRef.current = false;
        const latestA = lastXmlARef.current;
        const latestB = lastXmlBRef.current;
        const hasBothLatest = latestA.trim().length > 0 && latestB.trim().length > 0;
        if (hasBothLatest && (latestA !== inputA || latestB !== inputB)) {
          void runDiff(latestA, latestB);
        }
      }
    }
  }, [computeDiff, resetLineDiffState, schemaConfig, strictXmlMode]);

  useEffect(() => {
    if (!parseResultA.success || !parseResultB.success) return;
    if (!parseResultA.root && !parseResultB.root) return;
    setSchemaDiff(buildSchemaDiff(parseResultA.root, parseResultB.root, schemaConfig));
  }, [
    parseResultA.success,
    parseResultB.success,
    parseResultA.root,
    parseResultB.root,
    schemaConfig,
  ]);

  useEffect(() => {
    const stopFps = startFpsMonitor((fps) => {
      recordValue('fps', fps, 'fps', { view: activeViewRef.current });
    });
    const stopLongTask = startLongTaskObserver((entry) => {
      recordValue('longtask', entry.duration, 'ms', { view: activeViewRef.current });
    });
    return () => {
      stopFps();
      stopLongTask();
    };
  }, []);

  useEffect(() => {
    if (singleFileState !== 'done') return;
    const rafId = requestAnimationFrame(() => {
      markPerf('view:ready');
      measurePerf('measure:view', 'diff:done', 'view:ready', {
        view: activeViewRef.current,
      });
      clearMarks(['diff:done', 'view:ready']);
      clearMeasures('measure:view');
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    singleFileState,
    activeView,
    diffResults.length,
    lineDiffOps.length,
    inlineLineDiff.length,
    treeNavCount,
  ]);

  const lastStrictModeRef = useRef(strictXmlMode);

  useEffect(() => {
    // Only process if both files have content
    const hasBothFiles = xmlA.trim().length > 0 && xmlB.trim().length > 0;
    
    // Check if content actually changed
    const contentChanged = lastXmlARef.current !== xmlA || lastXmlBRef.current !== xmlB;
    lastXmlARef.current = xmlA;
    lastXmlBRef.current = xmlB;
    
    if (!hasBothFiles) {
      // Reset to idle if one file is empty (only update if not already idle)
      setSingleFileState(prev => {
        if (prev !== 'idle') {
          setSingleFileProgress(null);
          setParseResultA({ success: false, root: null, error: null, warnings: [], rawXML: xmlA });
          setParseResultB({ success: false, root: null, error: null, warnings: [], rawXML: xmlB });
          setDiffResults([]);
          resetLineDiffState();
          return 'idle';
        }
        return prev;
      });
      pendingDiffRef.current = false;
      processingRef.current = false;
      return;
    }

    // Only process if content changed
    if (!contentChanged && processingRef.current) {
      return;
    }

    // Debounce: wait 500ms after last change
    const timeoutId = setTimeout(async () => {
      if (processingRef.current) {
        pendingDiffRef.current = true;
        return;
      }

      void runDiff(xmlA, xmlB);
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [xmlA, xmlB, resetLineDiffState, runDiff]);

  useEffect(() => {
    if (lastStrictModeRef.current === strictXmlMode) return;
    lastStrictModeRef.current = strictXmlMode;
    const hasBothFiles = xmlA.trim().length > 0 && xmlB.trim().length > 0;
    if (!hasBothFiles) return;
    if (processingRef.current) {
      pendingDiffRef.current = true;
      return;
    }
    void runDiff(xmlA, xmlB);
  }, [strictXmlMode, xmlA, xmlB, runDiff]);

  // Cancel single file processing
  const handleCancelSingle = useCallback(() => {
    cancelAll();
    pendingDiffRef.current = false;
    processingRef.current = false;
    resetLineDiffState();
    setSingleFileState('idle');
    setSingleFileProgress(null);
  }, [cancelAll, resetLineDiffState]);

  useEffect(() => {
    if (appMode !== 'single') return;
    if (singleFileState !== 'done') return;
    if (!showInputPanel) return;
    if (inputPanelUserToggledRef.current) return;
    if (!inputPanelEditedARef.current || !inputPanelEditedBRef.current) return;
    if (inputPanelAutoCollapsedRef.current) return;
    inputPanelAutoCollapsedRef.current = true;
    setShowInputPanel(false);
  }, [appMode, singleFileState, showInputPanel]);

  useEffect(() => {
    if (!isLargeFile) {
      setLargeFileModeOverride(null);
    }
  }, [isLargeFile]);

  useEffect(() => {
    if (!isLargeFileMode) {
      setViewSwitching(false);
      return;
    }
    setViewSwitching(true);
    const timer = setTimeout(() => {
      setViewSwitching(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [activeView, isLargeFileMode]);


  useEffect(() => {
    if (!isLargeInputA) {
      setShowFullInputAOverride(null);
    }
  }, [isLargeInputA]);

  useEffect(() => {
    if (!isLargeInputB) {
      setShowFullInputBOverride(null);
    }
  }, [isLargeInputB]);

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg-primary)]">
      {/* Header */}
      <Header
        mode={appMode}
        onModeChange={handleModeChange}
        onOpenHelp={appMode === 'single' ? handleOpenHelp : undefined}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Batch Mode UI */}
        {appMode === 'batch' && (
          <div className="flex-1 overflow-auto p-6">
            {batchState === 'idle' && (
              <FolderUpload
                onFoldersSelected={handleFoldersSelected}
                disabled={false}
              />
            )}
            {batchState === 'processing' && (
              <BatchProcessor
                progress={batchProgress}
                onCancel={handleCancelBatch}
              />
            )}
            {batchState === 'done' && (
              <BatchResultList
                matchResults={matchResults}
                diffResults={batchResults}
                onReset={handleResetBatch}
                xmlContentsA={xmlContentsA}
                xmlContentsB={xmlContentsB}
                computeDiff={computeDiff}
                schemaPresetId={schemaPresetId}
                onSchemaPresetChange={setSchemaPresetId}
                schemaCustomConfig={schemaCustomConfig}
                onSchemaCustomConfigChange={setSchemaCustomConfig}
                schemaConfig={schemaConfig}
              />
            )}
          </div>
        )}

        {/* Single Mode UI */}
        {appMode === 'single' && (
          <>
        {/* Progress indicator */}
        {showSingleFileProgress && (
          <div className="px-4 pt-4">
            <SingleFileProcessor
              progress={singleFileProgress}
              onCancel={handleCancelSingle}
            />
          </div>
        )}

        {/* Input panels (collapsible) */}
        {showInputPanel && (
          <div className="flex-shrink-0 border-b border-[var(--color-border)]">
            <div className={`flex ${inputPanelHeightClass} transition-[height] duration-300`}>
              {/* XML A Input */}
              {showInputA && (
                <div className={`flex-1 ${showInputB ? 'border-r border-[var(--color-border)]' : ''}`}>
                  <XMLInputPanel
                    label={t.xmlALabel}
                    value={xmlA}
                    onChange={handleXmlAChange}
                    onUpload={handleXmlAUpload}
                    error={parseResultA.error}
                    placeholder={t.xmlAPlaceholder}
                    isLarge={isLargeInputA}
                    isPreview={!showFullInputA}
                    onShowFull={() => setShowFullInputAOverride(true)}
                    onShowPreview={() => setShowFullInputAOverride(false)}
                    inspectMode={inspectModeA}
                    inspectJumpTarget={inspectJumpA}
                    onInspectModeChange={setInspectModeA}
                    isPanelFocused={inputFocus === 'A'}
                    onToggleFocus={handleToggleFocusA}
                  />
                </div>
              )}

              {/* Swap button */}
              {showSwapButton && (
                <div className="flex flex-col items-center justify-center px-2 bg-[var(--color-bg-secondary)]">
                  <button
                    onClick={handleSwap}
                    className="p-2 rounded-full hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    title={t.swap}
                  >
                    <ArrowRightLeft size={20} className="text-[var(--color-accent)]" />
                  </button>
                </div>
              )}

              {/* XML B Input */}
              {showInputB && (
                <div className="flex-1">
                  <XMLInputPanel
                    label={t.xmlBLabel}
                    value={xmlB}
                    onChange={handleXmlBChange}
                    onUpload={handleXmlBUpload}
                    error={parseResultB.error}
                    placeholder={t.xmlBPlaceholder}
                    isLarge={isLargeInputB}
                    isPreview={!showFullInputB}
                    onShowFull={() => setShowFullInputBOverride(true)}
                    onShowPreview={() => setShowFullInputBOverride(false)}
                    inspectMode={inspectModeB}
                    inspectJumpTarget={inspectJumpB}
                    onInspectModeChange={setInspectModeB}
                    isPanelFocused={inputFocus === 'B'}
                    onToggleFocus={handleToggleFocusB}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Toggle input panel button */}
        <div className="relative z-10 bg-[var(--color-bg-primary)] border-y border-[var(--color-border)] shadow-sm">
          <button
            onClick={handleToggleInput}
            className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
          >
            {showInputPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span>{showInputPanel ? t.collapseInput : t.expandInput}</span>
          </button>
        </div>

        {showEmptyState && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-6">
            <EmptyStateCard onUseSample={handleUseSample} onOpenHelp={handleOpenHelp} />
          </div>
        )}

        {(!showInputPanel || isLargeFile) && !showEmptyState && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-2 px-4 py-2">
              {!showInputPanel && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 md:divide-x md:divide-[var(--color-border)]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:pr-4">
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      A
                    </span>
                    <span className="text-[var(--color-text-primary)] font-medium">{t.xmlALabel}</span>
                    <span>{summaryA.size}</span>
                    <span className="text-[var(--color-text-muted)]">|</span>
                    <span className="hidden lg:inline">{summaryA.chars.toLocaleString()} {t.characters}</span>
                    <span className="text-[var(--color-text-muted)]">|</span>
                    <span>{summaryA.lines.toLocaleString()} {t.lines}</span>
                    <span className="text-[var(--color-text-muted)]">|</span>
                    <span className={`hidden lg:inline ${summaryA.status.className}`}>{summaryA.status.label}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:pl-4">
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      B
                    </span>
                    <span className="text-[var(--color-text-primary)] font-medium">{t.xmlBLabel}</span>
                    <span>{summaryB.size}</span>
                    <span className="text-[var(--color-text-muted)]">|</span>
                    <span className="hidden lg:inline">{summaryB.chars.toLocaleString()} {t.characters}</span>
                    <span className="text-[var(--color-text-muted)]">|</span>
                    <span>{summaryB.lines.toLocaleString()} {t.lines}</span>
                    <span className="text-[var(--color-text-muted)]">|</span>
                    <span className={`hidden lg:inline ${summaryB.status.className}`}>{summaryB.status.label}</span>
                  </div>
                </div>
              )}
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
                      onClick={() => setLargeFileModeOverride(false)}
                      className="ml-auto px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      {t.showFullRendering}
                    </button>
                  ) : (
                    <button
                      onClick={() => setLargeFileModeOverride(null)}
                      className="ml-auto px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      {t.enableLargeFileMode}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error display */}
        {showParseError && (
          <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/30">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle size={18} />
              <span className="font-medium">{t.xmlParseError}</span>
            </div>
            <p className="mt-1 text-sm text-red-500/80">
              {t.xmlParseErrorDesc}
            </p>
          </div>
        )}

        {showParseWarnings && (
          <div className="px-4 py-2 border-b border-amber-500/30 bg-amber-500/10">
            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-200">
              <AlertTriangle size={14} className="text-amber-300" />
              <span className="font-semibold text-amber-100">{t.xmlWarningLabel}</span>
              {hasParseWarnings ? (
                <span className="text-amber-100/80">{parseWarningText}</span>
              ) : (
                <span className="text-amber-100/80">{t.xmlStrictModeActive}</span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {hasParseWarnings && (
                  <button
                    type="button"
                    onClick={() => setShowWarningDetails(prev => !prev)}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-100/90 transition-colors hover:bg-amber-400/10"
                    aria-expanded={showWarningDetails}
                  >
                    <span>{showWarningDetails ? t.xmlWarningHideDetails : t.xmlWarningViewDetails}</span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${showWarningDetails ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStrictXmlMode(prev => !prev)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                    strictXmlMode
                      ? 'border-amber-300/50 bg-amber-400/20 text-amber-100'
                      : 'border-amber-300/30 text-amber-200 hover:bg-amber-400/10'
                  }`}
                  title={t.xmlStrictModeDesc}
                  aria-pressed={strictXmlMode}
                >
                  {t.xmlStrictMode}
                </button>
              </div>
              <span className="hidden md:inline text-[10px] text-amber-100/70">
                {t.xmlStrictModeDesc}
              </span>
            </div>
            {hasParseWarnings && showWarningDetails && (
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {warningGroups.map(group => (
                  <div
                    key={group.key}
                    className="rounded-md border border-amber-400/20 bg-amber-500/5 p-2 text-[10px]"
                  >
                    <div className="flex items-center justify-between text-[10px] font-semibold text-amber-100">
                      <span>{group.label}</span>
                      <span className="text-amber-100/70">
                        {t.xmlWarningSampleHint
                          .replace('{shown}', String(group.samples.length))
                          .replace('{total}', String(group.count))}
                      </span>
                    </div>
                    {group.samples.length === 0 ? (
                      <div className="mt-2 text-[10px] text-amber-100/60">
                        {t.xmlWarningNoSamples}
                      </div>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {group.samples.map((sample, index) => (
                          <li key={`${group.key}-${sample.path}-${index}`}>
                            <button
                              type="button"
                              onClick={() => handleWarningJump(group.key === 'A' ? 'A' : 'B', sample.path)}
                              className="w-full rounded border border-amber-400/10 bg-amber-500/5 px-2 py-1 text-left transition-colors hover:border-amber-300/40 hover:bg-amber-500/10"
                            >
                              <div className="text-[11px] font-semibold text-amber-100">
                                {sample.name}
                              </div>
                              <div className="font-mono text-[10px] text-amber-100/70">
                                {sample.path}
                              </div>
                              <div className="text-[10px] text-amber-200/70">
                                {formatWarningAttributes(sample.attributes)}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!showParseError && !showEmptyState && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <div className="px-4 pt-2 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1.5 text-[10px] text-[var(--color-text-secondary)]">
                  {viewModeChips.map((chip) => {
                    const isActive = activeView === chip.id;
                    const isRecommended = viewRecommendation.view === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setActiveView(chip.id)}
                        aria-current={isActive ? 'page' : undefined}
                        aria-pressed={isActive}
                        title={`${chip.label} - ${chip.desc}`}
                        className={`flex items-center gap-1 rounded-full border px-2 py-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/70 ${chip.className} ${
                          isActive
                            ? 'ring-2 ring-[var(--color-accent)]/70 shadow-md shadow-[var(--color-accent)]/20 opacity-100'
                            : 'opacity-70 hover:opacity-95'
                        }`}
                      >
                        <span className="text-[var(--color-text-primary)]">{chip.icon}</span>
                        <span className={`font-semibold ${isActive ? 'text-white' : ''}`}>{chip.label}</span>
                        <span className="text-[var(--color-text-muted)]">—</span>
                        <span>{chip.desc}</span>
                        {isRecommended && (
                          <span
                            className={`ml-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                              isActive
                                ? 'border-white/40 text-white'
                                : 'border-[var(--color-accent)]/50 text-[var(--color-accent)]'
                            }`}
                          >
                            {t.viewRecommendBadge}
                          </span>
                        )}
                        {isActive && (
                          <span
                            className="ml-1 h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="ml-auto">
                  <DiffNavigation
                    currentIndex={currentDiffIndex}
                    totalDiffs={totalNavigableDiffs}
                    onNavigate={handleNavigateToDiff}
                  />
                </div>
              </div>
            </div>
            {(showRecommendationHint || showCompareHint) && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
                  {showRecommendationHint && (
                    <button
                      type="button"
                      onClick={() => setActiveView(viewRecommendation.view)}
                      title={`${t.viewRecommendLabel}: ${recommendationLabel} - ${recommendationReason}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/40 px-2 py-1 text-[10px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
                    >
                      <span className="rounded-full border border-[var(--color-accent)]/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                        {t.viewRecommendBadge}
                      </span>
                      <span>{recommendationLabel}</span>
                      <Info size={12} className="text-[var(--color-text-muted)]" />
                    </button>
                  )}
                  <span
                    className="text-[10px] text-[var(--color-text-muted)]"
                    title={activeViewHint}
                  >
                    {t.viewCurrentLabel}: <span className="text-[var(--color-text-secondary)]">{activeViewLabel}</span>
                  </span>
                  {showCompareHint && (
                    <span className="ml-auto text-[10px] font-medium text-amber-300">
                      {t.enterXmlToCompare}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="px-4 pt-1 pb-4">
              <DiffSummary
                diffResults={diffResults}
                activeFilters={activeFilters}
                onFilterToggle={handleFilterToggle}
                onReset={handleResetFilters}
                xmlA={displayXmlA}
                xmlB={displayXmlB}
                activeView={activeView}
                lineLevelStats={lineLevelStats}
                inlineStats={inlineStats}
                treeScope={activeView === 'tree' ? treeScope : undefined}
                treeSummary={activeView === 'tree' ? treeSummary : undefined}
                schemaStats={activeView === 'schema' ? schemaDiff.stats : undefined}
                schemaDiff={activeView === 'schema' ? schemaDiff : undefined}
                schemaScope={activeView === 'schema' ? schemaScope : undefined}
                compact
              />
              {showOverviewControls && (
                <details className="group mt-2 text-xs text-[var(--color-text-secondary)]">
                  <summary className="flex items-center gap-2 cursor-pointer list-none rounded-full border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/40 px-3 py-1.5 text-[10px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60">
                    <ChevronDown
                      size={12}
                      className="text-[var(--color-text-muted)] transition-transform group-open:rotate-180"
                    />
                    <span className="uppercase tracking-wide text-[var(--color-text-muted)]">
                      {t.overviewModeLabel}
                    </span>
                    <span className="text-[var(--color-text-secondary)]">
                      {overviewModeSummary}
                    </span>
                  </summary>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
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
                </details>
              )}
            </div>
          </div>
        )}
        {!showParseError && !showEmptyState && viewSwitching && (
          <div className="px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">
            {t.switchingView.replace('{view}', activeViewLabel)}
          </div>
        )}

        {/* Diff view */}
        {!showParseError && !showEmptyState && (
          <div className="flex-1 overflow-hidden">
            {activeView === 'side-by-side' && (
              <SideBySideView
                xmlA={displayXmlA}
                xmlB={displayXmlB}
                formattedXmlA={displayXmlA}
                formattedXmlB={displayXmlB}
                lineDiffOps={lineDiffOps}
                diffResults={filteredDiffResults}
                activeFilters={activeFilters}
                activeDiffIndex={currentDiffIndex}
                onJumpComplete={handleJumpComplete}
                onNavigate={handleNavigateToDiff}
                onNavCountChange={setSideBySideDiffCount}
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
                xmlA={displayXmlA}
                xmlB={displayXmlB}
                formattedXmlA={displayXmlA}
                formattedXmlB={displayXmlB}
                lineDiff={inlineLineDiff}
                activeFilters={activeFilters}
                activeDiffIndex={currentDiffIndex}
                onJumpComplete={handleJumpComplete}
                onNavigate={handleNavigateToDiff}
                onNavCountChange={setInlineDiffCount}
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
                diffResults={diffResults}
                activeFilters={activeFilters}
                parseResultA={parseResultA}
                parseResultB={parseResultB}
                isLargeFileMode={isLargeFileMode}
                activeDiffIndex={currentDiffIndex}
                onNavigate={handleNavigateToDiff}
                onFilterToggle={handleFilterToggle}
                onResetFilters={handleResetFilters}
                onJumpComplete={handleJumpComplete}
                onNavCountChange={setTreeNavCount}
                onScopeChange={setTreeScope}
                onSummaryChange={setTreeSummary}
              />
            )}
            {activeView === 'schema' && (
              <SchemaView
                schemaDiff={schemaDiff}
                activeFilters={activeFilters}
                schemaScope={schemaScope}
                onScopeChange={setSchemaScope}
                schemaPresetId={schemaPresetId}
                onPresetChange={setSchemaPresetId}
                schemaCustomConfig={schemaCustomConfig}
                onCustomConfigChange={setSchemaCustomConfig}
                activeDiffIndex={currentDiffIndex}
                onNavigate={handleNavigateToDiff}
                onNavCountChange={setSchemaDiffCount}
                onJumpComplete={handleJumpComplete}
                onFilterToggle={handleFilterToggle}
              />
            )}
          </div>
        )}

        {/* Empty state when error */}
        {showParseError && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-[var(--color-text-muted)]">
              <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
              <p>{t.fixErrorsToViewDiff}</p>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-center py-2 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)]">
        <span>{t.footer}</span>
      </footer>
      {appMode === 'single' && (
        <HelpDrawer
          isOpen={isHelpOpen}
          onClose={handleCloseHelp}
          onUseSample={handleUseSample}
        />
      )}
      <PerfDebugPanel />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
