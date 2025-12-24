/**
 * Inline View Component
 * Shows unified diff with additions and deletions inline
 */

import { useMemo } from 'react';
import { generateLineDiff } from '../core/xml-diff';
import type { UnifiedDiffLine, DiffType } from '../core/xml-diff';
import { prettyPrintXML } from '../utils/pretty-print';

interface InlineViewProps {
  xmlA: string;
  xmlB: string;
  activeFilters: Set<DiffType>;
  formattedXmlA?: string;
  formattedXmlB?: string;
  lineDiff?: UnifiedDiffLine[];
  disableSyntaxHighlight?: boolean;
}

export function InlineView({
  xmlA,
  xmlB,
  activeFilters,
  formattedXmlA,
  formattedXmlB,
  lineDiff: providedLineDiff,
  disableSyntaxHighlight = false,
}: InlineViewProps) {
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

  // Group consecutive changes for context and assign navigation IDs
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

  if (lineDiff.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        <p>没有可显示的差异</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto font-mono text-sm">
      <div className="min-w-max">
        {groupedLines.map((line, index) => {
          const diffIdx = diffIndexMap.get(index);
          return (
            <InlineDiffLine
              key={index}
              line={line}
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

