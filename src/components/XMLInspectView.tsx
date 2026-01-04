import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type InspectItem =
  | {
      type: 'line';
      lineIndex: number;
      content: string;
      isFoldStart: boolean;
      isCollapsed: boolean;
    }
  | {
      type: 'collapse';
      foldStart: number;
      count: number;
    };

interface InspectTreeNode {
  id: string;
  name: string;
  lineIndex: number;
  attrsSummary: string | null;
  children: InspectTreeNode[];
}

interface InspectTreeItem {
  id: string;
  name: string;
  lineIndex: number;
  attrsSummary: string | null;
  depth: number;
  hasChildren: boolean;
}

const TAG_REGEX = /<[^>]+>/g;

const VirtuosoList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div ref={ref} {...props} className={`min-w-max ${props.className || ''}`} />
  )
);

VirtuosoList.displayName = 'VirtuosoList';

function extractTagName(token: string) {
  const trimmed = token.trim();
  if (trimmed.startsWith('<?') || trimmed.startsWith('<!')) {
    return null;
  }
  if (trimmed.startsWith('</')) {
    const match = trimmed.match(/^<\/\s*([^\s>]+)\s*>/);
    return match ? { type: 'close' as const, name: match[1] } : null;
  }
  const isSelfClosing = trimmed.endsWith('/>');
  const match = trimmed.match(/^<\s*([^\s/>]+)/);
  if (!match) return null;
  return {
    type: isSelfClosing ? ('self' as const) : ('open' as const),
    name: match[1],
  };
}

function extractAttributes(token: string) {
  const attrs: Array<{ key: string; value: string }> = [];
  const regex = /([^\s=]+)\s*=\s*(".*?"|'.*?')/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(token)) !== null) {
    attrs.push({ key: match[1], value: match[2] });
  }
  return attrs;
}

function buildAttrsSummary(token: string) {
  const attrs = extractAttributes(token);
  if (attrs.length === 0) return null;
  const preferred = attrs.find(attr => attr.key === 'name') ?? attrs.find(attr => attr.key === 'id');
  const pick = preferred ?? attrs[0];
  return `${pick.key}=${pick.value}`;
}

function buildFoldRanges(lines: string[]) {
  const ranges = new Map<number, number>();
  const stack: Array<{ name: string; lineIndex: number }> = [];

  lines.forEach((line, lineIndex) => {
    const matches = line.matchAll(TAG_REGEX);
    for (const match of matches) {
      const token = match[0];
      const info = extractTagName(token);
      if (!info) continue;
      if (info.type === 'open') {
        stack.push({ name: info.name, lineIndex });
        continue;
      }
      if (info.type === 'self') {
        continue;
      }
      const matchIndex = [...stack].reverse().findIndex(entry => entry.name === info.name);
      if (matchIndex === -1) continue;
      const stackIndex = stack.length - 1 - matchIndex;
      const start = stack[stackIndex].lineIndex;
      stack.splice(stackIndex, stack.length - stackIndex);
      if (lineIndex - start >= 2) {
        ranges.set(start, lineIndex);
      }
    }
  });

  return ranges;
}

function buildInspectTree(lines: string[]) {
  const roots: InspectTreeNode[] = [];
  const stack: InspectTreeNode[] = [];
  let nodeId = 0;

  lines.forEach((line, lineIndex) => {
    const matches = line.matchAll(TAG_REGEX);
    for (const match of matches) {
      const token = match[0];
      const info = extractTagName(token);
      if (!info) continue;
      if (info.type === 'open') {
        const node: InspectTreeNode = {
          id: `node-${nodeId++}`,
          name: info.name,
          lineIndex,
          attrsSummary: buildAttrsSummary(token),
          children: [],
        };
        const parent = stack[stack.length - 1];
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
        stack.push(node);
        continue;
      }
      if (info.type === 'self') {
        const node: InspectTreeNode = {
          id: `node-${nodeId++}`,
          name: info.name,
          lineIndex,
          attrsSummary: buildAttrsSummary(token),
          children: [],
        };
        const parent = stack[stack.length - 1];
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
        continue;
      }
      const matchIndex = [...stack].reverse().findIndex(entry => entry.name === info.name);
      if (matchIndex === -1) continue;
      const stackIndex = stack.length - 1 - matchIndex;
      stack.splice(stackIndex, stack.length - stackIndex);
    }
  });

  return roots;
}

function flattenInspectTree(
  nodes: InspectTreeNode[],
  collapsed: Set<string>,
  depth: number = 0
) {
  const items: InspectTreeItem[] = [];
  for (const node of nodes) {
    const hasChildren = node.children.length > 0;
    items.push({
      id: node.id,
      name: node.name,
      lineIndex: node.lineIndex,
      attrsSummary: node.attrsSummary,
      depth,
      hasChildren,
    });
    if (hasChildren && !collapsed.has(node.id)) {
      items.push(...flattenInspectTree(node.children, collapsed, depth + 1));
    }
  }
  return items;
}

