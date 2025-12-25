/**
 * XML Tree Utilities
 * Helper functions for tree manipulation and traversal
 */

import type { XMLNode } from './xml-parser';
import type { DiffResult, DiffType } from './xml-diff';

// Key attributes used to align nodes across trees (must match xml-diff.ts)
export const DIFF_KEY_ATTRS = ['id', 'key', 'name', 'code', 'uuid'];

type DiffBucket = Map<string, DiffResult[]>;

export interface TreeNode {
  id: string;
  node: XMLNode;
  stableKey: string;
  diffType: DiffType;
  diffResult: DiffResult | null;
  children: TreeNode[];
  isExpanded: boolean;
  depth: number;
  isPlaceholder: boolean;  // 是否為佔位節點（對面不存在的節點）
  placeholderLabel?: string;  // 佔位節點顯示的標籤
}

/**
 * Build a tree structure for visualization with diff information
 * Creates placeholder nodes for added/removed items on the opposite side
 */
export function buildDiffTree(
  root: XMLNode | null,
  diffResults: DiffResult[],
  side: 'old' | 'new'
): TreeNode | null {
  if (!root) return null;

  const diffMap = new Map<string, DiffResult>();
  for (const result of diffResults) {
    const key = getDiffResultKey(result);
    diffMap.set(key, result);
  }

  return buildTreeNode(root, diffMap, side, 0);
}

/**
 * Build paired trees with placeholder nodes for missing items
 * Returns both trees with aligned structure
 */
export function buildPairedDiffTrees(
  rootA: XMLNode | null,
  rootB: XMLNode | null,
  diffResults: DiffResult[]
): { treeA: TreeNode | null; treeB: TreeNode | null } {
  // Build two buckets: by key and by path (allow multiple entries for same path)
  const diffByKey: DiffBucket = new Map();
  const diffByPath: DiffBucket = new Map();

  function addToBucket(bucket: DiffBucket, k: string, val: DiffResult) {
    if (!bucket.has(k)) bucket.set(k, []);
    bucket.get(k)!.push(val);
  }

  for (const result of diffResults) {
    const key = getDiffResultKey(result);
    addToBucket(diffByKey, key, result);
    addToBucket(diffByPath, result.path, result);
  }

  // Build initial trees
  const treeA = rootA ? buildTreeNodeWithPlaceholders(rootA, diffByKey, diffByPath, 'old', 0, rootB) : null;
  const treeB = rootB ? buildTreeNodeWithPlaceholders(rootB, diffByKey, diffByPath, 'new', 0, rootA) : null;

  return { treeA, treeB };
}

function buildTreeNode(
  node: XMLNode,
  diffMap: Map<string, DiffResult>,
  side: 'old' | 'new',
  depth: number
): TreeNode {
  const diffResult = diffMap.get(node.path) || null;
  const stableKey = getNodeKey(node);
  
  let diffType: DiffType = 'unchanged';
  if (diffResult) {
    diffType = diffResult.type;
    // For side-specific display
    if (diffType === 'added' && side === 'old') {
      diffType = 'unchanged'; // Don't show "added" on old side
    }
    if (diffType === 'removed' && side === 'new') {
      diffType = 'unchanged'; // Don't show "removed" on new side
    }
  }

  const treeNode: TreeNode = {
    id: `${side}-${node.path}`,
    node,
    stableKey,
    diffType,
    diffResult,
    children: [],
    isExpanded: true,
    depth,
    isPlaceholder: false,
  };

  for (const child of node.children) {
    treeNode.children.push(buildTreeNode(child, diffMap, side, depth + 1));
  }

  return treeNode;
}

/**
 * Build tree node with placeholder nodes for items that exist on the other side
 * Children are sorted by key to ensure alignment between left and right trees
 */
