/**
 * Inline View Component
 * Shows unified diff with additions and deletions inline
 */

import { useMemo, useState, useEffect } from 'react';
import { generateLineDiff } from '../core/xml-diff';
import type { UnifiedDiffLine, DiffType } from '../core/xml-diff';
import { prettyPrintXML } from '../utils/pretty-print';
import { useLanguage } from '../contexts/LanguageContext';

interface InlineViewProps {
  xmlA: string;
  xmlB: string;
  activeFilters: Set<DiffType>;
  formattedXmlA?: string;
  formattedXmlB?: string;
  lineDiff?: UnifiedDiffLine[];
  disableSyntaxHighlight?: boolean;
  progressiveRender?: boolean;
  initialRenderCount?: number;
  renderBatchSize?: number;
  collapseUnchanged?: boolean;
  contextLines?: number;
}

export function InlineView({
  xmlA,
  xmlB,
  activeFilters,
  formattedXmlA,
  formattedXmlB,
  lineDiff: providedLineDiff,
  disableSyntaxHighlight = false,
  progressiveRender = false,
  initialRenderCount = 400,
  renderBatchSize = 400,
  collapseUnchanged = false,
  contextLines = 3,
}: InlineViewProps) {
  const { t } = useLanguage();
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
      if (line.type !== 'context') {
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
  }, [lineDiff]);

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
  }, [collapseUnchanged, contextLines, groupedLines]);

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

  if (lineDiff.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        <p>没有可显示的差异</p>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-auto font-mono text-sm">
      {isRendering && totalLines > 0 && (
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
      <div className="min-w-max">
        {visibleItems.map((item) => {
          if (item.type === 'collapse') {
            return (
              <CollapsedInlineLine
                key={`collapse-${item.start}-${item.end}`}
                lineNumberWidth={lineNumberWidth}
                count={item.count}
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
        })}
      </div>
    </div>
  );
}

function CollapsedInlineLine({ lineNumberWidth, count }: { lineNumberWidth: number; count: number }) {
  const { t } = useLanguage();
  return (
    <div className="flex bg-[var(--color-bg-tertiary)]/30 text-[var(--color-text-muted)]">
      <span
        className="flex-shrink-0 px-1 py-0.5 text-right bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] select-none"
        style={{ width: lineNumberWidth }}
      >
        …
      </span>
      <span
        className="flex-shrink-0 px-1 py-0.5 text-right bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] select-none"
        style={{ width: lineNumberWidth }}
      >
        …
      </span>
      <span className="flex-shrink-0 w-6 px-1 py-0.5 text-center font-bold">
        …
      </span>
      <pre className="flex-1 px-2 py-0.5 whitespace-pre overflow-hidden">
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

