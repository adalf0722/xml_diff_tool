/**
 * XML Parser Module
 * Uses browser's DOMParser for reliable XML parsing
 */

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

export interface ParseOptions {
  strictMode?: boolean;
}

export interface ParseWarningSample {
  name: string;
  path: string;
  attributes: Record<string, string>;
  line?: number;
  column?: number;
  text?: string;
}

/**
 * Parse XML string into a normalized tree structure
 */
export function parseXML(xmlString: string, options: ParseOptions = {}): ParseResult {
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
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    
    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      const errorText = parserError.textContent || 'Invalid XML format';
      return {
        success: false,
        root: null,
        error: errorText,
        warnings: [],
        rawXML: xmlString,
      };
    }

    const root = convertDOMToXMLNode(doc.documentElement, '');
    const warnings = collectParseWarnings(root, xmlString);
    if (options.strictMode && warnings.length > 0) {
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

type WarningLocation = {
  path: string;
  line: number;
  column: number;
  text: string;
};

function collectParseWarnings(root: XMLNode, rawXML: string): ParseWarning[] {
  let mixedContentCount = 0;
  const samples: ParseWarningSample[] = [];
  const maxSamples = 8;
  const locationMap = collectMixedContentLocations(rawXML, maxSamples);

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
        const location = locationMap.get(node.path);
        samples.push({
          name: node.name,
          path: node.path,
          attributes: node.attributes,
          line: location?.line,
          column: location?.column,
          text: location?.text,
        });
      }
    }

    node.children.forEach(visit);
  };

  visit(root);

  if (mixedContentCount <= 0) return [];
  return [{ code: 'mixed-content', count: mixedContentCount, samples }];
}

function collectMixedContentLocations(rawXML: string, maxSamples: number) {
  const samples = new Map<string, WarningLocation>();
  if (!rawXML.trim()) return samples;

  const stack: Array<{ name: string; path: string; childCounts: Record<string, number> }> = [];
  let line = 1;
  let column = 1;
  let i = 0;

  const isWhitespace = (ch: string) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
  const advanceChar = (ch: string) => {
    if (ch === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  };

  while (i < rawXML.length) {
    const ch = rawXML[i];
    if (ch === '<') {
      if (rawXML.startsWith('<!--', i)) {
        for (let j = 0; j < 4 && i < rawXML.length; j += 1) {
          advanceChar(rawXML[i]);
          i += 1;
        }
        while (i < rawXML.length && !rawXML.startsWith('-->', i)) {
          advanceChar(rawXML[i]);
          i += 1;
        }
        for (let j = 0; j < 3 && i < rawXML.length; j += 1) {
          advanceChar(rawXML[i]);
          i += 1;
        }
        continue;
      }
      if (rawXML.startsWith('<![CDATA[', i)) {
        for (let j = 0; j < 9 && i < rawXML.length; j += 1) {
          advanceChar(rawXML[i]);
          i += 1;
        }
        while (i < rawXML.length && !rawXML.startsWith(']]>', i)) {
          advanceChar(rawXML[i]);
          i += 1;
        }
        for (let j = 0; j < 3 && i < rawXML.length; j += 1) {
          advanceChar(rawXML[i]);
          i += 1;
        }
        continue;
      }
      if (rawXML.startsWith('<?', i)) {
        for (let j = 0; j < 2 && i < rawXML.length; j += 1) {
          advanceChar(rawXML[i]);
          i += 1;
        }
        while (i < rawXML.length && !rawXML.startsWith('?>', i)) {
          advanceChar(rawXML[i]);
          i += 1;
        }
        for (let j = 0; j < 2 && i < rawXML.length; j += 1) {
          advanceChar(rawXML[i]);
          i += 1;
        }
        continue;
      }
      if (rawXML.startsWith('<!DOCTYPE', i)) {
        for (let j = 0; j < 9 && i < rawXML.length; j += 1) {
          advanceChar(rawXML[i]);
          i += 1;
        }
        while (i < rawXML.length && rawXML[i] !== '>') {
          advanceChar(rawXML[i]);
          i += 1;
        }
        if (i < rawXML.length && rawXML[i] === '>') {
          advanceChar(rawXML[i]);
          i += 1;
        }
        continue;
      }

      let token = '';
      let inQuote: string | null = null;
      while (i < rawXML.length) {
        const current = rawXML[i];
        token += current;
        if (inQuote) {
          if (current === inQuote) {
            inQuote = null;
          }
        } else if (current === '"' || current === "'") {
          inQuote = current;
        } else if (current === '>') {
          advanceChar(current);
          i += 1;
          break;
        }
        advanceChar(current);
        i += 1;
      }

      const tagInfo = extractWarningTagInfo(token);
      if (!tagInfo) continue;

      if (tagInfo.type === 'open' || tagInfo.type === 'self') {
        const parentEntry = stack[stack.length - 1];
        const counts = parentEntry?.childCounts;
        const index = counts ? (counts[tagInfo.name] ?? 0) : 0;
        if (counts) counts[tagInfo.name] = index + 1;
        const suffix = index > 0 ? `[${index}]` : '';
        const parentPath = parentEntry?.path ?? '';
        const path = parentPath ? `${parentPath}/${tagInfo.name}${suffix}` : `/${tagInfo.name}${suffix}`;
        if (tagInfo.type === 'open') {
          stack.push({ name: tagInfo.name, path, childCounts: {} });
        }
        continue;
      }

      const matchIndex = [...stack].reverse().findIndex(entry => entry.name === tagInfo.name);
      if (matchIndex === -1) continue;
      const stackIndex = stack.length - 1 - matchIndex;
      stack.splice(stackIndex, stack.length - stackIndex);
      continue;
    }

    let textBuffer = '';
    let firstHit: { line: number; column: number; index: number } | null = null;
    while (i < rawXML.length && rawXML[i] !== '<') {
      const current = rawXML[i];
      textBuffer += current;
      if (!firstHit && !isWhitespace(current)) {
        firstHit = { line, column, index: textBuffer.length - 1 };
      }
      advanceChar(current);
      i += 1;
    }

    if (firstHit && stack.length > 0 && samples.size < maxSamples) {
      const currentNode = stack[stack.length - 1];
      if (!samples.has(currentNode.path)) {
        const remainder = textBuffer.slice(firstHit.index);
        const match = remainder.match(/^\S+/);
        const snippet = match ? match[0] : remainder.trim();
        samples.set(currentNode.path, {
          path: currentNode.path,
          line: firstHit.line,
          column: firstHit.column,
          text: snippet.slice(0, 48),
        });
      }
    }
  }

  return samples;
}

function extractWarningTagInfo(token: string) {
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

/**
 * Convert DOM Element to XMLNode structure
 */
function convertDOMToXMLNode(
  element: Element,
  parentPath: string,
  siblingIndex?: number
): XMLNode {
  const name = element.tagName;
  const indexSuffix = siblingIndex !== undefined && siblingIndex > 0 ? `[${siblingIndex}]` : '';
  const currentPath = parentPath ? `${parentPath}/${name}${indexSuffix}` : `/${name}`;

  // Extract attributes
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    attributes[attr.name] = attr.value;
  }

  // Get text content (direct text nodes only, not from children)
  let value: string | null = null;
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (text) {
        value = text;
        break;
      }
    }
  }

  const node: XMLNode = {
    name,
    path: currentPath,
    attributes,
    value,
    children: [],
    nodeType: 'element',
  };

  // Process child elements
  const childElements = Array.from(element.children);
  const childNameCounts: Record<string, number> = {};
  
  // First pass: count occurrences of each child name
  for (const child of childElements) {
    const childName = child.tagName;
    childNameCounts[childName] = (childNameCounts[childName] || 0) + 1;
  }

  // Second pass: build child nodes with proper indexing
  const childNameIndices: Record<string, number> = {};
  for (const child of childElements) {
    const childName = child.tagName;
    const currentIndex = childNameIndices[childName] || 0;
    childNameIndices[childName] = currentIndex + 1;
    
    // Only add index suffix if there are multiple children with same name
    const needsIndex = childNameCounts[childName] > 1;
    const childNode = convertDOMToXMLNode(
      child,
      currentPath,
      needsIndex ? currentIndex : undefined
    );
    node.children.push(childNode);
  }

  // Handle comment nodes
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) {
      node.children.push({
        name: '#comment',
        path: `${currentPath}/#comment`,
        attributes: {},
        value: child.textContent,
        children: [],
        nodeType: 'comment',
      });
    } else if (child.nodeType === Node.CDATA_SECTION_NODE) {
      node.children.push({
        name: '#cdata',
        path: `${currentPath}/#cdata`,
        attributes: {},
        value: child.textContent,
        children: [],
        nodeType: 'cdata',
      });
    }
  }

  return node;
}

