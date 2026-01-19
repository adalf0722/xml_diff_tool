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
    const warnings = collectParseWarnings(root);
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
