/**
 * Tree View Component
 * Shows XML structure as collapsible tree with diff highlighting
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Maximize2, Minimize2 } from 'lucide-react';
import { parseXML } from '../core/xml-parser';
import type { DiffResult, DiffType } from '../core/xml-diff';
import { buildPairedDiffTrees, expandAll, collapseAll, DIFF_KEY_ATTRS } from '../core/xml-tree';
import type { TreeNode } from '../core/xml-tree';
import { useLanguage } from '../contexts/LanguageContext';

// Tree navigation grouping keys (UX): treat only real “entities” as navigable
// - exclude `name` to avoid root like <company name="..."> swallowing the whole tree
const TREE_NAV_KEY_ATTRS = DIFF_KEY_ATTRS.filter(a => a !== 'name');

interface TreeViewProps {
  xmlA: string;
  xmlB: string;
  diffResults: DiffResult[];
  activeFilters: Set<DiffType>;
  onNavCountChange?: (count: number) => void;
}

export function TreeView({ xmlA, xmlB, diffResults, activeFilters, onNavCountChange }: TreeViewProps) {
  const { t } = useLanguage();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Parse XML and build paired diff trees (include placeholders)
  const { treeA, treeB } = useMemo(() => {
    const parsedA = parseXML(xmlA);
    const parsedB = parseXML(xmlB);
    
    // Use paired tree builder to create placeholder nodes
    const { treeA, treeB } = buildPairedDiffTrees(parsedA.root, parsedB.root, diffResults);
    return { treeA, treeB };
  }, [xmlA, xmlB, diffResults]);

  // Build navigable group index map (UX rule):
  // - Only navigate to top-level entities with key attributes (id/key/name/code/uuid)
  // - Order follows left tree preorder traversal (including placeholders)
  const diffIndexMap = useMemo(() => {
    const indexMap = new Map<string, number>();
    let diffIdx = 0;

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
          diffIdx++;
        }
        // Do NOT traverse into children for additional groups; keeps UX as “entity-level”
        return;
      }
      for (const child of n.children) traverseLeft(child);
    }

    traverseLeft(treeA);
    return indexMap;
  }, [treeA, activeFilters]);

  // Report navigable count to App (for correct counter + bounds)
  useEffect(() => {
    onNavCountChange?.(diffIndexMap.size);
  }, [diffIndexMap.size, onNavCountChange]);

  // Initialize expanded state
  useMemo(() => {
    if (expandedNodes.size === 0 && (treeA || treeB)) {
      const initial = new Set<string>();
      if (treeA) initial.add(treeA.id);
      if (treeB) initial.add(treeB.id);
      setExpandedNodes(initial);
    }
  }, [treeA, treeB, expandedNodes.size]);

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
        <button
          onClick={handleExpandAll}
          disabled={isFullyExpanded}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
            isFullyExpanded 
              ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] cursor-default' 
              : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
          }`}
        >
          <Maximize2 size={14} />
          {t.expandAll}
        </button>
        <button
          onClick={handleCollapseAll}
          disabled={isFullyCollapsed}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
            isFullyCollapsed 
              ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] cursor-default' 
              : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
          }`}
        >
          <Minimize2 size={14} />
          {t.collapseAll}
        </button>
        <div className="flex-1" />
        <DiffLegend />
      </div>

      {/* Tree panels */}
      <div className="flex-1 flex divide-x divide-[var(--color-border)] overflow-hidden">
        {/* Left tree - XML A */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
              {t.originalXml}
            </h4>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {treeA && (
              <TreeNodeComponent
                node={treeA}
                expandedNodes={expandedNodes}
                onToggle={handleToggle}
                activeFilters={activeFilters}
                diffIndexMap={diffIndexMap}
              />
            )}
          </div>
        </div>

        {/* Right tree - XML B */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
              {t.newXml}
            </h4>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {treeB && (
              <TreeNodeComponent
                node={treeB}
                expandedNodes={expandedNodes}
                onToggle={handleToggle}
                activeFilters={activeFilters}
                diffIndexMap={diffIndexMap}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TreeNodeComponentProps {
  node: TreeNode;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  activeFilters: Set<DiffType>;
  diffIndexMap: Map<string, number>;
  depth?: number;
}

function TreeNodeComponent({
  node,
  expandedNodes,
  onToggle,
  activeFilters,
  diffIndexMap,
  depth = 0,
}: TreeNodeComponentProps) {
  const { t } = useLanguage();
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children.length > 0;
  
  // Only show highlighting if the filter is active
  const shouldHighlight = node.diffType && node.diffType !== 'unchanged' && activeFilters.has(node.diffType);
  const diffClass = shouldHighlight ? getDiffClass(node.diffType) : '';
  
  // Only group roots have navigation IDs (entity-level navigation)
  const isGroupRoot = TREE_NAV_KEY_ATTRS.some(attr => node.node.attributes[attr] !== undefined);
  const diffIdx = isGroupRoot ? diffIndexMap.get(node.stableKey) : undefined;
  const navId = diffIdx !== undefined ? `diff-${diffIdx}` : undefined;

  // Render placeholder node with special styling
  if (node.isPlaceholder) {
    const placeholderDiffClass = node.diffType === 'added' 
      ? 'border-green-500/40' 
      : 'border-red-500/40';
    
    return (
      <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
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
            {node.placeholderLabel || (node.diffType === 'added' ? t.addedOnOtherSide : t.removedFromHere)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer hover:bg-[var(--color-bg-tertiary)] ${diffClass}`}
        onClick={() => hasChildren && onToggle(node.id)}
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
          <DiffBadge type={node.diffType} label={
            node.diffType === 'added' ? t.badgeAdded :
            node.diffType === 'removed' ? t.badgeRemoved :
            node.diffType === 'modified' ? t.badgeModified : ''
          } />
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child, index) => (
            <TreeNodeComponent
              key={`${child.id}-${index}`}
              node={child}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              activeFilters={activeFilters}
              diffIndexMap={diffIndexMap}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getDiffClass(type: DiffType): string {
  switch (type) {
    case 'added':
      return 'bg-green-500/10 border-l-2 border-green-500';
    case 'removed':
      return 'bg-red-500/10 border-l-2 border-red-500';
    case 'modified':
      return 'bg-yellow-500/10 border-l-2 border-yellow-500';
    default:
      return '';
  }
}

function DiffBadge({ type, label }: { type: DiffType; label: string }) {
  const colorMap = {
    added: 'bg-green-500 text-white',
    removed: 'bg-red-500 text-white',
    modified: 'bg-yellow-500 text-black',
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
        <span className="w-3 h-3 rounded bg-green-500" />
        <span className="text-[var(--color-text-muted)]">{t.added}</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded bg-red-500" />
        <span className="text-[var(--color-text-muted)]">{t.removed}</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded bg-yellow-500" />
        <span className="text-[var(--color-text-muted)]">{t.modified}</span>
      </span>
    </div>
  );
}