function buildTreeNodeWithPlaceholders(
  node: XMLNode,
  diffByKey: DiffBucket,
  diffByPath: DiffBucket,
  side: 'old' | 'new',
  depth: number,
  otherRoot: XMLNode | null
): TreeNode {
  const diffResult = pickBestDiff(node, side, diffByKey, diffByPath);
  const stableKey = getNodeKey(node);
  
  let diffType: DiffType = 'unchanged';
  if (diffResult) {
    diffType = diffResult.type;
    if (diffType === 'added' && side === 'old') {
      diffType = 'unchanged';
    }
    if (diffType === 'removed' && side === 'new') {
      diffType = 'unchanged';
    }
  }

  const treeNode: TreeNode = {
    id: `${side}-${node.path}`,
    node,
    stableKey,
    diffType,
    diffResult,
    children: [],
    isExpanded: true,
    depth,
    isPlaceholder: false,
  };

  // Get corresponding node from the other tree to find missing children
  // Use key-based matching to handle node reordering correctly
  const otherNode = otherRoot ? findNodeByKey(otherRoot, node) : null;
  
  // Build a map of children by their identifying key
  const childMap = new Map<string, XMLNode>();
  for (const child of node.children) {
    const key = getNodeKey(child);
    childMap.set(key, child);
  }
  
  // Get other side's children keys
  const otherChildMap = new Map<string, XMLNode>();
  if (otherNode) {
    for (const child of otherNode.children) {
      const key = getNodeKey(child);
      otherChildMap.set(key, child);
    }
  }

  // Merge children from both sides in a consistent order
  // Use the union of keys, sorted alphabetically for consistency
  const allKeys = new Set<string>();
  node.children.forEach(child => allKeys.add(getNodeKey(child)));
  if (otherNode) {
    otherNode.children.forEach(child => allKeys.add(getNodeKey(child)));
  }
  
  // Sort keys for consistent ordering between left and right trees
  const sortedKeys = Array.from(allKeys).sort((a, b) => a.localeCompare(b));
  
  // Process children in sorted order
  for (const key of sortedKeys) {
    const myChild = childMap.get(key);
    const otherChild = otherChildMap.get(key);
    
    if (myChild) {
      // This side has the child - add it
      const childTree = buildTreeNodeWithPlaceholders(myChild, diffByKey, diffByPath, side, depth + 1, otherRoot);
      treeNode.children.push(childTree);
    } else if (otherChild) {
      // Only other side has this child - check if we need a placeholder
      const otherDiffResult = pickBestDiff(otherChild, side === 'old' ? 'new' : 'old', diffByKey, diffByPath);
      if (otherDiffResult) {
        if ((side === 'old' && otherDiffResult.type === 'added') ||
            (side === 'new' && otherDiffResult.type === 'removed')) {
          const placeholder = createPlaceholderNode(
            otherChild,
            side,
            depth + 1,
            otherDiffResult.type === 'added' ? 'added' : 'removed'
          );
          treeNode.children.push(placeholder);
        }
      }
    }
  }

  return treeNode;
}

/**
 * Create a placeholder node for a missing item
 */
function createPlaceholderNode(
  originalNode: XMLNode,
  side: 'old' | 'new',
  depth: number,
  originalType: 'added' | 'removed'
): TreeNode {
  const stableKey = getNodeKey(originalNode);
  // Placeholder shows what's missing on this side
  const placeholderType: DiffType = originalType === 'added' ? 'added' : 'removed';
  const label = originalType === 'added' 
    ? `新增於另一邊` 
    : `已從此處刪除`;

  return {
    id: `${side}-placeholder-${originalNode.path}`,
    node: originalNode,  // Keep reference to show the name
    stableKey,
    diffType: placeholderType,
    diffResult: null,
    children: [],  // Placeholders don't show children (collapsed view)
    isExpanded: false,
    depth,
    isPlaceholder: true,
    placeholderLabel: label,
  };
}

/**
 * Find a node by its key attributes in the tree (not by path, to handle reordering)
 * This finds the corresponding node based on element name + key attributes
 */
function findNodeByKey(root: XMLNode, targetNode: XMLNode): XMLNode | null {
  const targetKey = getNodeKey(targetNode);
  const targetName = targetNode.name;
  
  function search(node: XMLNode): XMLNode | null {
    // Check if this node matches
    if (node.name === targetName && getNodeKey(node) === targetKey) {
      return node;
    }
    
    // Search children
    for (const child of node.children) {
      const found = search(child);
      if (found) return found;
    }
    
    return null;
  }
  
  return search(root);
}

/**
 * Get a unique key for a node (used for matching across trees)
 */
export function getNodeKey(node: XMLNode): string {
  // Use key attributes if available, otherwise fall back to path
  for (const attr of DIFF_KEY_ATTRS) {
    if (node.attributes[attr]) {
      return `${node.name}[${attr}=${node.attributes[attr]}]`;
    }
  }
  return node.path;
}

/**
 * Build a stable key for a diff result, aligned with getNodeKey
 */
function getDiffResultKey(result: DiffResult): string {
  // Prefer keys from oldAttributes for removed/modified, newAttributes for added/modified
  for (const attr of DIFF_KEY_ATTRS) {
    const val = result.oldAttributes[attr] ?? result.newAttributes[attr];
    if (val !== undefined) {
      return `${result.nodeName}[${attr}=${val}]`;
    }
  }
  return result.path;
}

