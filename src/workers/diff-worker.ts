/**
 * XML Diff Web Worker
 * Performs XML parsing and diff computation in a background thread
 */

import { XMLParser } from 'fast-xml-parser';

// Types need to be duplicated here since workers can't import from main thread modules directly
// We'll use shared type definitions through message passing

export interface XMLNode {
  name: string;
  path: string;
  attributes: Record<string, string>;
  value: string | null;
  children: XMLNode[];
  nodeType: 'element' | 'text' | 'comment' | 'cdata';
}

export interface ParseResult {
  success: boolean;
  root: XMLNode | null;
  error: string | null;
  warnings: ParseWarning[];
  rawXML: string;
}

export interface ParseWarning {
  code: 'mixed-content';
  count: number;
  samples?: ParseWarningSample[];
}

export interface ParseWarningSample {
  name: string;
  path: string;
  attributes: Record<string, string>;
}

export type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface AttributeChange {
  name: string;
  type: 'added' | 'removed' | 'modified';
  oldValue: string | null;
  newValue: string | null;
}

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

export interface DiffSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  total: number;
}

export interface LineDiffOp {
  type: 'equal' | 'insert' | 'delete';
  line: string;
}

export interface UnifiedDiffLine {
  type: 'context' | 'added' | 'removed' | 'modified';
  lineNumber: { old: number | null; new: number | null };
  content: string;
  path?: string;
}

export interface InlineLineStats {
  added: number;
  removed: number;
  unchanged: number;
  total: number;
}

export interface LineLevelStats {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  total: number;
  navigableCount: number;
}

export interface LineDiffPayload {
  ops: LineDiffOp[];
  inlineLines: UnifiedDiffLine[];
  inlineStats: InlineLineStats;
  sideBySideStats: LineLevelStats;
  inlineDiffCount: number;
  formattedXmlA: string;
  formattedXmlB: string;
  isCoarse: boolean;
}

// Worker message types
export interface WorkerRequest {
  id: string;
  type: 'diff' | 'parse' | 'batch-diff';
  payload: DiffPayload | ParsePayload | BatchDiffPayload;
}

export interface DiffPayload {
  xmlA: string;
  xmlB: string;
  strictMode?: boolean;
}

export interface ParsePayload {
  xml: string;
  strictMode?: boolean;
}

export interface BatchDiffPayload {
  files: Array<{
    id: string;
    name: string;
    xmlA: string;
    xmlB: string;
  }>;
}

export interface WorkerResponse {
  id: string;
  type: 'diff-result' | 'parse-result' | 'batch-progress' | 'batch-complete' | 'single-diff-progress' | 'error';
  payload: unknown;
}

export interface DiffResultPayload {
  results: DiffResult[];
  summary: DiffSummary;
  parseA: ParseResult;
  parseB: ParseResult;
  lineDiff: LineDiffPayload;
}

export interface BatchProgressPayload {
  completed: number;
  total: number;
  currentFile: string;
}

export interface SingleDiffProgressPayload {
  stage: 'parsing-a' | 'parsing-b' | 'computing-line-diff' | 'computing-diff' | 'done';
  progress: number; // 0-100
}

export interface BatchResultItem {
  id: string;
  name: string;
  success: boolean;
  error?: string;
  results?: DiffResult[];
  summary?: DiffSummary;
}

export interface BatchCompletePayload {
  results: BatchResultItem[];
}

// ============================================
// XML Parser Implementation (Worker Version)
// Using fast-xml-parser for Web Worker compatibility
// ============================================

// Configure fast-xml-parser
const xmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  commentPropName: '#comment',
  cdataPropName: '#cdata',
  preserveOrder: true,
  trimValues: true,
};

