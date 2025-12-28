/**
 * Inline View Component
 * Shows unified diff with additions and deletions inline
 */

import { forwardRef, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { generateLineDiff } from '../core/xml-diff';
import type { UnifiedDiffLine, DiffType } from '../core/xml-diff';
import { prettyPrintXML } from '../utils/pretty-print';
import { useLanguage } from '../contexts/LanguageContext';
import { DiffOverviewBar } from './DiffOverviewBar';
import { DiffChunkList, type DiffChunkItem } from './DiffChunkList';

interface InlineViewProps {
  xmlA: string;
  xmlB: string;
  activeFilters: Set<DiffType>;
  formattedXmlA?: string;
  formattedXmlB?: string;
  lineDiff?: UnifiedDiffLine[];
  disableSyntaxHighlight?: boolean;
  activeDiffIndex?: number;
  onJumpComplete?: (index: number) => void;
  onNavigate?: (index: number) => void;
  onNavCountChange?: (count: number) => void;
  onFilterToggle?: (type: DiffType) => void;
  onResetFilters?: () => void;
  progressiveRender?: boolean;
  initialRenderCount?: number;
  renderBatchSize?: number;
  collapseUnchanged?: boolean;
  contextLines?: number;
  overviewMode?: 'minimap' | 'hybrid' | 'chunks';
}

const VirtuosoList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div ref={ref} {...props} className={`min-w-max ${props.className || ''}`} />
  )
);

VirtuosoList.displayName = 'VirtuosoList';

