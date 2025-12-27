/**
 * Main App Component
 * XML Diff Tool - Compare two XML documents visually
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ArrowRightLeft, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { Header } from './components/Header';
import type { AppMode } from './components/Header';
import { XMLInputPanel } from './components/XMLInputPanel';
import { ViewTabs } from './components/ViewTabs';
import type { ViewMode } from './components/ViewTabs';
import { DiffSummary } from './components/DiffSummary';
import { DiffNavigation } from './components/DiffNavigation';
import { SideBySideView } from './components/SideBySideView';
import { InlineView } from './components/InlineView';
import { TreeView } from './components/TreeView';
import { FolderUpload } from './components/FolderUpload';
import { BatchProcessor } from './components/BatchProcessor';
import { BatchResultList } from './components/BatchResultList';
import { SingleFileProcessor } from './components/SingleFileProcessor';
import { PerfDebugPanel } from './components/PerfDebugPanel';
import type { DiffResult, DiffType, UnifiedDiffLine } from './core/xml-diff';
import type { ParseResult } from './core/xml-parser';
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

function AppContent() {
  const { t } = useLanguage();
  
  // App mode state
  const [appMode, setAppMode] = useState<AppMode>('single');
  
  // Input state
  const [xmlA, setXmlA] = useState(SAMPLE_XML_A);
  const [xmlB, setXmlB] = useState(SAMPLE_XML_B);
  const [displayXmlA, setDisplayXmlA] = useState(SAMPLE_XML_A);
  const [displayXmlB, setDisplayXmlB] = useState(SAMPLE_XML_B);
  
  // View state
  const [activeView, setActiveView] = useState<ViewMode>('side-by-side');
  const [showInputPanel, setShowInputPanel] = useState(true);
  const inputPanelUserToggledRef = useRef(false);
  const inputPanelAutoCollapsedRef = useRef(false);
  const inputPanelEditedARef = useRef(false);
  const inputPanelEditedBRef = useRef(false);
  const [showFullInputAOverride, setShowFullInputAOverride] = useState<boolean | null>(null);
  const [showFullInputBOverride, setShowFullInputBOverride] = useState<boolean | null>(null);
  const [largeFileModeOverride, setLargeFileModeOverride] = useState<boolean | null>(null);
  const [viewSwitching, setViewSwitching] = useState(false);

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
  const [parseResultA, setParseResultA] = useState<ParseResult>({ success: false, root: null, error: null, rawXML: '' });
  const [parseResultB, setParseResultB] = useState<ParseResult>({ success: false, root: null, error: null, rawXML: '' });
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
  const activeViewRef = useRef<ViewMode>(activeView);
  const pendingJumpIndexRef = useRef<number | null>(null);
  
  const hasParseError = Boolean(parseResultA.error || parseResultB.error);
  const showParseError = hasParseError && singleFileState !== 'processing';
  const showSingleFileProgress =
    singleFileState === 'processing' && singleFileProgress?.stage !== 'done';
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
    return t.sideBySide;
  }, [activeView, t]);

  // Filter diff results based on active filters
  const filteredDiffResults = useMemo(() => {
    return diffResults.filter(result => activeFilters.has(result.type));
  }, [diffResults, activeFilters]);
  
  const resetLineDiffState = useCallback(() => {
    setLineDiffOps([]);
    setInlineLineDiff([]);
    setLineLevelStats({ added: 0, removed: 0, modified: 0, unchanged: 0, total: 0 });
    setInlineStats(null);
    setInlineDiffCount(0);
    setSideBySideDiffCount(0);
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
    } else if (activeView === 'inline') {
      return inlineDiffCount;
    } else {
      return sideBySideDiffCount;
    }
  }, [activeView, treeNavCount, inlineDiffCount, sideBySideDiffCount]);

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
    setShowInputPanel(prev => !prev);
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
      const result = await computeDiff(inputA, inputB, (progress) => {
        setSingleFileProgress(progress);
      });

      markPerf('diff:done');
      measurePerf('measure:diff', 'diff:start', 'diff:done', {
        view: activeViewRef.current,
      });
      clearMarks(['diff:start']);
      clearMeasures('measure:diff');

      setParseResultA(result.parseA);
      setParseResultB(result.parseB);
      setDiffResults(result.results);
      setLineDiffOps(result.lineDiff.ops);
      setInlineLineDiff(result.lineDiff.inlineLines);
      setLineLevelStats({
        added: result.lineDiff.sideBySideStats.added,
        removed: result.lineDiff.sideBySideStats.removed,
        modified: result.lineDiff.sideBySideStats.modified,
        unchanged: result.lineDiff.sideBySideStats.unchanged,
        total: result.lineDiff.sideBySideStats.total,
      });
      setInlineStats(result.lineDiff.inlineStats);
      setInlineDiffCount(result.lineDiff.inlineDiffCount);
      setSideBySideDiffCount(result.lineDiff.sideBySideStats.navigableCount);
      setDisplayXmlA(result.lineDiff.formattedXmlA || inputA);
      setDisplayXmlB(result.lineDiff.formattedXmlB || inputB);
      setSingleFileState('done');
    } catch (error) {
      console.error('Single file diff error:', error);
      setParseResultA({ 
        success: false, 
        root: null, 
        error: error instanceof Error ? error.message : 'Unknown error',
        rawXML: inputA 
      });
      setParseResultB({ 
        success: false, 
        root: null, 
        error: error instanceof Error ? error.message : 'Unknown error',
        rawXML: inputB 
      });
      setDiffResults([]);
      resetLineDiffState();
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
  }, [computeDiff, resetLineDiffState]);

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
          setParseResultA({ success: false, root: null, error: null, rawXML: xmlA });
          setParseResultB({ success: false, root: null, error: null, rawXML: xmlB });
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
      <Header mode={appMode} onModeChange={handleModeChange} />

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
            <div className="flex h-[280px]">
              {/* XML A Input */}
              <div className="flex-1 border-r border-[var(--color-border)]">
                <XMLInputPanel
                  label={t.xmlALabel}
                  value={xmlA}
                  onChange={handleXmlAChange}
                  error={parseResultA.error}
                  placeholder={t.xmlAPlaceholder}
                  isLarge={isLargeInputA}
                  isPreview={!showFullInputA}
                  onShowFull={() => setShowFullInputAOverride(true)}
                  onShowPreview={() => setShowFullInputAOverride(false)}
                />
              </div>

              {/* Swap button */}
              <div className="flex flex-col items-center justify-center px-2 bg-[var(--color-bg-secondary)]">
                <button
                  onClick={handleSwap}
                  className="p-2 rounded-full hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  title={t.swap}
                >
                  <ArrowRightLeft size={20} className="text-[var(--color-accent)]" />
                </button>
              </div>

              {/* XML B Input */}
              <div className="flex-1">
                <XMLInputPanel
                  label={t.xmlBLabel}
                  value={xmlB}
                  onChange={handleXmlBChange}
                  error={parseResultB.error}
                  placeholder={t.xmlBPlaceholder}
                  isLarge={isLargeInputB}
                  isPreview={!showFullInputB}
                  onShowFull={() => setShowFullInputBOverride(true)}
                  onShowPreview={() => setShowFullInputBOverride(false)}
                />
              </div>
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

        {(!showInputPanel || isLargeFile) && (
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

        {!showParseError && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
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
                compact
              />
            </div>
          </div>
        )}
        {!showParseError && viewSwitching && (
          <div className="px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">
            {t.switchingView.replace('{view}', activeViewLabel)}
          </div>
        )}

        {/* Diff view */}
        {!showParseError && (
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
                onNavCountChange={setSideBySideDiffCount}
                disableSyntaxHighlight={isLargeFileMode}
                progressiveRender={isLargeFileMode}
                collapseUnchanged={isLargeFileMode}
                contextLines={3}
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
                onNavCountChange={setInlineDiffCount}
                disableSyntaxHighlight={isLargeFileMode}
                progressiveRender={isLargeFileMode}
                collapseUnchanged={isLargeFileMode}
                contextLines={3}
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
                onJumpComplete={handleJumpComplete}
                onNavCountChange={setTreeNavCount}
                onScopeChange={setTreeScope}
                onSummaryChange={setTreeSummary}
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
