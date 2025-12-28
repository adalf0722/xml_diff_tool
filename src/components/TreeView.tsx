/**
 * Tree View Component
 * Shows XML structure as collapsible tree with diff highlighting
 */

import { forwardRef, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Maximize2, Minimize2, Filter } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { ParseResult, XMLNode } from '../core/xml-parser';
import type { DiffResult, DiffType } from '../core/xml-diff';
import { buildPairedDiffTrees, expandAll, collapseAll, DIFF_KEY_ATTRS, getChangedPaths, countNodesByType } from '../core/xml-tree';
import type { TreeNode } from '../core/xml-tree';
import { useLanguage } from '../contexts/LanguageContext';
import { recordValue } from '../utils/perf-metrics';
import { DiffChunkList, type DiffChunkItem } from './DiffChunkList';

// Tree navigation grouping keys (UX): treat only real “entities” as navigable
// - exclude `name` to avoid root like <company name="..."> swallowing the whole tree
const TREE_NAV_KEY_ATTRS = DIFF_KEY_ATTRS.filter(a => a !== 'name');

interface TreeViewProps {
  diffResults: DiffResult[];
  activeFilters: Set<DiffType>;
  parseResultA: ParseResult;
  parseResultB: ParseResult;
  isLargeFileMode?: boolean;
  activeDiffIndex?: number;
  onNavigate?: (index: number) => void;
  onFilterToggle?: (type: DiffType) => void;
  onResetFilters?: () => void;
  onJumpComplete?: (index: number) => void;
  onNavCountChange?: (count: number) => void;
  onScopeChange?: (scope: 'full' | 'diff-only') => void;
  onSummaryChange?: (summary: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
    total: number;
  }) => void;
}

interface FlatTreeItem {
  node: TreeNode;
  depth: number;
}

interface TreeChunkCounts {
  added: number;
  removed: number;
  modified: number;
}

const TreeList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div ref={ref} {...props} className={`p-2 min-w-max ${props.className || ''}`} />
  )
);

TreeList.displayName = 'TreeList';

