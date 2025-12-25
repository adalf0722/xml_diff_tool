/**
 * Side by Side View Component
 * Shows XML A and XML B in parallel panels with synchronized scrolling
 * Uses line-level diff for accurate highlighting
 */

import { forwardRef, useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { DiffResult, DiffType } from '../core/xml-diff';
import { prettyPrintXML } from '../utils/pretty-print';
import { diffLines } from '../utils/line-diff';
import type { LineDiffOp } from '../utils/line-diff';
import { useLanguage } from '../contexts/LanguageContext';

interface SideBySideViewProps {
  xmlA: string;
  xmlB: string;
  formattedXmlA?: string;
  formattedXmlB?: string;
  lineDiffOps?: LineDiffOp[];
  diffResults: DiffResult[];
  activeFilters: Set<DiffType>;
  activeDiffIndex?: number;
  onJumpComplete?: (index: number) => void;
  disableSyntaxHighlight?: boolean;
  progressiveRender?: boolean;
  initialRenderCount?: number;
  renderBatchSize?: number;
  collapseUnchanged?: boolean;
  contextLines?: number;
}

type LineDiffType = 'added' | 'removed' | 'modified' | 'unchanged';

interface AlignedLine {
  left: { lineNumber: number | null; content: string; type: LineDiffType } | null;
  right: { lineNumber: number | null; content: string; type: LineDiffType } | null;
}

const VirtuosoList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div ref={ref} {...props} className={`min-w-max ${props.className || ''}`} />
  )
);

VirtuosoList.displayName = 'VirtuosoList';