function buildDisplayItems(
  lines: string[],
  foldRanges: Map<number, number>,
  collapsed: Set<number>
) {
  const items: InspectItem[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const foldEnd = foldRanges.get(i);
    const isFoldStart = foldEnd !== undefined;
    const isCollapsed = isFoldStart && collapsed.has(i);
    items.push({
      type: 'line',
      lineIndex: i,
      content: lines[i],
      isFoldStart,
      isCollapsed,
    });
    if (isCollapsed && foldEnd !== undefined) {
      const hiddenCount = Math.max(0, foldEnd - i - 1);
      if (hiddenCount > 0) {
        items.push({ type: 'collapse', foldStart: i, count: hiddenCount });
      }
      i = foldEnd - 1;
    }
  }
  return items;
}

export function XMLInspectView({ value }: { value: string }) {
  const { t } = useLanguage();
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const lines = useMemo(() => (value ? value.split('\n') : ['']), [value]);
  const foldRanges = useMemo(() => buildFoldRanges(lines), [lines]);
  const foldStarts = useMemo(() => Array.from(foldRanges.keys()).sort((a, b) => a - b), [foldRanges]);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [treeCollapsed, setTreeCollapsed] = useState<Set<string>>(new Set());
  const [pendingLine, setPendingLine] = useState<number | null>(null);
  const [highlightLine, setHighlightLine] = useState<number | null>(null);

  useEffect(() => {
    setCollapsed(new Set());
    setTreeCollapsed(new Set());
  }, [value]);

  const toggleFold = useCallback((start: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(start)) {
        next.delete(start);
      } else {
        next.add(start);
      }
      return next;
    });
  }, []);

  const handleCollapseAll = useCallback(() => {
    setCollapsed(new Set(foldStarts));
  }, [foldStarts]);

  const handleExpandAll = useCallback(() => {
    setCollapsed(new Set());
  }, []);

  const treeRoots = useMemo(() => buildInspectTree(lines), [lines]);
  const treeItems = useMemo(
    () => flattenInspectTree(treeRoots, treeCollapsed),
    [treeRoots, treeCollapsed]
  );

  const toggleTreeNode = useCallback((nodeId: string) => {
    setTreeCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const items = useMemo(
    () => buildDisplayItems(lines, foldRanges, collapsed),
    [collapsed, foldRanges, lines]
  );
  const lineIndexToItemIndex = useMemo(() => {
    const map = new Map<number, number>();
    items.forEach((item, index) => {
      if (item.type === 'line') {
        map.set(item.lineIndex, index);
      }
    });
    return map;
  }, [items]);

  const lineNumberWidth = useMemo(() => {
    const digits = Math.max(2, String(lines.length).length);
    return digits * 8 + 18;
  }, [lines.length]);
  const toggleWidth = 22;

  const scrollToLine = useCallback((lineIndex: number) => {
    const toExpand: number[] = [];
    foldRanges.forEach((end, start) => {
      if (start < lineIndex && lineIndex <= end && collapsed.has(start)) {
        toExpand.push(start);
      }
    });
    if (toExpand.length > 0) {
      setCollapsed(prev => {
        const next = new Set(prev);
        toExpand.forEach(start => next.delete(start));
        return next;
      });
      setPendingLine(lineIndex);
      return;
    }
    const itemIndex = lineIndexToItemIndex.get(lineIndex);
    if (itemIndex === undefined) return;
    virtuosoRef.current?.scrollToIndex({ index: itemIndex, align: 'center', behavior: 'smooth' });
    setHighlightLine(lineIndex);
  }, [collapsed, foldRanges, lineIndexToItemIndex]);

  useEffect(() => {
    if (pendingLine === null) return;
    const itemIndex = lineIndexToItemIndex.get(pendingLine);
    if (itemIndex === undefined) return;
    virtuosoRef.current?.scrollToIndex({ index: itemIndex, align: 'center', behavior: 'smooth' });
    setHighlightLine(pendingLine);
    setPendingLine(null);
  }, [lineIndexToItemIndex, pendingLine]);

  useEffect(() => {
    if (highlightLine === null) return;
    const timer = setTimeout(() => {
      setHighlightLine(null);
    }, 900);
    return () => clearTimeout(timer);
  }, [highlightLine]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-muted)]">
        <span>{t.inspectMode}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCollapseAll}
            disabled={foldStarts.length === 0}
            className="px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t.collapseAll}
          </button>
          <button
            type="button"
            onClick={handleExpandAll}
            disabled={foldStarts.length === 0}
            className="px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t.expandAll}
          </button>
        </div>
      </div>
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="md:w-64 border-b md:border-b-0 md:border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            {t.inspectTreeTitle}
          </div>
          {treeItems.length === 0 ? (
            <div className="px-3 pb-3 text-xs text-[var(--color-text-muted)]">
              {t.inspectTreeEmpty}
            </div>
          ) : (
            <Virtuoso
              totalCount={treeItems.length}
              className="h-40 md:h-full"
              style={{ height: '100%' }}
              components={{ List: VirtuosoList }}
              itemContent={(index) => {
                const item = treeItems[index];
                const isCollapsed = treeCollapsed.has(item.id);
                return (
                  <button
                    type="button"
                    onClick={() => scrollToLine(item.lineIndex)}
                    className="flex w-full items-center gap-2 px-3 py-1 text-left text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
                  >
                    <span
                      className="flex items-center justify-center"
                      style={{ paddingLeft: item.depth * 12 }}
                    >
                      {item.hasChildren ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleTreeNode(item.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              toggleTreeNode(item.id);
                            }
                          }}
                          className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                        >
                          {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        </span>
                      ) : (
                        <span className="block h-[12px] w-[12px]" />
                      )}
                    </span>
                    <span className="truncate">
                      {item.name}
                    </span>
                    {item.attrsSummary && (
                      <span className="ml-1 truncate text-[10px] text-[var(--color-text-muted)]">
                        {item.attrsSummary}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                      {item.lineIndex + 1}
                    </span>
                  </button>
                );
              }}
            />
          )}
        </div>
        <div className="flex-1 min-h-0">
          <Virtuoso
            ref={virtuosoRef}
            totalCount={items.length}
            className="flex-1 font-mono text-sm"
            style={{ height: '100%' }}
            components={{ List: VirtuosoList }}
            itemContent={(index) => {
              const item = items[index];
              if (item.type === 'collapse') {
                return (
                  <InspectCollapsedLine
                    key={`collapse-${item.foldStart}-${item.count}`}
                    lineNumberWidth={lineNumberWidth}
                    toggleWidth={toggleWidth}
                    count={item.count}
                    onExpand={() => toggleFold(item.foldStart)}
                    expandLabel={t.expandSection}
                    collapsedLabel={t.collapsedLines}
                  />
                );
              }
              return (
                <InspectLine
                  key={`line-${item.lineIndex}`}
                  lineNumber={item.lineIndex + 1}
                  content={item.content}
                  lineNumberWidth={lineNumberWidth}
                  toggleWidth={toggleWidth}
                  isFoldStart={item.isFoldStart}
                  isCollapsed={item.isCollapsed}
                  onToggle={() => toggleFold(item.lineIndex)}
                  expandLabel={t.expandSection}
                  collapseLabel={t.collapseAll}
                  isHighlighted={highlightLine === item.lineIndex}
                />
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}

function InspectLine({
  lineNumber,
  content,
  lineNumberWidth,
  toggleWidth,
  isFoldStart,
  isCollapsed,
  onToggle,
  expandLabel,
  collapseLabel,
  isHighlighted,
}: {
  lineNumber: number;
  content: string;
  lineNumberWidth: number;
  toggleWidth: number;
  isFoldStart: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  expandLabel: string;
  collapseLabel: string;
  isHighlighted: boolean;
}) {
  return (
    <div
      className={`grid items-start text-[var(--color-text-primary)] ${
        isHighlighted ? 'bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]/40' : ''
      }`}
      style={{ gridTemplateColumns: `${toggleWidth}px ${lineNumberWidth}px 1fr` }}
    >
      <div className="flex items-start justify-center pt-1">
        {isFoldStart ? (
          <button
            type="button"
            onClick={onToggle}
            className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            title={isCollapsed ? expandLabel : collapseLabel}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <span className="block h-[14px] w-[14px]" />
        )}
      </div>
      <span className="px-2 py-0.5 text-right text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] select-none">
        {lineNumber}
      </span>
      <pre className="px-3 py-0.5 whitespace-pre overflow-hidden text-[var(--color-text-primary)]">
        {content.length > 0 ? content : '\u00A0'}
      </pre>
    </div>
  );
}

function InspectCollapsedLine({
  lineNumberWidth,
  toggleWidth,
  count,
  onExpand,
  expandLabel,
  collapsedLabel,
}: {
  lineNumberWidth: number;
  toggleWidth: number;
  count: number;
  onExpand: () => void;
  expandLabel: string;
  collapsedLabel: string;
}) {
  return (
    <div
      className="grid items-center bg-[var(--color-bg-tertiary)]/30 text-[var(--color-text-muted)]"
      style={{ gridTemplateColumns: `${toggleWidth}px ${lineNumberWidth}px 1fr` }}
    >
      <span className="block" />
      <span className="px-2 py-0.5 text-right bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] select-none">
        ...
      </span>
      <div className="flex items-center gap-2 px-3 py-0.5">
        <button
          type="button"
          onClick={onExpand}
          className="rounded bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-accent-hover)]"
        >
          {expandLabel}
        </button>
        <span className="text-[var(--color-text-secondary)]">
          {collapsedLabel.replace('{count}', count.toLocaleString())}
        </span>
      </div>
    </div>
  );
}