/**
 * Pick the best diff entry for a given node and side, considering both key and path matches.
 * When path collisions occur (e.g., employee[2] reused), prefer types based on the side:
 * - old side prefers removed > modified > added
 * - new side prefers added > modified > removed
 */
function pickBestDiff(
  node: XMLNode,
  side: 'old' | 'new',
  diffByKey: DiffBucket,
  diffByPath: DiffBucket
): DiffResult | null {
  const candidates: DiffResult[] = [];

  const key = getNodeKey(node);
  if (diffByKey.has(key)) {
    candidates.push(...(diffByKey.get(key) ?? []));
  }
  if (diffByPath.has(node.path)) {
    candidates.push(...(diffByPath.get(node.path) ?? []));
  }

  if (candidates.length === 0) return null;

  const priorityOld: DiffType[] = ['removed', 'modified', 'added'];
  const priorityNew: DiffType[] = ['added', 'modified', 'removed'];
  const priority = side === 'old' ? priorityOld : priorityNew;

  for (const t of priority) {
    const found = candidates.find(c => c.type === t);
    if (found) return found;
  }

  return candidates[0] ?? null;
}

/**
 * Flatten tree for virtualized rendering
 */
export function flattenTree(
  tree: TreeNode | null,
  expanded: Set<string> = new Set()
): TreeNode[] {
  if (!tree) return [];

  const result: TreeNode[] = [];
  
  function traverse(node: TreeNode, parentExpanded: boolean): void {
    if (!parentExpanded) return;
    
    result.push(node);
    
    const isExpanded = expanded.has(node.id) || node.isExpanded;
    for (const child of node.children) {
      traverse(child, isExpanded);
    }
  }

  traverse(tree, true);
  return result;
}

/**
 * Toggle node expansion
 */
export function toggleNodeExpansion(
  expanded: Set<string>,
  nodeId: string
): Set<string> {
  const newExpanded = new Set(expanded);
  if (newExpanded.has(nodeId)) {
    newExpanded.delete(nodeId);
  } else {
    newExpanded.add(nodeId);
  }
  return newExpanded;
}

/**
 * Expand all nodes
 */
export function expandAll(tree: TreeNode | null): Set<string> {
  const expanded = new Set<string>();
  
  function traverse(node: TreeNode): void {
    expanded.add(node.id);
    for (const child of node.children) {
      traverse(child);
    }
  }

  if (tree) traverse(tree);
  return expanded;
}

/**
 * Collapse all nodes
 */
export function collapseAll(): Set<string> {
  return new Set<string>();
}

/**
 * Get all paths that have changes
 */
export function getChangedPaths(diffResults: DiffResult[]): Set<string> {
  const paths = new Set<string>();
  
  for (const result of diffResults) {
    if (result.type !== 'unchanged') {
      paths.add(result.path);
      // Also add all parent paths
      const parts = result.path.split('/').filter(Boolean);
      let currentPath = '';
      for (const part of parts) {
        currentPath += '/' + part.replace(/\[\d+\]$/, '');
        paths.add(currentPath);
      }
    }
  }
  
  return paths;
}

/**
 * Navigate to a specific path in the tree
 */
export function getExpandedForPath(path: string): Set<string> {
  const expanded = new Set<string>();
  const parts = path.split('/').filter(Boolean);
  
  let currentPath = '';
  for (const part of parts) {
    currentPath += '/' + part;
    expanded.add(`old-${currentPath}`);
    expanded.add(`new-${currentPath}`);
  }
  
  return expanded;
}

/**
 * Count nodes by diff type in the tree
 */
export function countNodesByType(tree: TreeNode | null): Record<DiffType, number> {
  const counts: Record<DiffType, number> = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
  };

  function traverse(node: TreeNode): void {
    counts[node.diffType]++;
    for (const child of node.children) {
      traverse(child);
    }
  }

  if (tree) traverse(tree);
  return counts;
}

/**
 * Find common ancestor of two paths
 */
export function findCommonAncestor(path1: string, path2: string): string {
  const parts1 = path1.split('/').filter(Boolean);
  const parts2 = path2.split('/').filter(Boolean);
  
  const common: string[] = [];
  const minLen = Math.min(parts1.length, parts2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (parts1[i] === parts2[i]) {
      common.push(parts1[i]);
    } else {
      break;
    }
  }
  
  return '/' + common.join('/');
}

/**
 * Check if a path is ancestor of another
 */
export function isAncestor(ancestorPath: string, descendantPath: string): boolean {
  return descendantPath.startsWith(ancestorPath + '/') || descendantPath === ancestorPath;
}

/**
 * Get depth from path
 */
export function getPathDepth(path: string): number {
  return path.split('/').filter(Boolean).length;
}