export function SideBySideView({
  xmlA,
  xmlB,
  formattedXmlA,
  formattedXmlB,
  lineDiffOps,
  activeFilters,
  activeDiffIndex,
  onJumpComplete,
  disableSyntaxHighlight = false,
  progressiveRender = false,
  initialRenderCount = 400,
  renderBatchSize = 400,
  collapseUnchanged = false,
  contextLines = 3,
}: SideBySideViewProps) {
  const { t } = useLanguage();
  const leftVirtuosoRef = useRef<VirtuosoHandle>(null);
  const rightVirtuosoRef = useRef<VirtuosoHandle>(null);
  const leftScrollerRef = useRef<HTMLElement | null>(null);
  const rightScrollerRef = useRef<HTMLElement | null>(null);
  const isScrolling = useRef(false);

  // Format XML for display
  const formattedA = useMemo(() => {
    return formattedXmlA ?? prettyPrintXML(xmlA);
  }, [formattedXmlA, xmlA]);
  
  const formattedB = useMemo(() => {
    return formattedXmlB ?? prettyPrintXML(xmlB);
  }, [formattedXmlB, xmlB]);

  // Compute aligned lines with diff and assign navigation IDs
  const { alignedLines, diffIndexMap } = useMemo(() => {
    const lines = lineDiffOps
      ? computeAlignedDiffFromOps(lineDiffOps)
      : computeAlignedDiff(formattedA.split('\n'), formattedB.split('\n'));
    
    // Assign sequential diff indices to navigable diff lines
    const indexMap = new Map<number, number>();
    let diffIdx = 0;
    lines.forEach((line, lineIdx) => {
      const leftType = line.left?.type;
      const rightType = line.right?.type;
      // Count as navigable if either side has a diff
      if ((leftType && leftType !== 'unchanged') || (rightType && rightType !== 'unchanged')) {
        indexMap.set(lineIdx, diffIdx);
        diffIdx++;
      }
    });
    
    return { alignedLines: lines, diffIndexMap: indexMap };
  }, [formattedA, formattedB, lineDiffOps]);

  const displayItems = useMemo(() => {
    if (!collapseUnchanged || alignedLines.length === 0) {
      return alignedLines.map((line, lineIndex) => ({
        type: 'line' as const,
        line,
        lineIndex,
      }));
    }

    const total = alignedLines.length;
    const showFlags = new Array<boolean>(total).fill(false);
    const diffIndices: number[] = [];

    alignedLines.forEach((line, index) => {
      const leftType = line.left?.type;
      const rightType = line.right?.type;
      if ((leftType && leftType !== 'unchanged') || (rightType && rightType !== 'unchanged')) {
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

    const items: Array<
      | { type: 'line'; line: AlignedLine; lineIndex: number }
      | { type: 'collapse'; start: number; end: number; count: number }
    > = [];
    let i = 0;
    while (i < total) {
      if (showFlags[i]) {
        items.push({ type: 'line', line: alignedLines[i], lineIndex: i });
        i += 1;
        continue;
      }
      const start = i;
      while (i < total && !showFlags[i]) i += 1;
      const end = i - 1;
      items.push({ type: 'collapse', start, end, count: end - start + 1 });
    }

    return items;
  }, [alignedLines, collapseUnchanged, contextLines]);

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

  // Synchronized scrolling
  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (isScrolling.current) return;
    isScrolling.current = true;

    const sourcePanel = source === 'left' ? leftScrollerRef.current : rightScrollerRef.current;
    const targetPanel = source === 'left' ? rightScrollerRef.current : leftScrollerRef.current;

    if (sourcePanel && targetPanel) {
      targetPanel.scrollTop = sourcePanel.scrollTop;
      targetPanel.scrollLeft = sourcePanel.scrollLeft;
    }

    requestAnimationFrame(() => {
      isScrolling.current = false;
    });
  }, []);

  const handleLeftScroll = useCallback(() => handleScroll('left'), [handleScroll]);
  const handleRightScroll = useCallback(() => handleScroll('right'), [handleScroll]);

  const attachScroller = useCallback((
    side: 'left' | 'right',
    element: HTMLElement | Window | null
  ) => {
    const normalized = element instanceof HTMLElement ? element : null;
    const currentRef = side === 'left' ? leftScrollerRef : rightScrollerRef;
    const handler = side === 'left' ? handleLeftScroll : handleRightScroll;
    if (currentRef.current === normalized) return;
    if (currentRef.current) {
      currentRef.current.removeEventListener('scroll', handler);
    }
    currentRef.current = normalized;
    if (normalized) {
      normalized.addEventListener('scroll', handler, { passive: true });
    }
  }, [handleLeftScroll, handleRightScroll]);

  useEffect(() => {
    return () => {
      leftScrollerRef.current?.removeEventListener('scroll', handleLeftScroll);
      rightScrollerRef.current?.removeEventListener('scroll', handleRightScroll);
    };
  }, [handleLeftScroll, handleRightScroll]);

  useEffect(() => {
    if (activeDiffIndex === undefined || activeDiffIndex < 0) return;
    const targetIndex = diffToDisplayIndex.get(activeDiffIndex);
    if (targetIndex === undefined) return;

    leftVirtuosoRef.current?.scrollToIndex({ index: targetIndex, align: 'center', behavior: 'smooth' });
    rightVirtuosoRef.current?.scrollToIndex({ index: targetIndex, align: 'center', behavior: 'smooth' });

    const selector = `[data-diff-id="diff-${activeDiffIndex}"]`;
    const timer = setTimeout(() => {
      [leftScrollerRef.current, rightScrollerRef.current].forEach(container => {
        if (!container) return;
        const targets = container.querySelectorAll(selector);
        targets.forEach(target => {
          target.classList.add('diff-highlight-pulse');
          setTimeout(() => {
            target.classList.remove('diff-highlight-pulse');
          }, 1000);
        });
      });
      onJumpComplete?.(activeDiffIndex);
    }, 120);

    return () => clearTimeout(timer);
  }, [activeDiffIndex, diffToDisplayIndex, onJumpComplete]);

  const maxLineNumber = Math.max(
    ...alignedLines.map(l => l.left?.lineNumber || 0),
    ...alignedLines.map(l => l.right?.lineNumber || 0)
  );
  const lineNumberWidth = String(maxLineNumber).length * 10 + 20;

  return (
    <div className="relative h-full">
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
      <div className="flex h-full divide-x divide-[var(--color-border)]">
      {/* Left Panel - XML A (Old) */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
            {t.originalXml}
          </h4>
        </div>
        <Virtuoso
          ref={leftVirtuosoRef}
          scrollerRef={(element) => attachScroller('left', element)}
          totalCount={renderItems.length}
          className="flex-1 font-mono text-sm"
          style={{ height: '100%' }}
          itemContent={(index) => {
            const item = renderItems[index];
            if (!item) return null;
            if (item.type === 'collapse') {
              return (
                <CollapsedLine
                  key={`collapse-${item.start}-${item.end}`}
                  lineNumberWidth={lineNumberWidth}
                  count={item.count}
                />
              );
            }
            const diffIdx = diffIndexMap.get(item.lineIndex);
            return (
              <DiffLine
                key={`line-${item.lineIndex}`}
                lineNumber={item.line.left?.lineNumber || null}
                content={item.line.left?.content || ''}
                lineNumberWidth={lineNumberWidth}
                diffType={item.line.left?.type || null}
                isEmpty={!item.line.left}
                activeFilters={activeFilters}
                disableSyntaxHighlight={disableSyntaxHighlight}
                diffPath={diffIdx !== undefined ? `diff-${diffIdx}` : undefined}
              />
            );
          }}
          components={{ List: VirtuosoList }}
        />
      </div>

      {/* Right Panel - XML B (New) */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
            {t.newXml}
          </h4>
        </div>
        <Virtuoso
          ref={rightVirtuosoRef}
          scrollerRef={(element) => attachScroller('right', element)}
          totalCount={renderItems.length}
          className="flex-1 font-mono text-sm"
          style={{ height: '100%' }}
          itemContent={(index) => {
            const item = renderItems[index];
            if (!item) return null;
            if (item.type === 'collapse') {
              return (
                <CollapsedLine
                  key={`collapse-${item.start}-${item.end}`}
                  lineNumberWidth={lineNumberWidth}
                  count={item.count}
                />
              );
            }
            const diffIdx = diffIndexMap.get(item.lineIndex);
            return (
              <DiffLine
                key={`line-${item.lineIndex}`}
                lineNumber={item.line.right?.lineNumber || null}
                content={item.line.right?.content || ''}
                lineNumberWidth={lineNumberWidth}
                diffType={item.line.right?.type || null}
                isEmpty={!item.line.right}
                activeFilters={activeFilters}
                disableSyntaxHighlight={disableSyntaxHighlight}
                diffPath={diffIdx !== undefined ? `diff-${diffIdx}` : undefined}
              />
            );
          }}
          components={{ List: VirtuosoList }}
        />
      </div>
      </div>
    </div>
  );
}

function CollapsedLine({ lineNumberWidth, count }: { lineNumberWidth: number; count: number }) {
  const { t } = useLanguage();
  return (
    <div className="flex bg-[var(--color-bg-tertiary)]/30 text-[var(--color-text-muted)]">
      <span
        className="flex-shrink-0 px-2 py-0.5 text-right bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] select-none"
        style={{ width: lineNumberWidth }}
      >
        …
      </span>
      <pre className="flex-1 px-3 py-0.5 whitespace-pre overflow-hidden">
        {t.collapsedLines.replace('{count}', count.toLocaleString())}
      </pre>
    </div>
  );
}

interface DiffLineProps {
  lineNumber: number | null;
  content: string;
  lineNumberWidth: number;
  diffType: LineDiffType | null;
  isEmpty: boolean;
  activeFilters: Set<DiffType>;
  disableSyntaxHighlight: boolean;
  diffPath?: string;
}

function DiffLine({
  lineNumber,
  content,
  lineNumberWidth,
  diffType,
  isEmpty,
  activeFilters,
  disableSyntaxHighlight,
  diffPath,
}: DiffLineProps) {
  // Only show highlighting if the filter is active
  const shouldHighlight = diffType && diffType !== 'unchanged' && activeFilters.has(diffType);
  
  const getBgClass = () => {
    if (isEmpty) return 'bg-[var(--color-bg-tertiary)]/30';
    if (!shouldHighlight) return '';
    return `diff-${diffType}`;
  };

  return (
    <div 
      className={`flex hover:bg-[var(--color-bg-tertiary)]/50 ${getBgClass()}`}
      data-diff-id={shouldHighlight ? diffPath : undefined}
    >
      <span
        className="flex-shrink-0 px-2 py-0.5 text-right text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] select-none"
        style={{ width: lineNumberWidth }}
      >
        {lineNumber || ''}
      </span>
      <pre className="flex-1 px-3 py-0.5 whitespace-pre overflow-hidden">
        {isEmpty
          ? '\u00A0'
          : disableSyntaxHighlight
            ? content
            : <XMLSyntaxHighlight content={content} />
        }
      </pre>
    </div>
  );
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

/**
 * Compute aligned diff between two arrays of lines
 * Smart classification for intuitive user experience:
 * - Both sides have different content → 'modified' (yellow)
 * - Only left side has content → 'removed' (red, right is empty)
 * - Only right side has content → 'added' (green, left is empty)
 */
function computeAlignedDiff(linesA: string[], linesB: string[]): AlignedLine[] {
  const { ops } = diffLines(linesA, linesB);
  return computeAlignedDiffFromOps(ops);
}

function computeAlignedDiffFromOps(ops: LineDiffOp[]): AlignedLine[] {
  const result: AlignedLine[] = [];
  let lineNumberA = 0;
  let lineNumberB = 0;
  let idx = 0;

  while (idx < ops.length) {
    const op = ops[idx];

    if (op.type === 'equal') {
      lineNumberA++;
      lineNumberB++;
      result.push({
        left: { lineNumber: lineNumberA, content: op.line, type: 'unchanged' },
        right: { lineNumber: lineNumberB, content: op.line, type: 'unchanged' },
      });
      idx++;
      continue;
    }

    const removedLines: { lineNumber: number; content: string }[] = [];
    const addedLines: { lineNumber: number; content: string }[] = [];

    while (idx < ops.length && ops[idx].type !== 'equal') {
      if (ops[idx].type === 'delete') {
        lineNumberA++;
        removedLines.push({ lineNumber: lineNumberA, content: ops[idx].line });
      } else {
        lineNumberB++;
        addedLines.push({ lineNumber: lineNumberB, content: ops[idx].line });
      }
      idx++;
    }

    const maxLen = Math.max(removedLines.length, addedLines.length);
    for (let i = 0; i < maxLen; i++) {
      const removed = removedLines[i];
      const added = addedLines[i];

      if (removed && added) {
        result.push({
          left: { lineNumber: removed.lineNumber, content: removed.content, type: 'modified' },
          right: { lineNumber: added.lineNumber, content: added.content, type: 'modified' },
        });
      } else if (removed) {
        result.push({
          left: { lineNumber: removed.lineNumber, content: removed.content, type: 'removed' },
          right: null,
        });
      } else if (added) {
        result.push({
          left: null,
          right: { lineNumber: added.lineNumber, content: added.content, type: 'added' },
        });
      }
    }
  }

  return result;
}