function parseXML(xmlString: string, strictMode?: boolean): ParseResult {
  if (!xmlString || xmlString.trim() === '') {
    return {
      success: false,
      root: null,
      error: 'XML content is empty',
      warnings: [],
      rawXML: xmlString,
    };
  }

  try {
    const parser = new XMLParser(xmlParserOptions);
    const parsed = parser.parse(xmlString);
    
    if (!parsed || parsed.length === 0) {
      return {
        success: false,
        root: null,
        error: 'Failed to parse XML',
        warnings: [],
        rawXML: xmlString,
      };
    }

    // Find the root element (skip XML declaration if present)
    let rootData = parsed[0];
    if (rootData['?xml']) {
      rootData = parsed[1];
    }
    
    if (!rootData) {
      return {
        success: false,
        root: null,
        error: 'No root element found',
        warnings: [],
        rawXML: xmlString,
      };
    }

    const root = convertFastXMLToXMLNode(rootData, '');
    const warnings = collectParseWarnings(root);
    if (strictMode && warnings.length > 0) {
      return {
        success: false,
        root: null,
        error: 'Strict mode: mixed content detected',
        warnings,
        rawXML: xmlString,
      };
    }

    return {
      success: true,
      root,
      error: null,
      warnings,
      rawXML: xmlString,
    };
  } catch (error) {
    return {
      success: false,
      root: null,
      error: error instanceof Error ? error.message : 'XML parsing failed',
      warnings: [],
      rawXML: xmlString,
    };
  }
}

function collectParseWarnings(root: XMLNode): ParseWarning[] {
  let mixedContentCount = 0;
  const samples: ParseWarningSample[] = [];
  const maxSamples = 8;

  const visit = (node: XMLNode) => {
    if (node.nodeType !== 'element') return;
    const hasElement = node.children.some(child => child.nodeType === 'element');
    const hasText = Boolean(node.value && node.value.trim()) ||
      node.children.some(
        child => child.nodeType === 'text' && Boolean(child.value && child.value.trim())
      );

    if (hasElement && hasText) {
      mixedContentCount += 1;
      if (samples.length < maxSamples) {
        samples.push({
          name: node.name,
          path: node.path,
          attributes: node.attributes,
        });
      }
    }

    node.children.forEach(visit);
  };

  visit(root);

  if (mixedContentCount <= 0) return [];
  return [{ code: 'mixed-content', count: mixedContentCount, samples }];
}

/**
 * Convert fast-xml-parser output to our XMLNode format
 */
function convertFastXMLToXMLNode(
  data: Record<string, unknown>,
  parentPath: string,
  siblingIndex?: number
): XMLNode {
  // Get the element name (first key that's not an attribute or special node)
  const keys = Object.keys(data);
  const elementKey = keys.find(k => !k.startsWith('@_') && !k.startsWith('#') && !k.startsWith(':@') && !k.startsWith('?'));
  
  if (!elementKey) {
    // This might be a text-only node
    return {
      name: '#text',
      path: `${parentPath}/#text`,
      attributes: {},
      value: String(data['#text'] || ''),
      children: [],
      nodeType: 'text',
    };
  }
  
  const name = elementKey;
  const indexSuffix = siblingIndex !== undefined && siblingIndex > 0 ? `[${siblingIndex}]` : '';
  const currentPath = parentPath ? `${parentPath}/${name}${indexSuffix}` : `/${name}`;

  // Extract attributes from :@ key
  const attributes: Record<string, string> = {};
  const attrData = data[':@'] as Record<string, unknown> | undefined;
  if (attrData) {
    for (const [key, val] of Object.entries(attrData)) {
      if (key.startsWith('@_')) {
        attributes[key.substring(2)] = String(val);
      }
    }
  }

  // Get the element content
  const content = data[elementKey];
  let value: string | null = null;
  const children: XMLNode[] = [];

  if (Array.isArray(content)) {
    // Count children by name for indexing
    const childNameCounts: Record<string, number> = {};
    for (const child of content) {
      const childKeys = Object.keys(child);
      const childName = childKeys.find(k => !k.startsWith('@_') && !k.startsWith(':@') && !k.startsWith('?'));
      if (childName) {
        childNameCounts[childName] = (childNameCounts[childName] || 0) + 1;
      }
    }

    const childNameIndices: Record<string, number> = {};
    
    for (const child of content) {
      if (typeof child === 'object' && child !== null) {
        const childObj = child as Record<string, unknown>;
        
        // Handle text content
        if ('#text' in childObj) {
          const textVal = String(childObj['#text']).trim();
          if (textVal) {
            value = textVal;
          }
          continue;
        }
        
        // Handle comments
        if ('#comment' in childObj) {
          children.push({
            name: '#comment',
            path: `${currentPath}/#comment`,
            attributes: {},
            value: String(childObj['#comment']),
            children: [],
            nodeType: 'comment',
          });
          continue;
        }
        
        // Handle CDATA
        if ('#cdata' in childObj) {
          children.push({
            name: '#cdata',
            path: `${currentPath}/#cdata`,
            attributes: {},
            value: String(childObj['#cdata']),
            children: [],
            nodeType: 'cdata',
          });
          continue;
        }
        
        // Handle child elements
        const childKeys = Object.keys(childObj);
        const childName = childKeys.find(k => !k.startsWith('@_') && !k.startsWith(':@') && !k.startsWith('?'));
        
        if (childName) {
          const currentIndex = childNameIndices[childName] || 0;
          childNameIndices[childName] = currentIndex + 1;
          
          const needsIndex = childNameCounts[childName] > 1;
          const childNode = convertFastXMLToXMLNode(
            childObj,
            currentPath,
            needsIndex ? currentIndex : undefined
          );
          children.push(childNode);
        }
      }
    }
  } else if (typeof content === 'string' || typeof content === 'number') {
    value = String(content).trim() || null;
  }

  return {
    name,
    path: currentPath,
    attributes,
    value,
    children,
    nodeType: 'element',
  };
}