function perfNow(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

export function TreeView({
  diffResults,
  activeFilters,
  parseResultA,
  parseResultB,
  isLargeFileMode = false,
  activeDiffIndex,
  onNavigate,
  onFilterToggle,
  onResetFilters,
  onJumpComplete,
  onNavCountChange,
  onScopeChange,
  onSummaryChange,
}: TreeViewProps) {
  const { t } = useLanguage();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [diffOnlyOverride, setDiffOnlyOverride] = useState<boolean | null>(null);
  const showDiffOnly = diffOnlyOverride ?? isLargeFileMode;
  const leftVirtuosoRef = useRef<VirtuosoHandle>(null);
  const rightVirtuosoRef = useRef<VirtuosoHandle>(null);
  const leftScrollerRef = useRef<HTMLElement | null>(null);
  const rightScrollerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onScopeChange?.(showDiffOnly ? 'diff-only' : 'full');
  }, [onScopeChange, showDiffOnly]);

  // Parse XML and build paired diff trees (include placeholders)
  const { treeA, treeB } = useMemo(() => {
    // Use paired tree builder to create placeholder nodes
    const rootA = parseResultA.success ? parseResultA.root : null;
    const rootB = parseResultB.success ? parseResultB.root : null;
    const shouldFilter = showDiffOnly;

    let filteredA = rootA;
    let filteredB = rootB;

    if (shouldFilter) {
      const pathsStart = perfNow();
      const allowedPaths = getChangedPaths(diffResults);
      const pathsDuration = perfNow() - pathsStart;
      recordValue('tree:changedPaths', pathsDuration, 'ms', {
        scope: showDiffOnly ? 'diff-only' : 'full',
        diffCount: diffResults.length,
        paths: allowedPaths.size,
      });
      if (allowedPaths.size === 0) {
        if (rootA) allowedPaths.add(rootA.path);
        if (rootB) allowedPaths.add(rootB.path);
      }
      const filterStartA = perfNow();
      filteredA = rootA ? filterXmlTree(rootA, allowedPaths) : null;
      recordValue('tree:filter', perfNow() - filterStartA, 'ms', {
        side: 'A',
        scope: showDiffOnly ? 'diff-only' : 'full',
        paths: allowedPaths.size,
      });
      const filterStartB = perfNow();
      filteredB = rootB ? filterXmlTree(rootB, allowedPaths) : null;
      recordValue('tree:filter', perfNow() - filterStartB, 'ms', {
        side: 'B',
        scope: showDiffOnly ? 'diff-only' : 'full',
        paths: allowedPaths.size,
      });
    }

    const start = perfNow();
    const { treeA, treeB } = buildPairedDiffTrees(filteredA, filteredB, diffResults);
    const duration = perfNow() - start;
    if (treeA || treeB) {
      recordValue('tree:build', duration, 'ms', {
        scope: showDiffOnly ? 'diff-only' : 'full',
        diffCount: diffResults.length,
      });
    }
    return { treeA, treeB };
  }, [diffResults, parseResultA, parseResultB, showDiffOnly]);

  const treeSummary = useMemo(() => {
    const start = perfNow();
    const counts = countNodesByType(treeA);
    const total = counts.added + counts.removed + counts.modified + counts.unchanged;
    if (treeA) {
      recordValue('tree:summary', perfNow() - start, 'ms', {
        total,
        added: counts.added,
        removed: counts.removed,
        modified: counts.modified,
      });
    }
    return { ...counts, total };
  }, [treeA]);

  const flatTreeA = useMemo(() => {
    if (!treeA) return [];
    const start = perfNow();
    const result = flattenTree(treeA, expandedNodes);
    const duration = perfNow() - start;
    recordValue('tree:flatten', duration, 'ms', {
      side: 'A',
      nodes: result.length,
      expanded: expandedNodes.size,
      scope: showDiffOnly ? 'diff-only' : 'full',
    });
    return result;
  }, [treeA, expandedNodes, showDiffOnly]);

  const flatTreeB = useMemo(() => {
    if (!treeB) return [];
    const start = perfNow();
    const result = flattenTree(treeB, expandedNodes);
    const duration = perfNow() - start;
    recordValue('tree:flatten', duration, 'ms', {
      side: 'B',
      nodes: result.length,
      expanded: expandedNodes.size,
      scope: showDiffOnly ? 'diff-only' : 'full',
    });
    return result;
  }, [treeB, expandedNodes, showDiffOnly]);
  const keyToIndexA = useMemo(() => {
    const start = perfNow();
    const map = buildKeyIndex(flatTreeA);
    if (flatTreeA.length > 0) {
      recordValue('tree:keyIndex', perfNow() - start, 'ms', {
        side: 'A',
        items: flatTreeA.length,
      });
    }
    return map;
  }, [flatTreeA]);
  const keyToIndexB = useMemo(() => {
    const start = perfNow();
    const map = buildKeyIndex(flatTreeB);
    if (flatTreeB.length > 0) {
      recordValue('tree:keyIndex', perfNow() - start, 'ms', {
        side: 'B',
        items: flatTreeB.length,
      });
    }
    return map;
  }, [flatTreeB]);

  useEffect(() => {
    onSummaryChange?.(treeSummary);
  }, [onSummaryChange, treeSummary]);

  const setLeftScroller = useCallback((element: HTMLElement | Window | null) => {
    leftScrollerRef.current = element instanceof HTMLElement ? element : null;
  }, []);

  const setRightScroller = useCallback((element: HTMLElement | Window | null) => {
    rightScrollerRef.current = element instanceof HTMLElement ? element : null;
  }, []);

  // Build navigable index map:
  // - Prefer grouping by key attributes
  // - Fallback to any diff node when no group roots exist
  const { diffIndexMap, indexToKey, navMode } = useMemo(() => {
    const start = perfNow();
    const indexMap = new Map<string, number>();
    const reverseMap = new Map<number, string>();
    let diffIdx = 0;
    let hasGroupRoots = false;

    function hasKeyAttr(n: TreeNode): boolean {
      if (n.node.nodeType !== 'element') return false;
      return TREE_NAV_KEY_ATTRS.some(attr => n.node.attributes[attr] !== undefined);
    }

    function subtreeHasActiveDiff(n: TreeNode): boolean {
      if (n.diffType !== 'unchanged' && activeFilters.has(n.diffType)) return true;
      return n.children.some(subtreeHasActiveDiff);
    }

    function traverseLeft(n: TreeNode | null) {
      if (!n) return;
      // Only group roots become navigable
      if (hasKeyAttr(n) && subtreeHasActiveDiff(n)) {
        if (!indexMap.has(n.stableKey)) {
          indexMap.set(n.stableKey, diffIdx);
          reverseMap.set(diffIdx, n.stableKey);
          diffIdx++;
          hasGroupRoots = true;
        }
        // Do NOT traverse into children for additional groups; keeps UX as “entity-level”
        return;
      }
      for (const child of n.children) traverseLeft(child);
    }

    traverseLeft(treeA);

    if (hasGroupRoots) {
      const result = { diffIndexMap: indexMap, indexToKey: reverseMap, navMode: 'group' as const };
      if (treeA || treeB) {
        recordValue('tree:navIndex', perfNow() - start, 'ms', {
          mode: result.navMode,
          count: result.diffIndexMap.size,
        });
      }
      return result;
    }

    const fallbackIndexMap = new Map<string, number>();
    const fallbackReverseMap = new Map<number, string>();
    diffIdx = 0;

    function traverseAll(n: TreeNode | null) {
      if (!n) return;
      if (n.diffType !== 'unchanged' && activeFilters.has(n.diffType)) {
        if (!fallbackIndexMap.has(n.stableKey)) {
          fallbackIndexMap.set(n.stableKey, diffIdx);
          fallbackReverseMap.set(diffIdx, n.stableKey);
          diffIdx++;
        }
      }
      for (const child of n.children) traverseAll(child);
    }

    traverseAll(treeA);
    const result = { diffIndexMap: fallbackIndexMap, indexToKey: fallbackReverseMap, navMode: 'node' as const };
    if (treeA || treeB) {
      recordValue('tree:navIndex', perfNow() - start, 'ms', {
        mode: result.navMode,
        count: result.diffIndexMap.size,
      });
    }
    return result;
  }, [treeA, activeFilters]);

  const keyPathMapA = useMemo(() => {
    const start = perfNow();
    const map = buildKeyPathMap(treeA);
    if (treeA) {
      recordValue('tree:keyPath', perfNow() - start, 'ms', {
        side: 'A',
        keys: map.size,
      });
    }
    return map;
  }, [treeA]);
  const keyPathMapB = useMemo(() => {
    const start = perfNow();
    const map = buildKeyPathMap(treeB);
    if (treeB) {
      recordValue('tree:keyPath', perfNow() - start, 'ms', {
        side: 'B',
        keys: map.size,
      });
    }
    return map;
  }, [treeB]);

  const nodeMapA = useMemo(() => buildStableKeyNodeMap(treeA), [treeA]);
  const nodeMapB = useMemo(() => buildStableKeyNodeMap(treeB), [treeB]);
  const countsMapA = useMemo(() => buildTreeCountsMap(treeA), [treeA]);
  const countsMapB = useMemo(() => buildTreeCountsMap(treeB), [treeB]);
  const chunkItems: DiffChunkItem[] = useMemo(() => {
    const items: DiffChunkItem[] = [];
    const emptyCounts: TreeChunkCounts = { added: 0, removed: 0, modified: 0 };
    const entries = Array.from(indexToKey.entries()).sort((a, b) => a[0] - b[0]);
    entries.forEach(([index, key], idx) => {
      const node = nodeMapA.get(key) ?? nodeMapB.get(key);
      const label = formatTreeChunkLabel(node, `${t.chunkLabel} ${idx + 1}`);
      const countsA = countsMapA.get(key) ?? emptyCounts;
      const countsB = countsMapB.get(key) ?? emptyCounts;
      items.push({
        id: `tree-chunk-${index}`,
        label,
        rangeLabel: '',
        diffIndexStart: index,
        diffIndexEnd: index,
        counts: {
          added: Math.max(countsA.added, countsB.added),
          removed: Math.max(countsA.removed, countsB.removed),
          modified: Math.max(countsA.modified, countsB.modified),
        },
      });
    });
    return items;
  }, [countsMapA, countsMapB, indexToKey, nodeMapA, nodeMapB, t.chunkLabel]);
  const showChunkList =
    chunkItems.length > 0 && Boolean(onNavigate && onFilterToggle && onResetFilters);

  useEffect(() => {
    if (activeDiffIndex === undefined || activeDiffIndex < 0) return;
    const key = indexToKey.get(activeDiffIndex);
    if (!key) return;

    setExpandedNodes(prev => {
      const next = new Set(prev);
      let changed = false;
      const pathA = keyPathMapA.get(key);
      const pathB = keyPathMapB.get(key);

      if (pathA) {
        for (const id of pathA) {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        }
      }

      if (pathB) {
        for (const id of pathB) {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        }
      }

      return changed ? next : prev;
    });
  }, [activeDiffIndex, indexToKey, keyPathMapA, keyPathMapB]);

  useEffect(() => {
    if (activeDiffIndex === undefined || activeDiffIndex < 0) return;
    const key = indexToKey.get(activeDiffIndex);
    if (!key) return;

    const leftIndex = keyToIndexA.get(key);
    const rightIndex = keyToIndexB.get(key);

    if (leftIndex !== undefined) {
      leftVirtuosoRef.current?.scrollToIndex({ index: leftIndex, align: 'center', behavior: 'smooth' });
    }
    if (rightIndex !== undefined) {
      rightVirtuosoRef.current?.scrollToIndex({ index: rightIndex, align: 'center', behavior: 'smooth' });
    }

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
  }, [activeDiffIndex, indexToKey, keyToIndexA, keyToIndexB, onJumpComplete]);

  // Report navigable count to App (for correct counter + bounds)
  useEffect(() => {
    onNavCountChange?.(diffIndexMap.size);
  }, [diffIndexMap.size, onNavCountChange]);

  // Initialize expanded state (default collapsed, only roots open)
  useEffect(() => {
    if (treeA || treeB) {
      const initial = new Set<string>();
      if (treeA) initial.add(treeA.id);
      if (treeB) initial.add(treeB.id);
      setExpandedNodes(initial);
    }
  }, [treeA, treeB]);

  const handleToggle = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const allExpanded = new Set<string>();
    if (treeA) {
      for (const id of expandAll(treeA)) {
        allExpanded.add(id);
      }
    }
    if (treeB) {
      for (const id of expandAll(treeB)) {
        allExpanded.add(id);
      }
    }
    setExpandedNodes(allExpanded);
  }, [treeA, treeB]);

  const handleCollapseAll = useCallback(() => {
    setExpandedNodes(collapseAll());
  }, []);

  // Calculate expansion state for button styling
  const { isFullyExpanded, isFullyCollapsed } = useMemo(() => {
    // Count total expandable nodes (nodes with children, excluding roots)
    function countExpandable(node: TreeNode | null, isRoot: boolean = true): number {
      if (!node) return 0;
      // Root doesn't count as "expandable" for collapse detection
      let count = (!isRoot && node.children.length > 0) ? 1 : 0;
      for (const child of node.children) {
        count += countExpandable(child, false);
      }
      return count;
    }
    
    // Count how many non-root nodes are expanded
    function countNonRootExpanded(): number {
      let count = 0;
      const rootIds = new Set<string>();
      if (treeA) rootIds.add(treeA.id);
      if (treeB) rootIds.add(treeB.id);
      
      for (const id of expandedNodes) {
        if (!rootIds.has(id)) {
          count++;
        }
      }
      return count;
    }
    
    const totalExpandable = countExpandable(treeA) + countExpandable(treeB);
    const nonRootExpanded = countNonRootExpanded();
    
    return {
      // Fully expanded: all expandable nodes (including roots) are expanded
      isFullyExpanded: totalExpandable > 0 && nonRootExpanded >= totalExpandable,
      // Fully collapsed: only roots are expanded (or nothing)
      isFullyCollapsed: nonRootExpanded === 0,
    };
  }, [treeA, treeB, expandedNodes]);
  const expandStateLabel = useMemo(() => {
    if (isFullyExpanded) return t.treeExpandStateExpanded;
    if (isFullyCollapsed) return t.treeExpandStateCollapsed;
    return t.treeExpandStatePartial;
  }, [isFullyCollapsed, isFullyExpanded, t]);

  if (!treeA && !treeB) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        <p>{t.parseXmlToViewTree}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-1 rounded-md bg-[var(--color-bg-tertiary)]/40 p-1">
          <button
            onClick={handleExpandAll}
            disabled={isFullyExpanded}
            title={t.expandAll}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
              isFullyExpanded 
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] cursor-default' 
                : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
            }`}
          >
            <Maximize2 size={14} />
            <span className="hidden sm:inline">{t.expandAll}</span>
          </button>
          <button
            onClick={handleCollapseAll}
            disabled={isFullyCollapsed}
            title={t.collapseAll}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
              isFullyCollapsed 
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] cursor-default' 
                : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
            }`}
          >
            <Minimize2 size={14} />
            <span className="hidden sm:inline">{t.collapseAll}</span>
          </button>
          <button
            onClick={() => setDiffOnlyOverride(!showDiffOnly)}
            title={t.diffOnlyTreeHint}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
          >
            <Filter size={14} />
            <span className="hidden sm:inline">{showDiffOnly ? t.showFullTree : t.showDiffOnly}</span>
          </button>
        </div>
        <span className="text-xs text-[var(--color-text-muted)] hidden md:inline">
          {t.treeExpandStateLabel.replace('{state}', expandStateLabel)}
        </span>
        <div className="flex-1" />
        <div className="hidden lg:flex">
          <DiffLegend />
        </div>
      </div>

      {/* Tree panels */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex divide-x divide-[var(--color-border)] overflow-hidden">
          {/* Left tree - XML A */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
              <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
                {t.originalXml}
              </h4>
            </div>
            <Virtuoso
              ref={leftVirtuosoRef}
              scrollerRef={setLeftScroller}
              data={flatTreeA}
              className="flex-1"
              style={{ height: '100%' }}
              itemContent={(_index: number, item: FlatTreeItem) => (
                <TreeRow
                  item={item}
                  expandedNodes={expandedNodes}
                  onToggle={handleToggle}
                  activeFilters={activeFilters}
                  diffIndexMap={diffIndexMap}
                  navMode={navMode}
                />
              )}
              components={{ List: TreeList }}
            />
          </div>

          {/* Right tree - XML B */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
              <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
                {t.newXml}
              </h4>
            </div>
            <Virtuoso
              ref={rightVirtuosoRef}
              scrollerRef={setRightScroller}
              data={flatTreeB}
              className="flex-1"
              style={{ height: '100%' }}
              itemContent={(_index: number, item: FlatTreeItem) => (
                <TreeRow
                  item={item}
                  expandedNodes={expandedNodes}
                  onToggle={handleToggle}
                  activeFilters={activeFilters}
                  diffIndexMap={diffIndexMap}
                  navMode={navMode}
                />
              )}
              components={{ List: TreeList }}
            />
          </div>
        </div>
        {showChunkList && (
          <div className="md:w-64 border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <DiffChunkList
              title={t.chunkListTitle}
              chunks={chunkItems}
              activeDiffIndex={activeDiffIndex}
              activeFilters={activeFilters}
              onFilterToggle={onFilterToggle!}
              onResetFilters={onResetFilters!}
              onSelect={onNavigate!}
              className="h-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function flattenTree(root: TreeNode | null, expandedNodes: Set<string>): FlatTreeItem[] {
  if (!root) return [];
  const items: FlatTreeItem[] = [];

  const traverse = (node: TreeNode, depth: number) => {
    items.push({ node, depth });
    if (!expandedNodes.has(node.id)) return;
    for (const child of node.children) {
      traverse(child, depth + 1);
    }
  };

  traverse(root, 0);
  return items;
}

function buildKeyIndex(items: FlatTreeItem[]): Map<string, number> {
  const map = new Map<string, number>();
  items.forEach((item, index) => {
    if (!map.has(item.node.stableKey)) {
      map.set(item.node.stableKey, index);
    }
  });
  return map;
}

function filterXmlTree(node: XMLNode, allowedPaths: Set<string>): XMLNode | null {
  if (!allowedPaths.has(node.path)) {
    return null;
  }

  const filteredChildren: XMLNode[] = [];
  for (const child of node.children) {
    const filtered = filterXmlTree(child, allowedPaths);
    if (filtered) filteredChildren.push(filtered);
  }

  return {
    ...node,
    children: filteredChildren,
  };
}

function buildKeyPathMap(tree: TreeNode | null): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!tree) return map;

  const traverse = (node: TreeNode, path: string[]) => {
    const nextPath = [...path, node.id];
    map.set(node.stableKey, nextPath);
    for (const child of node.children) {
      traverse(child, nextPath);
    }
  };

  traverse(tree, []);
  return map;
}

function buildStableKeyNodeMap(tree: TreeNode | null): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  if (!tree) return map;
  const stack: TreeNode[] = [tree];
  while (stack.length > 0) {
    const node = stack.pop()!;
    const existing = map.get(node.stableKey);
    if (!existing || existing.isPlaceholder) {
      map.set(node.stableKey, node);
    }
    for (const child of node.children) {
      stack.push(child);
    }
  }
  return map;
}

function buildTreeCountsMap(tree: TreeNode | null): Map<string, TreeChunkCounts> {
  const map = new Map<string, TreeChunkCounts>();
  if (!tree) return map;

  const traverse = (node: TreeNode): TreeChunkCounts => {
    const counts: TreeChunkCounts = { added: 0, removed: 0, modified: 0 };
    for (const child of node.children) {
      const childCounts = traverse(child);
      counts.added += childCounts.added;
      counts.removed += childCounts.removed;
      counts.modified += childCounts.modified;
    }
    if (node.diffType === 'added') counts.added += 1;
    if (node.diffType === 'removed') counts.removed += 1;
    if (node.diffType === 'modified') counts.modified += 1;
    map.set(node.stableKey, counts);
    return counts;
  };

  traverse(tree);
  return map;
}

function formatTreeChunkLabel(node: TreeNode | undefined, fallback: string): string {
  if (!node) return fallback;
  const keyAttr = DIFF_KEY_ATTRS.find(attr => node.node.attributes[attr] !== undefined);
  if (keyAttr) {
    return `${node.node.name} ${keyAttr}=${node.node.attributes[keyAttr]}`;
  }
  return node.node.name;
}

interface TreeRowProps {
  item: FlatTreeItem;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  activeFilters: Set<DiffType>;
  diffIndexMap: Map<string, number>;
  navMode: 'group' | 'node';
}

function TreeRow({
  item,
  expandedNodes,
  onToggle,
  activeFilters,
  diffIndexMap,
  navMode,
}: TreeRowProps) {
  const { t } = useLanguage();
  const { node, depth } = item;
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children.length > 0;
  const canToggle = hasChildren && !node.isPlaceholder;
  
  // Only show highlighting if the filter is active
  const shouldHighlight = node.diffType && node.diffType !== 'unchanged' && activeFilters.has(node.diffType);
  const diffClass = shouldHighlight ? getDiffClass(node.diffType) : '';
  
  // Navigation IDs based on current nav mode
  const isGroupRoot = TREE_NAV_KEY_ATTRS.some(attr => node.node.attributes[attr] !== undefined);
  const isDiffNode = node.diffType !== 'unchanged' && activeFilters.has(node.diffType);
  const navKey = navMode === 'group'
    ? (isGroupRoot ? node.stableKey : null)
    : (isDiffNode ? node.stableKey : null);
  const diffIdx = navKey ? diffIndexMap.get(navKey) : undefined;
  const navId = diffIdx !== undefined ? `diff-${diffIdx}` : undefined;
  const indentStyle = { marginLeft: depth > 0 ? depth * 16 : 0 };

  // Render placeholder node with special styling
  if (node.isPlaceholder) {
    const placeholderDiffClass = node.diffType === 'added' 
      ? 'border-green-500/40' 
      : 'border-red-500/40';
    
    return (
      <div style={indentStyle}>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-md border border-dashed ${placeholderDiffClass} bg-[var(--color-bg-tertiary)] opacity-60`}
          data-diff-id={navId}
        >
          {/* Empty expand icon space */}
          <span className="flex-shrink-0 w-4" />

          {/* Ghost icon */}
          <span className="flex-shrink-0 text-[var(--color-text-muted)]">
            <File size={14} />
          </span>

          {/* Node name (from original) */}
          <span className="font-mono text-sm text-[var(--color-text-muted)] italic">
            &lt;{node.node.name}&gt;
          </span>

          {/* Attributes preview */}
          {Object.keys(node.node.attributes).length > 0 && (
            <span className="text-xs text-[var(--color-text-muted)] truncate italic">
              {Object.entries(node.node.attributes)
                .slice(0, 2)
                .map(([k, v]) => `${k}="${v}"`)
                .join(' ')}
            </span>
          )}

          {/* Placeholder label */}
          <span className="text-xs text-[var(--color-text-muted)] ml-auto">
            {node.diffType === 'added' ? t.addedOnOtherSide : t.removedFromHere}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={indentStyle}>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer hover:bg-[var(--color-bg-tertiary)] ${diffClass}`}
        onClick={() => canToggle && onToggle(node.id)}
        data-diff-id={navId}
      >
        {/* Expand/Collapse icon */}
        {hasChildren ? (
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-[var(--color-text-muted)]">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="flex-shrink-0 w-4" />
        )}

        {/* Node icon */}
        <span className="flex-shrink-0 text-[var(--color-accent)]">
          {hasChildren ? (
            isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />
          ) : (
            <File size={14} />
          )}
        </span>

        {/* Node name */}
        <span className="font-mono text-sm text-[var(--color-text-primary)]">
          &lt;{node.node.name}&gt;
        </span>

        {/* Attributes preview */}
        {Object.keys(node.node.attributes).length > 0 && (
          <span className="text-xs text-[var(--color-text-muted)] truncate">
            {Object.entries(node.node.attributes)
              .slice(0, 2)
              .map(([k, v]) => `${k}="${v}"`)
              .join(' ')}
            {Object.keys(node.node.attributes).length > 2 && '...'}
          </span>
        )}

        {/* Value preview */}
        {node.node.value && (
          <span className="text-xs text-[var(--color-accent)] truncate max-w-32">
            = "{node.node.value.slice(0, 30)}{node.node.value.length > 30 ? '...' : ''}"
          </span>
        )}

        {/* Diff badge */}
        {shouldHighlight && (
          <DiffBadge
            type={node.diffType}
            label={
              node.diffType === 'added'
                ? `${t.badgeAdded} · ${t.sideOnlyB}`
                : node.diffType === 'removed'
                  ? `${t.badgeRemoved} · ${t.sideOnlyA}`
                  : node.diffType === 'modified'
                    ? t.badgeModified
                    : ''
            }
          />
        )}
      </div>
    </div>
  );
}

function getDiffClass(type: DiffType): string {
  switch (type) {
    case 'added':
      return 'bg-[var(--color-diff-added-bg)] border-l-2 border-[var(--color-diff-added-border)]';
    case 'removed':
      return 'bg-[var(--color-diff-removed-bg)] border-l-2 border-[var(--color-diff-removed-border)]';
    case 'modified':
      return 'bg-[var(--color-diff-modified-bg)] border-l-2 border-[var(--color-diff-modified-border)]';
    default:
      return '';
  }
}

function DiffBadge({ type, label }: { type: DiffType; label: string }) {
  const colorMap = {
    added: 'bg-[var(--color-diff-added-bg)] text-[var(--color-diff-added-text)] border border-[var(--color-diff-added-border)]',
    removed: 'bg-[var(--color-diff-removed-bg)] text-[var(--color-diff-removed-text)] border border-[var(--color-diff-removed-border)]',
    modified: 'bg-[var(--color-diff-modified-bg)] text-[var(--color-diff-modified-text)] border border-[var(--color-diff-modified-border)]',
    unchanged: '',
  };

  if (!label) return null;

  return (
    <span className={`ml-auto px-1.5 py-0.5 text-xs font-medium rounded ${colorMap[type]}`}>
      {label}
    </span>
  );
}

function DiffLegend() {
  const { t } = useLanguage();
  
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded border border-[var(--color-diff-added-border)] bg-[var(--color-diff-added-bg)]" />
        <span className="text-[var(--color-text-muted)]">
          {t.added} · {t.sideOnlyB}
        </span>
      </span>
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded border border-[var(--color-diff-removed-border)] bg-[var(--color-diff-removed-bg)]" />
        <span className="text-[var(--color-text-muted)]">
          {t.removed} · {t.sideOnlyA}
        </span>
      </span>
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded border border-[var(--color-diff-modified-border)] bg-[var(--color-diff-modified-bg)]" />
        <span className="text-[var(--color-text-muted)]">{t.modified}</span>
      </span>
    </div>
  );
}