export function InlineView({
  xmlA,
  xmlB,
  activeFilters,
  formattedXmlA,
  formattedXmlB,
  lineDiff: providedLineDiff,
  disableSyntaxHighlight = false,
  activeDiffIndex,
  onJumpComplete,
  onNavigate,
  onNavCountChange,
  onFilterToggle,
  onResetFilters,
  progressiveRender = false,
  initialRenderCount = 400,
  renderBatchSize = 400,
  collapseUnchanged = false,
  contextLines = 3,
  overviewMode = 'minimap',
}: InlineViewProps) {
  const { t } = useLanguage();
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const [scrollInfo, setScrollInfo] = useState({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });
  const scrollInfoRef = useRef<{ scrollTop: number; scrollHeight: number; clientHeight: number } | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const [expandedRanges, setExpandedRanges] = useState<Array<{ start: number; end: number }>>([]);
  const expandPreviewCount = 50;
  const scheduleScrollInfo = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    scrollInfoRef.current = {
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    };
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (scrollInfoRef.current) {
        setScrollInfo(scrollInfoRef.current);
      }
    });
  }, []);
  // Format and generate line diff
  const lineDiff = useMemo(() => {
    if (providedLineDiff) return providedLineDiff;
    const formattedA = formattedXmlA ?? prettyPrintXML(xmlA);
    const formattedB = formattedXmlB ?? prettyPrintXML(xmlB);
    return generateLineDiff(formattedA, formattedB);
  }, [formattedXmlA, formattedXmlB, xmlA, xmlB, providedLineDiff]);

  const maxLineNumber = useMemo(() => {
    let maxOld = 0;
    let maxNew = 0;
    for (const line of lineDiff) {
      if (line.lineNumber.old && line.lineNumber.old > maxOld) {
        maxOld = line.lineNumber.old;
      }
      if (line.lineNumber.new && line.lineNumber.new > maxNew) {
        maxNew = line.lineNumber.new;
      }
    }
    return Math.max(maxOld, maxNew);
  }, [lineDiff]);

  const lineNumberWidth = String(maxLineNumber).length * 10 + 16;

  const { groupedLines, diffIndexMap } = useMemo(() => {
    let diffIdx = 0;
    const indexMap = new Map<number, number>();
    
    lineDiff.forEach((line, idx) => {
      if (line.type !== 'context' && activeFilters.has(line.type as DiffType)) {
        indexMap.set(idx, diffIdx);
        diffIdx++;
      }
    });
    
    const lines = lineDiff.map((line, index) => ({
      ...line,
      isFirstInGroup: index === 0 || lineDiff[index - 1].type !== line.type,
      isLastInGroup: index === lineDiff.length - 1 || lineDiff[index + 1].type !== line.type,
    }));
    
    return { groupedLines: lines, diffIndexMap: indexMap };
  }, [lineDiff, activeFilters]);

  const displayItems = useMemo(() => {
    if (!collapseUnchanged || groupedLines.length === 0) {
      return groupedLines.map((line, lineIndex) => ({
        type: 'line' as const,
        line,
        lineIndex,
      }));
    }

    const total = groupedLines.length;
    const showFlags = new Array<boolean>(total).fill(false);
    const diffIndices: number[] = [];

    groupedLines.forEach((line, index) => {
      if (line.type !== 'context') {
        diffIndices.push(index);
      }
    });

    if (diffIndices.length === 0) {
      const visibleCount = Math.min(contextLines, total);
      for (let i = 0; i < visibleCount; i += 1) {
        showFlags[i] = true;
      }
    } else {
      diffIndices.forEach(index => {
        const start = Math.max(0, index - contextLines);
        const end = Math.min(total - 1, index + contextLines);
        for (let i = start; i <= end; i += 1) {
          showFlags[i] = true;
        }
      });
    }

    if (expandedRanges.length > 0) {
      expandedRanges.forEach(({ start, end }) => {
        const clampedStart = Math.max(0, Math.min(start, total - 1));
        const clampedEnd = Math.max(clampedStart, Math.min(end, total - 1));
        for (let i = clampedStart; i <= clampedEnd; i += 1) {
          showFlags[i] = true;
        }
      });
    }

    const items: Array<
      | { type: 'line'; line: UnifiedDiffLine & { isFirstInGroup: boolean; isLastInGroup: boolean }; lineIndex: number }
      | { type: 'collapse'; start: number; end: number; count: number }
    > = [];
    let i = 0;
    while (i < total) {
      if (showFlags[i]) {
        items.push({ type: 'line', line: groupedLines[i], lineIndex: i });
        i += 1;
        continue;
      }
      const start = i;
      while (i < total && !showFlags[i]) i += 1;
      const end = i - 1;
      items.push({ type: 'collapse', start, end, count: end - start + 1 });
    }

    return items;
  }, [collapseUnchanged, contextLines, groupedLines, expandedRanges]);

  useEffect(() => {
    if (!collapseUnchanged) {
      setExpandedRanges([]);
    }
  }, [collapseUnchanged]);

  useEffect(() => {
    setExpandedRanges([]);
  }, [groupedLines.length]);

  const totalLines = displayItems.length;
  const [visibleCount, setVisibleCount] = useState(() => {
    if (!progressiveRender) return totalLines;
    return Math.min(initialRenderCount, totalLines);
  });
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!progressiveRender) {
      setVisibleCount(totalLines);
      setIsRendering(false);
      return;
    }

    let cancelled = false;
    const initialCount = Math.min(initialRenderCount, totalLines);
    setVisibleCount(initialCount);
    setIsRendering(initialCount < totalLines);

    let current = initialCount;
    const step = () => {
      if (cancelled) return;
      current = Math.min(current + renderBatchSize, totalLines);
      setVisibleCount(current);
      setIsRendering(current < totalLines);
      if (current < totalLines) {
        requestAnimationFrame(step);
      }
    };

    if (initialCount < totalLines) {
      requestAnimationFrame(step);
    }

    return () => {
      cancelled = true;
    };
  }, [progressiveRender, totalLines, initialRenderCount, renderBatchSize]);

  const visibleItems = useMemo(() => {
    return displayItems.slice(0, visibleCount);
  }, [displayItems, visibleCount]);

  const useVirtualization = true;
  const renderItems = useVirtualization ? displayItems : visibleItems;
  const showRendering = progressiveRender && isRendering && !useVirtualization;

  const diffToDisplayIndex = useMemo(() => {
    const map = new Map<number, number>();
    renderItems.forEach((item, displayIndex) => {
      if (item.type !== 'line') return;
      const diffIdx = diffIndexMap.get(item.lineIndex);
      if (diffIdx !== undefined && !map.has(diffIdx)) {
        map.set(diffIdx, displayIndex);
      }
    });
    return map;
  }, [diffIndexMap, renderItems]);

  const diffToLineIndex = useMemo(() => {
    const map = new Map<number, number>();
    diffIndexMap.forEach((diffIdx, lineIdx) => {
      if (!map.has(diffIdx)) {
        map.set(diffIdx, lineIdx);
      }
    });
    return map;
  }, [diffIndexMap]);

  const overviewMarkers = useMemo(() => {
    const markers: Array<{
      diffIndex: number;
      lineIndex: number;
      type: 'added' | 'removed' | 'modified';
      side: 'A' | 'B';
    }> = [];
    diffToLineIndex.forEach((lineIndex, diffIndex) => {
      const lineType = groupedLines[lineIndex]?.type;
      if (lineType === 'added') {
        markers.push({ diffIndex, lineIndex, type: 'added', side: 'B' });
        return;
      }
      if (lineType === 'removed') {
        markers.push({ diffIndex, lineIndex, type: 'removed', side: 'A' });
        return;
      }
      if (lineType === 'modified') {
        markers.push({ diffIndex, lineIndex, type: 'modified', side: 'A' });
        markers.push({ diffIndex, lineIndex, type: 'modified', side: 'B' });
      }
    });
    return markers;
  }, [diffToLineIndex, groupedLines]);

  const overviewViewport = useMemo(() => {
    if (!scrollInfo.scrollHeight || !scrollInfo.clientHeight) return null;
    const start = scrollInfo.scrollTop / scrollInfo.scrollHeight;
    const size = scrollInfo.clientHeight / scrollInfo.scrollHeight;
    return {
      start: Math.max(0, Math.min(1, start)),
      end: Math.max(0, Math.min(1, start + size)),
    };
  }, [scrollInfo]);

  const handleScroll = useCallback(() => {
    if (!scrollerRef.current) return;
    scheduleScrollInfo(scrollerRef.current);
  }, [scheduleScrollInfo]);

  useEffect(() => {
    onNavCountChange?.(diffIndexMap.size);
  }, [diffIndexMap.size, onNavCountChange]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.addEventListener('scroll', handleScroll, { passive: true });
    scheduleScrollInfo(node);
    return () => node.removeEventListener('scroll', handleScroll);
  }, [handleScroll, scheduleScrollInfo]);

  const addExpandedRange = useCallback((start: number, end: number) => {
    const total = groupedLines.length;
    if (total === 0) return;
    const clampedStart = Math.max(0, Math.min(start, total - 1));
    const clampedEnd = Math.max(clampedStart, Math.min(end, total - 1));

    setExpandedRanges(prev => {
      const ranges = [...prev, { start: clampedStart, end: clampedEnd }]
        .sort((a, b) => a.start - b.start);
      const merged: Array<{ start: number; end: number }> = [];
      for (const range of ranges) {
        if (merged.length === 0) {
          merged.push({ ...range });
          continue;
        }
        const last = merged[merged.length - 1];
        if (range.start <= last.end + 1) {
          last.end = Math.max(last.end, range.end);
        } else {
          merged.push({ ...range });
        }
      }
      return merged;
    });
  }, [groupedLines.length]);

  useEffect(() => {
    if (activeDiffIndex === undefined || activeDiffIndex < 0) return;
    const targetLineIndex = diffToLineIndex.get(activeDiffIndex);
    if (targetLineIndex === undefined) return;
    const targetIndex = diffToDisplayIndex.get(activeDiffIndex);
    if (targetIndex === undefined) {
      if (collapseUnchanged) {
        addExpandedRange(targetLineIndex - contextLines, targetLineIndex + contextLines);
      }
      return;
    }

    virtuosoRef.current?.scrollToIndex({ index: targetIndex, align: 'center', behavior: 'smooth' });

    const selector = `[data-diff-id="diff-${activeDiffIndex}"]`;
    const timer = setTimeout(() => {
      const container = scrollerRef.current;
      if (!container) return;
      const targets = container.querySelectorAll(selector);
      targets.forEach(target => {
        target.classList.add('diff-highlight-pulse');
        setTimeout(() => {
          target.classList.remove('diff-highlight-pulse');
        }, 1000);
      });
      onJumpComplete?.(activeDiffIndex);
    }, 120);

    return () => clearTimeout(timer);
  }, [
    activeDiffIndex,
    addExpandedRange,
    collapseUnchanged,
    contextLines,
    diffToDisplayIndex,
    diffToLineIndex,
  onJumpComplete,
  ]);

  const chunkItems: DiffChunkItem[] = useMemo(() => {
    if (groupedLines.length === 0) return [];
    const diffIndices: number[] = [];
    groupedLines.forEach((line, index) => {
      if (line.type !== 'context' && activeFilters.has(line.type as DiffType)) {
        diffIndices.push(index);
      }
    });
    if (diffIndices.length === 0) return [];

    const gapLimit = Math.max(1, contextLines * 2 + 1);
    const ranges: Array<{ start: number; end: number }> = [];
    let start = diffIndices[0];
    let prev = diffIndices[0];
    for (let i = 1; i < diffIndices.length; i += 1) {
      const index = diffIndices[i];
      if (index - prev <= gapLimit) {
        prev = index;
        continue;
      }
      ranges.push({ start, end: prev });
      start = index;
      prev = index;
    }
    ranges.push({ start, end: prev });

    return ranges
      .map((range, idx) => {
        let added = 0;
        let removed = 0;
        let modified = 0;
        let diffIndexStart = Number.POSITIVE_INFINITY;
        let diffIndexEnd = -1;

        for (let lineIndex = range.start; lineIndex <= range.end; lineIndex += 1) {
          const lineType = groupedLines[lineIndex]?.type ?? 'context';
          if (lineType !== 'context' && activeFilters.has(lineType as DiffType)) {
            if (lineType === 'added') added += 1;
            if (lineType === 'removed') removed += 1;
            if (lineType === 'modified') modified += 1;
          }
          const diffIdx = diffIndexMap.get(lineIndex);
          if (diffIdx !== undefined) {
            diffIndexStart = Math.min(diffIndexStart, diffIdx);
            diffIndexEnd = Math.max(diffIndexEnd, diffIdx);
          }
        }

        if (!Number.isFinite(diffIndexStart)) return null;

        const label = `${t.chunkLabel} ${idx + 1}`;
        const rangeLabel = t.chunkRangeLabel
          .replace('{start}', (range.start + 1).toString())
          .replace('{end}', (range.end + 1).toString());

        return {
          id: `chunk-${range.start}-${range.end}`,
          label,
          rangeLabel,
          diffIndexStart,
          diffIndexEnd,
          counts: { added, removed, modified },
        };
      })
      .filter((item): item is DiffChunkItem => item !== null);
  }, [activeFilters, contextLines, diffIndexMap, groupedLines, t]);

  if (lineDiff.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        <p>没有可显示的差异</p>
      </div>
    );
  }

  const showChunkList = (overviewMode === 'hybrid' || overviewMode === 'chunks') && chunkItems.length > 0;
  const showOverviewBar = overviewMode !== 'chunks';

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="relative flex-1 min-h-0 font-mono text-sm">
        {showRendering && totalLines > 0 && (
          <div className="absolute right-3 top-2 z-10 rounded-full border border-[var(--color-diff-modified-border)] bg-[var(--color-diff-modified-bg)] px-3 py-1 text-xs font-semibold text-[var(--color-diff-modified-text)] shadow-sm pointer-events-none flex items-center gap-2">
            <span className="absolute inset-0 rounded-full bg-[var(--color-diff-modified-bg)] opacity-70 animate-pulse" />
            <span
              className="h-2 w-2 rounded-full bg-[var(--color-diff-modified-border)]"
              style={{ boxShadow: '0 0 8px var(--color-diff-modified-border)' }}
            />
            <span className="relative">
              {t.renderingLines
                .replace('{current}', visibleCount.toLocaleString())
                .replace('{total}', totalLines.toLocaleString())}
            </span>
          </div>
        )}
        {showOverviewBar && (
          <DiffOverviewBar
            totalLines={groupedLines.length}
            markers={overviewMarkers}
            activeIndex={activeDiffIndex}
            onSelect={onNavigate}
            viewport={overviewViewport}
          />
        )}
        <Virtuoso
          ref={virtuosoRef}
          scrollerRef={(element) => {
            scrollerRef.current = element instanceof HTMLElement ? element : null;
            if (scrollerRef.current) {
              scheduleScrollInfo(scrollerRef.current);
            }
          }}
          totalCount={renderItems.length}
          className="h-full"
          style={{ height: '100%' }}
          itemContent={(index) => {
            const item = renderItems[index];
            if (!item) return null;
            if (item.type === 'collapse') {
              return (
                <CollapsedInlineLine
                  key={`collapse-${item.start}-${item.end}`}
                  lineNumberWidth={lineNumberWidth}
                  count={item.count}
                  onExpand={() => addExpandedRange(item.start, item.end)}
                  onExpandChunk={() => addExpandedRange(item.start, item.start + expandPreviewCount - 1)}
                  expandLabel={t.expandSection}
                  expandChunkLabel={t.expandLines.replace('{count}', expandPreviewCount.toLocaleString())}
                />
              );
            }
            const diffIdx = diffIndexMap.get(item.lineIndex);
            return (
              <InlineDiffLine
                key={`line-${item.lineIndex}`}
                line={item.line}
                lineNumberWidth={lineNumberWidth}
                activeFilters={activeFilters}
                disableSyntaxHighlight={disableSyntaxHighlight}
                diffPath={diffIdx !== undefined ? `diff-${diffIdx}` : undefined}
              />
            );
          }}
          components={{ List: VirtuosoList }}
        />
      </div>
      {showChunkList && onFilterToggle && onResetFilters && (
        <div className="md:w-64 border-t md:border-t-0 md:border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <DiffChunkList
            title={t.chunkListTitle}
            chunks={chunkItems}
            activeDiffIndex={activeDiffIndex}
            activeFilters={activeFilters}
            onFilterToggle={onFilterToggle}
            onResetFilters={onResetFilters}
            allowModified={false}
            onSelect={onNavigate}
            className="h-full"
          />
        </div>
      )}
    </div>
  );
}