// ============================================
// XML Pretty Print (Worker Version)
// ============================================

function prettyPrintXMLFromNode(node: XMLNode | null): string {
  if (!node) return '';
  return serializeXML(node, 0);
}

function serializeXML(node: XMLNode, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  
  if (node.nodeType === 'comment') {
    return `${spaces}<!-- ${node.value ?? ''} -->`;
  }
  
  if (node.nodeType === 'cdata') {
    return `${spaces}<![CDATA[${node.value ?? ''}]]>`;
  }

  const attrString = Object.entries(node.attributes)
    .map(([key, value]) => `${key}="${escapeXMLAttr(value)}"`)
    .join(' ');

  const openTag = attrString 
    ? `<${node.name} ${attrString}>`
    : `<${node.name}>`;

  if (node.children.length === 0 && !node.value) {
    return `${spaces}${openTag.slice(0, -1)} />`;
  }

  if (node.children.length === 0 && node.value) {
    return `${spaces}${openTag}${escapeXML(node.value)}</${node.name}>`;
  }

  const childrenXML = node.children
    .map(child => serializeXML(child, indent + 1))
    .join('\n');

  if (node.value) {
    return `${spaces}${openTag}\n${spaces}  ${escapeXML(node.value)}\n${childrenXML}\n${spaces}</${node.name}>`;
  }

  return `${spaces}${openTag}\n${childrenXML}\n${spaces}</${node.name}>`;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXMLAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================
// XML Diff Implementation (Worker Version)
// ============================================

function diffXML(
  oldRoot: XMLNode | null,
  newRoot: XMLNode | null
): DiffResult[] {
  const results: DiffResult[] = [];

  if (!oldRoot && !newRoot) {
    return results;
  }

  if (!oldRoot && newRoot) {
    addAllNodes(newRoot, results, 'added');
    return results;
  }

  if (oldRoot && !newRoot) {
    addAllNodes(oldRoot, results, 'removed');
    return results;
  }

  compareNodes(oldRoot!, newRoot!, results, 0);

  return results;
}

function compareNodes(
  oldNode: XMLNode,
  newNode: XMLNode,
  results: DiffResult[],
  depth: number
): void {
  if (oldNode.name !== newNode.name) {
    addAllNodes(oldNode, results, 'removed');
    addAllNodes(newNode, results, 'added');
    return;
  }

  const attrChanges = compareAttributes(oldNode.attributes, newNode.attributes);
  const valueChanged = oldNode.value !== newNode.value;
  
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

  compareChildren(oldNode.children, newNode.children, results, depth + 1);
}

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
      changes.push({ name: key, type: 'added', oldValue: null, newValue: newVal });
    } else if (oldVal !== undefined && newVal === undefined) {
      changes.push({ name: key, type: 'removed', oldValue: oldVal, newValue: null });
    } else if (oldVal !== newVal) {
      changes.push({ name: key, type: 'modified', oldValue: oldVal, newValue: newVal });
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
  const oldByName = groupByName(oldChildren);
  const newByName = groupByName(newChildren);

  const processedOld = new Set<number>();
  const processedNew = new Set<number>();

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
        processedOld.add(oldIdx);
        processedNew.add(newIdx);
        compareNodes(oldChildren[oldIdx], newChildren[newIdx], results, depth);
        newByKey.delete(key);
      } else {
        processedOld.add(oldIdx);
        addAllNodes(oldChildren[oldIdx], results, 'removed');
      }
    }

    // Keys only in new - added
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

    for (let i = matchCount; i < oldWithoutKey.length; i++) {
      const oldIdx = oldWithoutKey[i];
      processedOld.add(oldIdx);
      addAllNodes(oldChildren[oldIdx], results, 'removed');
    }

    for (let i = matchCount; i < newWithoutKey.length; i++) {
      const newIdx = newWithoutKey[i];
      processedNew.add(newIdx);
      addAllNodes(newChildren[newIdx], results, 'added');
    }
  }

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
          name, type: 'added', oldValue: null, newValue: value,
        }))
      : Object.entries(node.attributes).map(([name, value]): AttributeChange => ({
          name, type: 'removed', oldValue: value, newValue: null,
        })),
    oldNode: type === 'removed' ? node : null,
    newNode: type === 'added' ? node : null,
    depth,
  });

  for (const child of node.children) {
    addAllNodes(child, results, type);
  }
}

