import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, MouseEvent } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { ChevronDown, ChevronRight, ChevronUp, Search, X } from 'lucide-react';
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

function buildTreeLineageMap(nodes: InspectTreeNode[]) {
  const map = new Map<number, string[]>();
  const walk = (node: InspectTreeNode, path: string[]) => {
    const nextPath = [...path, node.id];
    map.set(node.lineIndex, nextPath);
    node.children.forEach(child => walk(child, nextPath));
  };
  nodes.forEach(node => walk(node, []));
  return map;
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
  const treeVirtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollInfo, setScrollInfo] = useState({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });
  const scrollInfoRef = useRef<{ scrollTop: number; scrollHeight: number; clientHeight: number } | null>(
    null
  );
  const scrollRafRef = useRef<number | null>(null);
  const [minimapSize, setMinimapSize] = useState({ width: 0, height: 0 });
  const lines = useMemo(() => (value ? value.split('\n') : ['']), [value]);
  const foldRanges = useMemo(() => buildFoldRanges(lines), [lines]);
  const foldStarts = useMemo(() => Array.from(foldRanges.keys()).sort((a, b) => a - b), [foldRanges]);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [treeCollapsed, setTreeCollapsed] = useState<Set<string>>(new Set());
  const [pendingLine, setPendingLine] = useState<number | null>(null);
  const [pendingTreeLine, setPendingTreeLine] = useState<number | null>(null);
  const [highlightLine, setHighlightLine] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);

  useEffect(() => {
    setCollapsed(new Set());
    setTreeCollapsed(new Set());
    setSearchQuery('');
    setSearchIndex(0);
  }, [value]);

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

  const handleScroll = useCallback(() => {
    if (!scrollerRef.current) return;
    scheduleScrollInfo(scrollerRef.current);
  }, [scheduleScrollInfo]);

  const attachScroller = useCallback((element: HTMLElement | Window | null) => {
    const normalized = element instanceof HTMLElement ? element : null;
    if (scrollerRef.current === normalized) return;
    if (scrollerRef.current) {
      scrollerRef.current.removeEventListener('scroll', handleScroll);
    }
    scrollerRef.current = normalized;
    if (normalized) {
      normalized.addEventListener('scroll', handleScroll, { passive: true });
      scheduleScrollInfo(normalized);
    }
  }, [handleScroll, scheduleScrollInfo]);

  useEffect(() => {
    return () => {
      scrollerRef.current?.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    const element = minimapRef.current;
    if (!element) return;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const nextWidth = Math.max(0, Math.round(rect.width));
      const nextHeight = Math.max(0, Math.round(rect.height));
      setMinimapSize(prev => {
        if (prev.width === nextWidth && prev.height === nextHeight) return prev;
        return { width: nextWidth, height: nextHeight };
      });
    };
    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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
  const treeLineageMap = useMemo(() => buildTreeLineageMap(treeRoots), [treeRoots]);
  const treeItems = useMemo(
    () => flattenInspectTree(treeRoots, treeCollapsed),
    [treeRoots, treeCollapsed]
  );
  const segmentNodes = useMemo(() => {
    if (treeRoots.length === 0) return [] as Array<{ node: InspectTreeNode; depth: number }>;
    if (treeRoots.length > 1) {
      return treeRoots.map(node => ({ node, depth: 0 }));
    }
    const root = treeRoots[0];
    if (root.children.length > 0) {
      return root.children.map(node => ({ node, depth: 1 }));
    }
    return [{ node: root, depth: 0 }];
  }, [treeRoots]);
  const segmentRanges = useMemo(() => {
    if (segmentNodes.length === 0) return [] as Array<{ start: number; end: number; depth: number }>;
    const sorted = [...segmentNodes].sort((a, b) => a.node.lineIndex - b.node.lineIndex);
    return sorted.map((entry, index) => {
      const start = entry.node.lineIndex;
      const nextStart = sorted[index + 1]?.node.lineIndex;
      let end = foldRanges.get(start);
      if (end === undefined) {
        end = nextStart !== undefined ? Math.max(start, nextStart - 1) : start;
      } else if (nextStart !== undefined && nextStart <= end) {
        end = Math.max(start, nextStart - 1);
      }
      return { start, end: Math.max(start, end), depth: entry.depth };
    });
  }, [foldRanges, segmentNodes]);
  const normalizedSearch = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
  const searchMatches = useMemo(() => {
    if (!normalizedSearch) return [];
    const matches: number[] = [];
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(normalizedSearch)) {
        matches.push(index);
      }
    });
    return matches;
  }, [lines, normalizedSearch]);
  const searchMatchSet = useMemo(() => new Set(searchMatches), [searchMatches]);

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
  const treeLineIndexToItemIndex = useMemo(() => {
    const map = new Map<number, number>();
    treeItems.forEach((item, index) => {
      if (!map.has(item.lineIndex)) {
        map.set(item.lineIndex, index);
      }
    });
    return map;
  }, [treeItems]);
  const itemIndexToLineIndex = useMemo(() => {
    return items.map(item => (item.type === 'line' ? item.lineIndex : item.foldStart));
  }, [items]);

  const lineNumberWidth = useMemo(() => {
    const digits = Math.max(2, String(lines.length).length);
    return digits * 8 + 18;
  }, [lines.length]);
  const toggleWidth = 22;
  const overviewViewport = useMemo(() => {
    if (!scrollInfo.scrollHeight || !scrollInfo.clientHeight) return null;
    const start = scrollInfo.scrollTop / scrollInfo.scrollHeight;
    const size = scrollInfo.clientHeight / scrollInfo.scrollHeight;
    return {
      start: Math.max(0, Math.min(1, start)),
      end: Math.max(0, Math.min(1, start + size)),
    };
  }, [scrollInfo]);
  const minimapWidth = useMemo(() => (lines.length <= 400 ? 12 : 18), [lines.length]);

  const scrollToLine = useCallback((lineIndex: number) => {
    const toExpand: number[] = [];
    foldRanges.forEach((end, start) => {
      if (start < lineIndex && lineIndex <= end && collapsed.has(start)) {
        toExpand.push(start);
      }
    });
    const lineage = treeLineageMap.get(lineIndex);
    if (lineage && lineage.length > 1) {
      setTreeCollapsed(prev => {
        const next = new Set(prev);
        lineage.slice(0, -1).forEach(id => next.delete(id));
        return next;
      });
      setPendingTreeLine(lineIndex);
    } else {
      const treeIndex = treeLineIndexToItemIndex.get(lineIndex);
      if (treeIndex !== undefined) {
        treeVirtuosoRef.current?.scrollToIndex({ index: treeIndex, align: 'center', behavior: 'smooth' });
      }
    }
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
  }, [
    collapsed,
    foldRanges,
    lineIndexToItemIndex,
    treeLineIndexToItemIndex,
    treeLineageMap,
  ]);

  const handleMinimapClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const container = minimapRef.current;
    if (!container || items.length === 0) return;
    const rect = container.getBoundingClientRect();
    if (!rect.height) return;
    const offsetY = event.clientY - rect.top;
    const ratio = Math.min(1, Math.max(0, offsetY / rect.height));
    const targetIndex = Math.round(ratio * Math.max(0, items.length - 1));
    const lineIndex = itemIndexToLineIndex[targetIndex] ?? 0;
    scrollToLine(lineIndex);
  }, [itemIndexToLineIndex, items.length, scrollToLine]);

  const jumpToMatch = useCallback((targetIndex: number) => {
    if (searchMatches.length === 0) return;
    const nextIndex = (targetIndex + searchMatches.length) % searchMatches.length;
    setSearchIndex(nextIndex);
    scrollToLine(searchMatches[nextIndex]);
  }, [scrollToLine, searchMatches]);

  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      jumpToMatch(event.shiftKey ? searchIndex - 1 : searchIndex + 1);
    }
    if (event.key === 'Escape') {
      setSearchQuery('');
    }
  }, [jumpToMatch, searchIndex]);

  useEffect(() => {
    setSearchIndex(0);
    setHighlightLine(null);
  }, [normalizedSearch]);

  useEffect(() => {
    if (pendingLine === null) return;
    const itemIndex = lineIndexToItemIndex.get(pendingLine);
    if (itemIndex === undefined) return;
    virtuosoRef.current?.scrollToIndex({ index: itemIndex, align: 'center', behavior: 'smooth' });
    setHighlightLine(pendingLine);
    setPendingLine(null);
  }, [lineIndexToItemIndex, pendingLine]);

  useEffect(() => {
    if (pendingTreeLine === null) return;
    const itemIndex = treeLineIndexToItemIndex.get(pendingTreeLine);
    if (itemIndex === undefined) return;
    treeVirtuosoRef.current?.scrollToIndex({ index: itemIndex, align: 'center', behavior: 'smooth' });
    setPendingTreeLine(null);
  }, [pendingTreeLine, treeLineIndexToItemIndex]);

  useEffect(() => {
    if (highlightLine === null) return;
    const timer = setTimeout(() => {
      setHighlightLine(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [highlightLine]);

  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const { width, height } = minimapSize;
    if (width <= 0 || height <= 0) return;
    const totalItems = items.length;
    if (totalItems === 0) return;
    const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const accent = typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()
      : '';
    const muted = typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim()
      : '';
    const mid = typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--color-diff-modified-border').trim()
      : '';
    const accentColor = accent || '#8B5CF6';
    const mutedColor = muted || '#9CA3AF';
    const midColor = mid || '#F59E0B';

    const totalLines = Math.max(1, lines.length);
    const useSegmentBlocks = totalLines > 400;

    if (!useSegmentBlocks) {
      const rowCount = Math.max(1, Math.floor(height));
      const rowDepths = new Array(rowCount).fill(0);
      const rowHits = new Array(rowCount).fill(0);
      const getLineDepth = (content: string, lineIndex: number) => {
        const lineage = treeLineageMap.get(lineIndex);
        if (lineage && lineage.length > 0) return lineage.length;
        const match = content.match(/^\s*/);
        const spaces = match ? match[0].replace(/\t/g, '  ').length : 0;
        return Math.min(12, Math.floor(spaces / 2));
      };

      for (let lineIndex = 0; lineIndex < totalLines; lineIndex += 1) {
        const ratioIndex = totalLines <= 1 ? 0 : lineIndex / (totalLines - 1);
        const rowIndex = Math.min(rowCount - 1, Math.floor(ratioIndex * rowCount));
        const content = lines[lineIndex] ?? '';
        rowHits[rowIndex] += 1;
        rowDepths[rowIndex] = Math.max(rowDepths[rowIndex], getLineDepth(content, lineIndex));
      }

      const maxDepth = Math.max(...rowDepths);
      for (let y = 0; y < rowCount; y += 1) {
        if (rowHits[y] === 0) continue;
        const depthWeight = maxDepth ? rowDepths[y] / maxDepth : 0;
        const tier = depthWeight >= 0.66 ? 'high' : depthWeight >= 0.33 ? 'mid' : 'low';
        const alpha = tier === 'high' ? 0.9 : tier === 'mid' ? 0.65 : 0.45;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = tier === 'high' ? accentColor : tier === 'mid' ? midColor : mutedColor;
        ctx.fillRect(1, y, Math.max(1, width - 2), 1);
      }
      ctx.globalAlpha = 1;
      return;
    }

    const segments = segmentRanges.length > 0 ? segmentRanges : [{ start: 0, end: totalLines - 1, depth: 0 }];
    const maxLength = Math.max(...segments.map(segment => segment.end - segment.start + 1));
    const minBlockPx = segments.length > height / 2 ? 2 : 3;

    ctx.globalAlpha = 1;
    segments.forEach(segment => {
      const startRatio = segment.start / totalLines;
      const endRatio = (segment.end + 1) / totalLines;
      const length = segment.end - segment.start + 1;
      const lengthRatio = maxLength ? length / maxLength : 0;
      const depthBoost = segment.depth * 0.08;
      const score = Math.min(1, lengthRatio + depthBoost);
      const tier = score >= 0.66 ? 'high' : score >= 0.33 ? 'mid' : 'low';
      const alpha = tier === 'high' ? 0.95 : tier === 'mid' ? 0.75 : 0.55;
      let y = Math.round(startRatio * height);
      let blockHeight = Math.round((endRatio - startRatio) * height);
      if (blockHeight < minBlockPx) blockHeight = minBlockPx;
      if (y + blockHeight > height) {
        blockHeight = Math.max(1, height - y);
      }
      if (blockHeight <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = tier === 'high' ? accentColor : tier === 'mid' ? midColor : mutedColor;
      ctx.fillRect(1, y, Math.max(1, width - 2), blockHeight);
    });
    ctx.globalAlpha = 1;
  }, [lines, minimapSize, segmentRanges, treeLineageMap]);

  const searchCountLabel = useMemo(() => {
    if (!normalizedSearch) return '';
    const current = searchMatches.length === 0 ? 0 : searchIndex + 1;
    return t.inspectSearchCount
      .replace('{current}', current.toString())
      .replace('{total}', searchMatches.length.toString());
  }, [normalizedSearch, searchIndex, searchMatches.length, t.inspectSearchCount]);

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
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/40 px-2 py-1 text-xs text-[var(--color-text-secondary)]">
              <Search size={12} className="text-[var(--color-text-muted)]" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={t.inspectSearchPlaceholder}
                className="flex-1 bg-transparent outline-none placeholder:text-[var(--color-text-muted)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  title={t.clear}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {normalizedSearch && (
              <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                <span>
                  {searchMatches.length === 0 ? t.inspectSearchNoMatch : searchCountLabel}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={searchMatches.length === 0}
                    onClick={() => jumpToMatch(searchIndex - 1)}
                    className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
                    title={t.inspectSearchPrev}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={searchMatches.length === 0}
                    onClick={() => jumpToMatch(searchIndex + 1)}
                    className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
                    title={t.inspectSearchNext}
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
          {treeItems.length === 0 ? (
            <div className="px-3 pb-3 text-xs text-[var(--color-text-muted)]">
              {t.inspectTreeEmpty}
            </div>
          ) : (
            <Virtuoso
              ref={treeVirtuosoRef}
              totalCount={treeItems.length}
              className="h-40 md:h-full"
              style={{ height: '100%' }}
              components={{ List: VirtuosoList }}
              itemContent={(index) => {
                const item = treeItems[index];
                const isCollapsed = treeCollapsed.has(item.id);
                const isMatch = searchMatchSet.has(item.lineIndex);
                const isActive = highlightLine === item.lineIndex;
                return (
                  <button
                    type="button"
                    onClick={() => scrollToLine(item.lineIndex)}
                    className={`relative flex w-full items-center gap-2 px-3 py-1 text-left text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] ${
                      isActive ? 'bg-[var(--color-accent)]/12 ring-1 ring-[var(--color-accent)]/35' : ''
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1 bottom-1 w-1 rounded ${
                        isActive
                          ? 'bg-[var(--color-accent)]'
                          : isMatch
                            ? 'bg-[var(--color-diff-added-border)]'
                            : 'bg-transparent'
                      }`}
                    />
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
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-h-0">
          <Virtuoso
            ref={virtuosoRef}
            totalCount={items.length}
            className="flex-1 font-mono text-sm"
            style={{ height: '100%' }}
            components={{ List: VirtuosoList }}
            scrollerRef={attachScroller}
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
                  isMatch={searchMatchSet.has(item.lineIndex)}
                />
              );
            }}
          />
          </div>
          <div
            ref={minimapRef}
            onMouseDown={handleMinimapClick}
            style={{ width: minimapWidth }}
            className="relative mx-2 my-2 shrink-0 rounded-full border border-[var(--color-accent)]/55 bg-[var(--color-bg-primary)]/40 shadow-[0_0_0_1px_var(--color-bg-primary)]/70 cursor-pointer hover:border-[var(--color-accent)]/85"
          >
            <canvas
              ref={minimapCanvasRef}
              className="absolute inset-0 h-full w-full rounded-full"
            />
            {overviewViewport && minimapSize.height > 0 && (
              <div
                className="absolute left-[2px] right-[2px] rounded-full border border-[var(--color-accent)]/90 bg-[var(--color-accent)]/10 shadow-[0_0_6px_var(--color-accent)]/30 pointer-events-none"
                style={{
                  top: `${overviewViewport.start * minimapSize.height}px`,
                  height: `${Math.max(
                    10,
                    (overviewViewport.end - overviewViewport.start) * minimapSize.height
                  )}px`,
                }}
              />
            )}
          </div>
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
  isMatch,
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
  isMatch: boolean;
}) {
  return (
    <div
      className={`grid items-start text-[var(--color-text-primary)] transition-colors duration-300 ${
        isMatch ? 'bg-[var(--color-accent)]/5' : ''
      } ${
        isHighlighted ? 'bg-[var(--color-accent)]/15 ring-2 ring-[var(--color-accent)]/60' : ''
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
      <span
        className={`px-2 py-0.5 text-right border-r border-[var(--color-border)] select-none transition-colors duration-300 ${
          isHighlighted
            ? 'bg-[var(--color-accent)]/30 text-[var(--color-text-primary)] font-semibold'
            : 'text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]'
        }`}
      >
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