function CollapsedInlineLine({
  lineNumberWidth,
  count,
  onExpand,
  onExpandChunk,
  expandLabel,
  expandChunkLabel,
}: {
  lineNumberWidth: number;
  count: number;
  onExpand: () => void;
  onExpandChunk: () => void;
  expandLabel: string;
  expandChunkLabel: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center bg-[var(--color-bg-tertiary)]/30 text-[var(--color-text-muted)]">
      <span
        className="flex-shrink-0 px-1 py-0.5 text-right bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] select-none"
        style={{ width: lineNumberWidth }}
      >
        ...</span>
      <span
        className="flex-shrink-0 px-1 py-0.5 text-right bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] select-none"
        style={{ width: lineNumberWidth }}
      >
        ...</span>
      <span className="flex-shrink-0 w-6 px-1 py-0.5 text-center font-bold">
        ...</span>
      <div className="flex flex-shrink-0 items-center gap-2 px-2">
        <button
          type="button"
          onClick={onExpand}
          className="rounded bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-accent-hover)]"
        >
          {expandLabel}
        </button>
        <button
          type="button"
          onClick={onExpandChunk}
          className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
        >
          {expandChunkLabel}
        </button>
      </div>
      <pre className="flex-1 px-2 py-0.5 whitespace-pre overflow-hidden text-[var(--color-text-secondary)]">
        {t.collapsedLines.replace('{count}', count.toLocaleString())}
      </pre>
    </div>
  );
}