/**
 * Serialize XMLNode back to XML string
 */
export function serializeXML(node: XMLNode, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  
  if (node.nodeType === 'comment') {
    return `${spaces}<!-- ${node.value} -->`;
  }
  
  if (node.nodeType === 'cdata') {
    return `${spaces}<![CDATA[${node.value}]]>`;
  }

  // Build attributes string
  const attrString = Object.entries(node.attributes)
    .map(([key, value]) => `${key}="${escapeXMLAttr(value)}"`)
    .join(' ');

  const openTag = attrString 
    ? `<${node.name} ${attrString}>`
    : `<${node.name}>`;

  // No children and no value - self closing
  if (node.children.length === 0 && !node.value) {
    return `${spaces}${openTag.slice(0, -1)} />`;
  }

  // Only value, no children
  if (node.children.length === 0 && node.value) {
    return `${spaces}${openTag}${escapeXML(node.value)}</${node.name}>`;
  }

  // Has children
  const childrenXML = node.children
    .map(child => serializeXML(child, indent + 1))
    .join('\n');

  if (node.value) {
    return `${spaces}${openTag}\n${spaces}  ${escapeXML(node.value)}\n${childrenXML}\n${spaces}</${node.name}>`;
  }

  return `${spaces}${openTag}\n${childrenXML}\n${spaces}</${node.name}>`;
}

/**
 * Escape special XML characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape special XML attribute characters
 */
function escapeXMLAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get a flat list of all nodes for comparison
 */
export function flattenXMLTree(node: XMLNode | null, result: XMLNode[] = []): XMLNode[] {
  if (!node) return result;
  
  result.push(node);
  for (const child of node.children) {
    flattenXMLTree(child, result);
  }
  
  return result;
}

/**
 * Find a node by path
 */
export function findNodeByPath(root: XMLNode | null, path: string): XMLNode | null {
  if (!root) return null;
  if (root.path === path) return root;
  
  for (const child of root.children) {
    const found = findNodeByPath(child, path);
    if (found) return found;
  }
  
  return null;
}
