/**
 * XML Diff Engine
 * Compares two XML trees and outputs differences
 */

import type { XMLNode } from './xml-parser';
import { diffLines } from '../utils/line-diff';

export type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface DiffResult {
  type: DiffType;
  path: string;
  nodeName: string;
  oldValue: string | null;
  newValue: string | null;
  oldAttributes: Record<string, string>;
  newAttributes: Record<string, string>;
  attributeChanges: AttributeChange[];
  oldNode: XMLNode | null;
  newNode: XMLNode | null;
  depth: number;
}

export interface AttributeChange {
  name: string;
  type: 'added' | 'removed' | 'modified';
  oldValue: string | null;
  newValue: string | null;
}

export interface DiffSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  total: number;
}

/**
 * Compare two XML trees and return all differences
 */
export function diffXML(
  oldRoot: XMLNode | null,
  newRoot: XMLNode | null
): DiffResult[] {
  const results: DiffResult[] = [];

  // Handle null cases
  if (!oldRoot && !newRoot) {
    return results;
  }

  if (!oldRoot && newRoot) {
    // Entire new tree is added
    addAllNodes(newRoot, results, 'added');
    return results;
  }

  if (oldRoot && !newRoot) {
    // Entire old tree is removed
    addAllNodes(oldRoot, results, 'removed');
    return results;
  }

  // Both trees exist - compare them
  compareNodes(oldRoot!, newRoot!, results, 0);

  return results;
}

/**
 * Recursively compare two nodes
 */
function compareNodes(
  oldNode: XMLNode,
  newNode: XMLNode,
  results: DiffResult[],
  depth: number
): void {
  // Check if nodes have the same name
  if (oldNode.name !== newNode.name) {
    // Different root elements - treat as remove + add
    addAllNodes(oldNode, results, 'removed');
    addAllNodes(newNode, results, 'added');
    return;
  }

  // Compare attributes
  const attrChanges = compareAttributes(oldNode.attributes, newNode.attributes);
  
  // Compare values
  const valueChanged = oldNode.value !== newNode.value;
  
  // Determine diff type
  let diffType: DiffType = 'unchanged';
  if (attrChanges.length > 0 || valueChanged) {
    diffType = 'modified';
  }

  results.push({
    type: diffType,
    path: newNode.path,
    nodeName: newNode.name,
    oldValue: oldNode.value,
    newValue: newNode.value,
    oldAttributes: oldNode.attributes,
    newAttributes: newNode.attributes,
    attributeChanges: attrChanges,
    oldNode,
    newNode,
    depth,
  });

  // Compare children
  compareChildren(oldNode.children, newNode.children, results, depth + 1);
}

/**
 * Compare attributes between two nodes
 */