function getDiffSummary(results: DiffResult[]): DiffSummary {
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

// ============================================
// Line Diff (Worker Version)
// ============================================

const DEFAULT_MAX_CELLS = 2_000_000;

function diffLines(
  oldLines: string[],
  newLines: string[],
  maxCells: number = DEFAULT_MAX_CELLS
): { ops: LineDiffOp[]; isCoarse: boolean } {
  const ops: LineDiffOp[] = [];

  let start = 0;
  let endA = oldLines.length - 1;
  let endB = newLines.length - 1;

  while (start <= endA && start <= endB && oldLines[start] === newLines[start]) {
    ops.push({ type: 'equal', line: oldLines[start] });
    start++;
  }

  while (endA >= start && endB >= start && oldLines[endA] === newLines[endB]) {
    endA--;
    endB--;
  }

  const midA = oldLines.slice(start, endA + 1);
  const midB = newLines.slice(start, endB + 1);
  let isCoarse = false;

  if (midA.length > 0 || midB.length > 0) {
    if (midA.length * midB.length > maxCells) {
      isCoarse = true;
      for (const line of midA) {
        ops.push({ type: 'delete', line });
      }
      for (const line of midB) {
        ops.push({ type: 'insert', line });
      }
    } else {
      ops.push(...diffLinesByLcs(midA, midB));
    }
  }

  for (let i = endA + 1; i < oldLines.length; i++) {
    ops.push({ type: 'equal', line: oldLines[i] });
  }

  return { ops, isCoarse };
}

function diffLinesByLcs(oldLines: string[], newLines: string[]): LineDiffOp[] {
  const ops: LineDiffOp[] = [];
  const lcs = computeLCS(oldLines, newLines);

  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx]) {
      if (newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
        ops.push({ type: 'equal', line: oldLines[oldIdx] });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else {
        ops.push({ type: 'insert', line: newLines[newIdx] });
        newIdx++;
      }
    } else if (lcsIdx < lcs.length && newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
      ops.push({ type: 'delete', line: oldLines[oldIdx] });
      oldIdx++;
    } else {
      if (oldIdx < oldLines.length) {
        ops.push({ type: 'delete', line: oldLines[oldIdx] });
        oldIdx++;
      }
      if (newIdx < newLines.length) {
        ops.push({ type: 'insert', line: newLines[newIdx] });
        newIdx++;
      }
    }
  }

  return ops;
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcs: string[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

function buildUnifiedDiffLines(ops: LineDiffOp[]): UnifiedDiffLine[] {
  const lines: UnifiedDiffLine[] = [];
  let oldLineNumber = 0;
  let newLineNumber = 0;

  for (const op of ops) {
    if (op.type === 'equal') {
      oldLineNumber++;
      newLineNumber++;
      lines.push({
        type: 'context',
        lineNumber: { old: oldLineNumber, new: newLineNumber },
        content: op.line,
      });
    } else if (op.type === 'delete') {
      oldLineNumber++;
      lines.push({
        type: 'removed',
        lineNumber: { old: oldLineNumber, new: null },
        content: op.line,
      });
    } else {
      newLineNumber++;
      lines.push({
        type: 'added',
        lineNumber: { old: null, new: newLineNumber },
        content: op.line,
      });
    }
  }

  return lines;
}

function computeInlineStats(ops: LineDiffOp[]): InlineLineStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const op of ops) {
    if (op.type === 'equal') {
      unchanged++;
    } else if (op.type === 'delete') {
      removed++;
    } else {
      added++;
    }
  }

  return { added, removed, unchanged, total: added + removed + unchanged };
}