interface InlineDiffLineProps {
  line: UnifiedDiffLine & { isFirstInGroup: boolean; isLastInGroup: boolean };
  lineNumberWidth: number;
  activeFilters: Set<DiffType>;
  disableSyntaxHighlight: boolean;
  diffPath?: string;
}

function InlineDiffLine({ line, lineNumberWidth, activeFilters, disableSyntaxHighlight, diffPath }: InlineDiffLineProps) {
  const { t } = useLanguage();
  // Determine if this line should be highlighted based on active filters
  // In inline view (Unified Diff format): only 'added', 'removed' filters apply
  // 'context' lines are always shown (no highlight)
  // 'modified' filter is NOT applicable in inline view
  const shouldHighlight = (() => {
    if (line.type === 'context') {
      return false; // Context lines are never highlighted
    }
    if (line.type === 'added') {
      return activeFilters.has('added');
    }
    if (line.type === 'removed') {
      return activeFilters.has('removed');
    }
    return false;
  })();
  
  const bgClass = shouldHighlight ? getBgClass(line.type) : '';
  const prefixChar = shouldHighlight ? getPrefixChar(line.type) : ' ';
  const prefixColor = shouldHighlight ? getPrefixColor(line.type) : '';
  const sideOnlyLabel =
    line.type === 'removed' ? t.sideOnlyA : line.type === 'added' ? t.sideOnlyB : null;
  const sideOnlyClass =
    line.type === 'removed'
      ? 'border-red-500/40 bg-red-500/15 text-red-300'
      : 'border-green-500/40 bg-green-500/15 text-green-300';

  return (
    <div 
      className={`flex hover:brightness-95 ${bgClass}`}
      data-diff-id={diffPath && shouldHighlight ? diffPath : undefined}
    >
      {/* Old line number */}
      <span
        className="flex-shrink-0 px-1 py-0.5 text-right text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] select-none"
        style={{ width: lineNumberWidth }}
      >
        {line.lineNumber.old || ''}
      </span>
      
      {/* New line number */}
      <span
        className="flex-shrink-0 px-1 py-0.5 text-right text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] select-none"
        style={{ width: lineNumberWidth }}
      >
        {line.lineNumber.new || ''}
      </span>

      {/* Prefix (+/-/ ) */}
      <span
        className={`flex-shrink-0 w-6 px-1 py-0.5 text-center font-bold ${prefixColor}`}
      >
        {prefixChar}
      </span>

      {/* Content */}
      <pre className="flex-1 px-2 py-0.5 whitespace-pre overflow-hidden">
        {disableSyntaxHighlight ? (line.content || '\u00A0') : <XMLSyntaxHighlight content={line.content} />}
      </pre>
      {sideOnlyLabel && (
        <span className={`mr-2 self-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${sideOnlyClass}`}>
          {sideOnlyLabel}
        </span>
      )}
    </div>
  );
}