function compareAttributes(
  oldAttrs: Record<string, string>,
  newAttrs: Record<string, string>
): AttributeChange[] {
  const changes: AttributeChange[] = [];
  const allKeys = new Set([...Object.keys(oldAttrs), ...Object.keys(newAttrs)]);

  for (const key of allKeys) {
    const oldVal = oldAttrs[key];
    const newVal = newAttrs[key];

    if (oldVal === undefined && newVal !== undefined) {
      changes.push({
        name: key,
        type: 'added',
        oldValue: null,
        newValue: newVal,
      });
    } else if (oldVal !== undefined && newVal === undefined) {
      changes.push({
        name: key,
        type: 'removed',
        oldValue: oldVal,
        newValue: null,
      });
    } else if (oldVal !== newVal) {
      changes.push({
        name: key,
        type: 'modified',
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  return changes;
}

/**
 * Key attributes to use for matching nodes (in priority order)
 */
const KEY_ATTRIBUTES = ['id', 'key', 'name', 'code', 'uuid'];

/**
 * Get the matching key for a node based on its attributes
 * Returns the first found key attribute value, or null if none found
 */
function getNodeKey(node: XMLNode): string | null {
  for (const attr of KEY_ATTRIBUTES) {
    if (node.attributes[attr]) {
      return `${attr}:${node.attributes[attr]}`;
    }
  }
  return null;
}

/**
 * Compare children arrays using key-based matching with fallback to sequential
 */
function compareChildren(
  oldChildren: XMLNode[],
  newChildren: XMLNode[],
  results: DiffResult[],
  depth: number
): void {
  // Group children by element name first
  const oldByName = groupByName(oldChildren);
  const newByName = groupByName(newChildren);

  const processedOld = new Set<number>();
  const processedNew = new Set<number>();

  // Process each element name group
  for (const [name, oldIndices] of oldByName.entries()) {
    const newIndices = newByName.get(name) || [];

    // Build key maps for this element name
    const oldByKey = new Map<string, number>();
    const newByKey = new Map<string, number>();
    const oldWithoutKey: number[] = [];
    const newWithoutKey: number[] = [];

    for (const idx of oldIndices) {
      const key = getNodeKey(oldChildren[idx]);
      if (key) {
        oldByKey.set(key, idx);
      } else {
        oldWithoutKey.push(idx);
      }
    }

    for (const idx of newIndices) {
      const key = getNodeKey(newChildren[idx]);
      if (key) {
        newByKey.set(key, idx);
      } else {
        newWithoutKey.push(idx);
      }
    }

    // First pass: match by key
    for (const [key, oldIdx] of oldByKey.entries()) {
      const newIdx = newByKey.get(key);
      if (newIdx !== undefined) {
        // Found matching key in both old and new
        processedOld.add(oldIdx);
        processedNew.add(newIdx);
        compareNodes(oldChildren[oldIdx], newChildren[newIdx], results, depth);
        newByKey.delete(key); // Mark as processed
      } else {
        // Key exists in old but not in new - removed
        processedOld.add(oldIdx);
        addAllNodes(oldChildren[oldIdx], results, 'removed');
      }
    }

    // Keys that exist only in new - added
    for (const [, newIdx] of newByKey.entries()) {
      processedNew.add(newIdx);
      addAllNodes(newChildren[newIdx], results, 'added');
    }

    // Second pass: match nodes without keys by sequence
    const matchCount = Math.min(oldWithoutKey.length, newWithoutKey.length);
    
    for (let i = 0; i < matchCount; i++) {
      const oldIdx = oldWithoutKey[i];
      const newIdx = newWithoutKey[i];
      
      processedOld.add(oldIdx);
      processedNew.add(newIdx);
      
      compareNodes(oldChildren[oldIdx], newChildren[newIdx], results, depth);
    }

    // Remaining old nodes without keys are removed
    for (let i = matchCount; i < oldWithoutKey.length; i++) {
      const oldIdx = oldWithoutKey[i];
      processedOld.add(oldIdx);
      addAllNodes(oldChildren[oldIdx], results, 'removed');
    }

    // Remaining new nodes without keys are added
    for (let i = matchCount; i < newWithoutKey.length; i++) {
      const newIdx = newWithoutKey[i];
      processedNew.add(newIdx);
      addAllNodes(newChildren[newIdx], results, 'added');
    }
  }

  // Handle new element names that don't exist in old
  for (const [name, newIndices] of newByName.entries()) {
    if (!oldByName.has(name)) {
      for (const newIdx of newIndices) {
        if (!processedNew.has(newIdx)) {
          addAllNodes(newChildren[newIdx], results, 'added');
        }
      }
    }
  }
}

/**
 * Group children by their name
 */
function groupByName(children: XMLNode[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  
  for (let i = 0; i < children.length; i++) {
    const name = children[i].name;
    if (!map.has(name)) {
      map.set(name, []);
    }
    map.get(name)!.push(i);
  }
  
  return map;
}

/**
 * Add all nodes in a tree as added or removed
 */
function addAllNodes(
  node: XMLNode,
  results: DiffResult[],
  type: 'added' | 'removed'
): void {
  const depth = (node.path.match(/\//g) || []).length - 1;
  
  results.push({
    type,
    path: node.path,
    nodeName: node.name,
    oldValue: type === 'removed' ? node.value : null,
    newValue: type === 'added' ? node.value : null,
    oldAttributes: type === 'removed' ? node.attributes : {},
    newAttributes: type === 'added' ? node.attributes : {},
    attributeChanges: type === 'added' 
      ? Object.entries(node.attributes).map(([name, value]): AttributeChange => ({
          name,
          type: 'added',
          oldValue: null,
          newValue: value,
        }))
      : Object.entries(node.attributes).map(([name, value]): AttributeChange => ({
          name,
          type: 'removed',
          oldValue: value,
          newValue: null,
        })),
    oldNode: type === 'removed' ? node : null,
    newNode: type === 'added' ? node : null,
    depth,
  });

  for (const child of node.children) {
    addAllNodes(child, results, type);
  }
}

/**
 * Calculate diff summary statistics
 */
export function getDiffSummary(results: DiffResult[]): DiffSummary {
  const summary: DiffSummary = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    total: results.length,
  };

  for (const result of results) {
    summary[result.type]++;
  }

  return summary;
}

/**
 * Filter diff results by type
 */
export function filterDiffByType(
  results: DiffResult[],
  types: DiffType[]
): DiffResult[] {
  return results.filter(r => types.includes(r.type));
}

/**
 * Check if two XML trees are identical
 */
export function areTreesIdentical(
  oldRoot: XMLNode | null,
  newRoot: XMLNode | null
): boolean {
  const results = diffXML(oldRoot, newRoot);
  return results.every(r => r.type === 'unchanged');
}

/**
 * Get only the nodes that have changes (including their path to root)
 */
export function getChangedNodes(results: DiffResult[]): DiffResult[] {
  return results.filter(r => r.type !== 'unchanged');
}

/**
 * Create a unified diff view representation
 */
export interface UnifiedDiffLine {
  type: 'context' | 'added' | 'removed' | 'modified';
  lineNumber: { old: number | null; new: number | null };
  content: string;
  path?: string;
}

/**
 * Generate line-by-line diff for inline view
 */
export function generateLineDiff(
  oldXML: string,
  newXML: string
): UnifiedDiffLine[] {
  const oldLines = oldXML.split('\n');
  const newLines = newXML.split('\n');
  const result: UnifiedDiffLine[] = [];
  const { ops } = diffLines(oldLines, newLines);

  let oldLineNumber = 0;
  let newLineNumber = 0;

  for (const op of ops) {
    if (op.type === 'equal') {
      oldLineNumber++;
      newLineNumber++;
      result.push({
        type: 'context',
        lineNumber: { old: oldLineNumber, new: newLineNumber },
        content: op.line,
      });
    } else if (op.type === 'delete') {
      oldLineNumber++;
      result.push({
        type: 'removed',
        lineNumber: { old: oldLineNumber, new: null },
        content: op.line,
      });
    } else {
      newLineNumber++;
      result.push({
        type: 'added',
        lineNumber: { old: null, new: newLineNumber },
        content: op.line,
      });
    }
  }

  return result;
}

/**
 * Count navigable diffs for side-by-side view (Sublime Merge style)
 * Adjacent removed+added lines are paired, each pair = 1 navigable row
 */
export function countSideBySideDiffs(linesA: string[], linesB: string[]): number {
  const { ops } = diffLines(linesA, linesB);
  let count = 0;
  let idx = 0;

  while (idx < ops.length) {
    if (ops[idx].type === 'equal') {
      idx++;
      continue;
    }

    let removedCount = 0;
    let addedCount = 0;

    while (idx < ops.length && ops[idx].type !== 'equal') {
      if (ops[idx].type === 'delete') {
        removedCount++;
      } else {
        addedCount++;
      }
      idx++;
    }

    count += Math.max(removedCount, addedCount);
  }

  return count;
}

/**
 * Count navigable diffs for inline view
 * Uses unified diff where each added/removed line counts separately
 */
export function countInlineDiffs(linesA: string[], linesB: string[]): number {
  const { ops } = diffLines(linesA, linesB);
  let count = 0;

  for (const op of ops) {
    if (op.type === 'insert' || op.type === 'delete') {
      count++;
    }
  }

  return count;
}

