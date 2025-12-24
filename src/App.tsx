/**
 * Main App Component
 * XML Diff Tool - Compare two XML documents visually
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ArrowRightLeft, AlertCircle } from 'lucide-react';
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
import type { DiffResult, DiffType, UnifiedDiffLine } from './core/xml-diff';
import type { ParseResult } from './core/xml-parser';
import { useDiffWorker } from './hooks/useDiffWorker';
import type { BatchProgress, BatchResultItem, InlineLineStats, SingleDiffProgress } from './hooks/useDiffWorker';
import { matchFiles, type FileEntry, type MatchedFilePair } from './utils/file-matcher';
import type { LineDiffOp } from './utils/line-diff';

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
  const [showFullInputAOverride, setShowFullInputAOverride] = useState<boolean | null>(null);
  const [showFullInputBOverride, setShowFullInputBOverride] = useState<boolean | null>(null);
  const [largeFileModeOverride, setLargeFileModeOverride] = useState<boolean | null>(null);

  // Filter state - which diff types to show (unchanged is always shown, not a filter)
  const [activeFilters, setActiveFilters] = useState<Set<DiffType>>(
    new Set(['added', 'removed', 'modified'])
  );

  // Navigation state
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0);
  const diffViewRef = useRef<HTMLDivElement>(null);
  const [treeNavCount, setTreeNavCount] = useState(0);

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

  // Reset navigation index and filters when view changes
  useEffect(() => {
    setCurrentDiffIndex(0);
    setActiveFilters(new Set(['added', 'removed', 'modified']));
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
    
    setCurrentDiffIndex(index);
    
    // Find ALL matching elements (both sides in side-by-side/tree views)
    if (diffViewRef.current) {
      const elements = diffViewRef.current.querySelectorAll(`[data-diff-id="diff-${index}"]`);
      if (elements.length > 0) {
        // Scroll ALL matching elements (each in its own scroll container)
        // This ensures both left and right panels scroll to the correct position
        elements.forEach(element => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight animation
          element.classList.add('diff-highlight-pulse');
          setTimeout(() => {
            element.classList.remove('diff-highlight-pulse');
          }, 1000);
        });
      }
    }
  }, [totalNavigableDiffs]);

  // Swap XML content
  const handleSwap = useCallback(() => {
    setXmlA(xmlB);
    setXmlB(xmlA);
  }, [xmlA, xmlB]);

  // Toggle input panel
  const handleToggleInput = useCallback(() => {
    setShowInputPanel(prev => !prev);
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
    processingRef.current = true;
    setSingleFileState('processing');
    setSingleFileProgress(null);

    try {
      const result = await computeDiff(inputA, inputB, (progress) => {
        setSingleFileProgress(progress);
      });

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
    if (!isLargeFile) {
      setLargeFileModeOverride(null);
    }
  }, [isLargeFile]);

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
                  onChange={setXmlA}
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
                  onChange={setXmlB}
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
        <button
          onClick={handleToggleInput}
          className="flex items-center justify-center gap-2 py-1.5 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors text-xs text-[var(--color-text-muted)]"
        >
          {showInputPanel ? t.collapseInput : t.expandInput}
        </button>

        {!showInputPanel && (
          <div className="px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-text-primary)] font-medium">{t.xmlALabel}</span>
                <span>{summaryA.size}</span>
                <span>{summaryA.chars.toLocaleString()} {t.characters}</span>
                <span>{summaryA.lines.toLocaleString()} {t.lines}</span>
                <span className={summaryA.status.className}>{summaryA.status.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-text-primary)] font-medium">{t.xmlBLabel}</span>
                <span>{summaryB.size}</span>
                <span>{summaryB.chars.toLocaleString()} {t.characters}</span>
                <span>{summaryB.lines.toLocaleString()} {t.lines}</span>
                <span className={summaryB.status.className}>{summaryB.status.label}</span>
              </div>
            </div>
          </div>
        )}

        {isLargeFile && (
          <div className="px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[var(--color-text-primary)] font-medium">
                {t.largeFileMode}
              </span>
              <span>
                {t.largeFileModeDesc}
              </span>
              <div className="flex-1" />
              {isLargeFileMode ? (
                <button
                  onClick={() => setLargeFileModeOverride(false)}
                  className="px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  {t.showFullRendering}
                </button>
              ) : (
                <button
                  onClick={() => setLargeFileModeOverride(null)}
                  className="px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  {t.enableLargeFileMode}
                </button>
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

        {/* Diff summary with filters */}
        {!showParseError && (
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
            />
        )}

        {/* View tabs with navigation */}
        {!showParseError && (
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <ViewTabs activeView={activeView} onViewChange={setActiveView} />
            <DiffNavigation
              currentIndex={currentDiffIndex}
              totalDiffs={totalNavigableDiffs}
              onNavigate={handleNavigateToDiff}
            />
          </div>
        )}

        {/* Diff view */}
        {!showParseError && (
          <div className="flex-1 overflow-hidden" ref={diffViewRef}>
            {activeView === 'side-by-side' && (
              <SideBySideView
                xmlA={displayXmlA}
                xmlB={displayXmlB}
                formattedXmlA={displayXmlA}
                formattedXmlB={displayXmlB}
                lineDiffOps={lineDiffOps}
                diffResults={filteredDiffResults}
                activeFilters={activeFilters}
                disableSyntaxHighlight={isLargeFileMode}
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
                disableSyntaxHighlight={isLargeFileMode}
              />
            )}
            {activeView === 'tree' && (
              <TreeView
                xmlA={displayXmlA}
                xmlB={displayXmlB}
                diffResults={diffResults}
                activeFilters={activeFilters}
                onNavCountChange={setTreeNavCount}
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