function getBgClass(type: UnifiedDiffLine['type']): string {
  switch (type) {
    case 'added':
      return 'diff-added';
    case 'removed':
      return 'diff-removed';
    case 'modified':
      return 'diff-modified';
    default:
      return '';
  }
}

function getPrefixChar(type: UnifiedDiffLine['type']): string {
  switch (type) {
    case 'added':
      return '+';
    case 'removed':
      return '-';
    case 'modified':
      return '~';
    default:
      return ' ';
  }
}

function getPrefixColor(type: UnifiedDiffLine['type']): string {
  switch (type) {
    case 'added':
      return 'text-green-600 dark:text-green-400';
    case 'removed':
      return 'text-red-600 dark:text-red-400';
    case 'modified':
      return 'text-yellow-600 dark:text-yellow-400';
    default:
      return 'text-[var(--color-text-muted)]';
  }
}

function XMLSyntaxHighlight({ content }: { content: string }) {
  // Parse XML content and apply syntax highlighting using React elements
  // This is safe from XSS as we're creating React elements, not using innerHTML
  
  if (!content) return <span>{'\u00A0'}</span>;
  
  const elements: React.ReactNode[] = [];
  let remaining = content;
  let key = 0;
  
  // Regex patterns for XML syntax
  const patterns = [
    // Comments: <!-- ... -->
    { regex: /^(<!--[\s\S]*?-->)/, className: 'xml-comment' },
    // CDATA: <![CDATA[ ... ]]>
    { regex: /^(<!\[CDATA\[[\s\S]*?\]\]>)/, className: 'xml-cdata' },
    // Opening tag with attributes: <tagname attr="value">
    { regex: /^(<\/?)([\w:.-]+)/, handler: (match: RegExpMatchArray) => {
      elements.push(<span key={key++} className="text-[var(--color-text-muted)]">{match[1]}</span>);
      elements.push(<span key={key++} className="xml-tag">{match[2]}</span>);
      return match[0].length;
    }},
    // Attribute name and value: attr="value"
    { regex: /^(\s+)([\w:.-]+)(=)("[^"]*"|'[^']*')/, handler: (match: RegExpMatchArray) => {
      elements.push(<span key={key++}>{match[1]}</span>);
      elements.push(<span key={key++} className="xml-attr-name">{match[2]}</span>);
      elements.push(<span key={key++} className="text-[var(--color-text-muted)]">{match[3]}</span>);
      elements.push(<span key={key++} className="xml-attr-value">{match[4]}</span>);
      return match[0].length;
    }},
    // Closing bracket: > or />
    { regex: /^(\s*\/?>)/, className: 'text-[var(--color-text-muted)]' },
    // Text content between tags
    { regex: /^([^<]+)/, className: 'xml-text' },
  ];
  
  while (remaining.length > 0) {
    let matched = false;
    
    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex);
      if (match) {
        if (pattern.handler) {
          const consumed = pattern.handler(match);
          remaining = remaining.slice(consumed);
        } else {
          elements.push(
            <span key={key++} className={pattern.className}>
              {match[1]}
            </span>
          );
          remaining = remaining.slice(match[1].length);
        }
        matched = true;
        break;
      }
    }
    
    // If no pattern matched, consume one character
    if (!matched) {
      elements.push(<span key={key++}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }
  }
  
  return <>{elements}</>;
}