function computeLineLevelStatsFromOps(ops: LineDiffOp[]): LineLevelStats {
  let added = 0;
  let removed = 0;
  let modified = 0;
  let unchanged = 0;
  let navigableCount = 0;

  let idx = 0;

  while (idx < ops.length) {
    if (ops[idx].type === 'equal') {
      unchanged++;
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

    const paired = Math.min(removedCount, addedCount);
    modified += paired;
    removed += removedCount - paired;
    added += addedCount - paired;
    navigableCount += Math.max(removedCount, addedCount);
  }

  return {
    added,
    removed,
    modified,
    unchanged,
    total: added + removed + modified + unchanged,
    navigableCount,
  };
}

// ============================================
// Worker Message Handler
// ============================================

self.onmessage = function(event: MessageEvent<WorkerRequest>) {
  const { id, type, payload } = event.data;

  try {
    switch (type) {
      case 'parse': {
        const { xml, strictMode } = payload as ParsePayload;
        const result = parseXML(xml, strictMode);
        self.postMessage({
          id,
          type: 'parse-result',
          payload: result,
        } as WorkerResponse);
        break;
      }

      case 'diff': {
        const { xmlA, xmlB, strictMode } = payload as DiffPayload;
        
        // Stage 1: Parse XML A (0-33%)
        self.postMessage({
          id,
          type: 'single-diff-progress',
          payload: {
            stage: 'parsing-a',
            progress: 0,
          } as SingleDiffProgressPayload,
        } as WorkerResponse);
        
        const parseA = parseXML(xmlA, strictMode);
        
        self.postMessage({
          id,
          type: 'single-diff-progress',
          payload: {
            stage: 'parsing-a',
            progress: 33,
          } as SingleDiffProgressPayload,
        } as WorkerResponse);
        
        // Stage 2: Parse XML B (33-66%)
        self.postMessage({
          id,
          type: 'single-diff-progress',
          payload: {
            stage: 'parsing-b',
            progress: 33,
          } as SingleDiffProgressPayload,
        } as WorkerResponse);
        
        const parseB = parseXML(xmlB, strictMode);
        
        self.postMessage({
          id,
          type: 'single-diff-progress',
          payload: {
            stage: 'parsing-b',
            progress: 66,
          } as SingleDiffProgressPayload,
        } as WorkerResponse);
        
        // Stage 3: Compute line diff (66-80%)
        self.postMessage({
          id,
          type: 'single-diff-progress',
          payload: {
            stage: 'computing-line-diff',
            progress: 66,
          } as SingleDiffProgressPayload,
        } as WorkerResponse);
        
        let lineDiffOps: LineDiffOp[] = [];
        let inlineLines: UnifiedDiffLine[] = [];
        let inlineStats: InlineLineStats = { added: 0, removed: 0, unchanged: 0, total: 0 };
        let sideBySideStats: LineLevelStats = { added: 0, removed: 0, modified: 0, unchanged: 0, total: 0, navigableCount: 0 };
        let inlineDiffCount = 0;
        let formattedXmlA = '';
        let formattedXmlB = '';
        let isCoarse = false;

        if (parseA.success && parseB.success && parseA.root && parseB.root) {
          formattedXmlA = prettyPrintXMLFromNode(parseA.root);
          formattedXmlB = prettyPrintXMLFromNode(parseB.root);

          const linesA = formattedXmlA.split('\n');
          const linesB = formattedXmlB.split('\n');
          const diffResult = diffLines(linesA, linesB);
          lineDiffOps = diffResult.ops;
          isCoarse = diffResult.isCoarse;
          inlineLines = buildUnifiedDiffLines(lineDiffOps);
          inlineStats = computeInlineStats(lineDiffOps);
          sideBySideStats = computeLineLevelStatsFromOps(lineDiffOps);
          inlineDiffCount = inlineStats.added + inlineStats.removed;
        } else {
          formattedXmlA = xmlA;
          formattedXmlB = xmlB;
        }

        self.postMessage({
          id,
          type: 'single-diff-progress',
          payload: {
            stage: 'computing-line-diff',
            progress: 80,
          } as SingleDiffProgressPayload,
        } as WorkerResponse);

        // Stage 4: Compute tree diff (80-99%)
        self.postMessage({
          id,
          type: 'single-diff-progress',
          payload: {
            stage: 'computing-diff',
            progress: 80,
          } as SingleDiffProgressPayload,
        } as WorkerResponse);
        
        const results = diffXML(parseA.root, parseB.root);
        const summary = getDiffSummary(results);
        
        self.postMessage({
          id,
          type: 'single-diff-progress',
          payload: {
            stage: 'computing-diff',
            progress: 99,
          } as SingleDiffProgressPayload,
        } as WorkerResponse);
        
        // Stage 4: Done (100%)
        self.postMessage({
          id,
          type: 'single-diff-progress',
          payload: {
            stage: 'done',
            progress: 100,
          } as SingleDiffProgressPayload,
        } as WorkerResponse);
        
        self.postMessage({
          id,
          type: 'diff-result',
          payload: {
            results,
            summary,
            parseA,
            parseB,
            lineDiff: {
              ops: lineDiffOps,
              inlineLines,
              inlineStats,
              sideBySideStats,
              inlineDiffCount,
              formattedXmlA,
              formattedXmlB,
              isCoarse,
            } as LineDiffPayload,
          } as DiffResultPayload,
        } as WorkerResponse);
        break;
      }

      case 'batch-diff': {
        const { files } = payload as BatchDiffPayload;
        const batchResults: BatchResultItem[] = [];
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          // Report progress
          self.postMessage({
            id,
            type: 'batch-progress',
            payload: {
              completed: i,
              total: files.length,
              currentFile: file.name,
            } as BatchProgressPayload,
          } as WorkerResponse);

          try {
            const parseA = parseXML(file.xmlA);
            const parseB = parseXML(file.xmlB);
            
            if (!parseA.success) {
              batchResults.push({
                id: file.id,
                name: file.name,
                success: false,
                error: `Parse error in File A: ${parseA.error}`,
              });
              continue;
            }
            
            if (!parseB.success) {
              batchResults.push({
                id: file.id,
                name: file.name,
                success: false,
                error: `Parse error in File B: ${parseB.error}`,
              });
              continue;
            }
            
            const results = diffXML(parseA.root, parseB.root);
            const summary = getDiffSummary(results);
            
            batchResults.push({
              id: file.id,
              name: file.name,
              success: true,
              results,
              summary,
            });
          } catch (error) {
            batchResults.push({
              id: file.id,
              name: file.name,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
        
        self.postMessage({
          id,
          type: 'batch-complete',
          payload: { results: batchResults } as BatchCompletePayload,
        } as WorkerResponse);
        break;
      }

      default:
        self.postMessage({
          id,
          type: 'error',
          payload: { message: `Unknown message type: ${type}` },
        } as WorkerResponse);
    }
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      payload: { 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
    } as WorkerResponse);
  }
};

