/**
 * XML Pretty Print Utilities
 * Format and beautify XML for display
 */

/**
 * Pretty print XML string with proper indentation
 */
export function prettyPrintXML(xmlString: string, indentSize: number = 2): string {
  if (!xmlString || xmlString.trim() === '') {
    return '';
  }

  try {
    // Parse the XML
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    
    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      // Return original if parsing fails
      return xmlString;
    }

    // Serialize with formatting
    return formatNode(doc.documentElement, 0, indentSize);
  } catch {
    return xmlString;
  }
}

/**
 * Format a DOM node recursively
 */
function formatNode(node: Element, depth: number, indentSize: number): string {
  const indent = ' '.repeat(depth * indentSize);
  const childIndent = ' '.repeat((depth + 1) * indentSize);
  
  // Build opening tag
  let result = `${indent}<${node.tagName}`;
  
  // Add attributes
  for (const attr of Array.from(node.attributes)) {
    result += ` ${attr.name}="${escapeAttr(attr.value)}"`;
  }

  // Get child nodes
  const childNodes = Array.from(node.childNodes);
  const elementChildren = childNodes.filter(n => n.nodeType === Node.ELEMENT_NODE) as Element[];
  const textContent = childNodes
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => n.textContent?.trim() || '')
    .join('')
    .trim();
  const commentChildren = childNodes.filter(n => n.nodeType === Node.COMMENT_NODE);
  const cdataChildren = childNodes.filter(n => n.nodeType === Node.CDATA_SECTION_NODE);

  // Self-closing if no content
  if (elementChildren.length === 0 && !textContent && commentChildren.length === 0 && cdataChildren.length === 0) {
    return `${result} />`;
  }

  result += '>';

  // Text only content
  if (elementChildren.length === 0 && commentChildren.length === 0 && cdataChildren.length === 0 && textContent) {
    return `${result}${escapeText(textContent)}</${node.tagName}>`;
  }

  result += '\n';

  // Add comments
  for (const comment of commentChildren) {
    result += `${childIndent}<!-- ${comment.textContent?.trim() || ''} -->\n`;
  }

  // Add CDATA
  for (const cdata of cdataChildren) {
    result += `${childIndent}<![CDATA[${cdata.textContent || ''}]]>\n`;
  }

  // Add text content if mixed
  if (textContent && elementChildren.length > 0) {
    result += `${childIndent}${escapeText(textContent)}\n`;
  }

  // Add element children
  for (const child of elementChildren) {
    result += formatNode(child, depth + 1, indentSize) + '\n';
  }

  result += `${indent}</${node.tagName}>`;

  return result;
}

/**
 * Escape special characters in XML text content
 */
function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape special characters in XML attributes
 */
function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Minify XML by removing whitespace between tags
 */
export function minifyXML(xmlString: string): string {
  if (!xmlString || xmlString.trim() === '') {
    return '';
  }

  return xmlString
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Add syntax highlighting spans for XML display
 */
export function highlightXML(xmlString: string): string {
  if (!xmlString) return '';

  return xmlString
    // Comments
    .replace(
      /(&lt;!--[\s\S]*?--&gt;|<!--[\s\S]*?-->)/g,
      '<span class="xml-comment">$1</span>'
    )
    // CDATA
    .replace(
      /(&lt;!\[CDATA\[[\s\S]*?\]\]&gt;|<!\[CDATA\[[\s\S]*?\]\]>)/g,
      '<span class="xml-cdata">$1</span>'
    )
    // Tags
    .replace(
      /(&lt;\/?|<\/?)([\w:.-]+)/g,
      '$1<span class="xml-tag">$2</span>'
    )
    // Attributes
    .replace(
      /\s([\w:.-]+)(\s*=\s*)/g,
      ' <span class="xml-attr-name">$1</span>$2'
    )
    // Attribute values
    .replace(
      /=\s*(&quot;[^&]*&quot;|"[^"]*")/g,
      '=<span class="xml-attr-value">$1</span>'
    );
}

/**
 * Convert XML string to lines with line numbers
 */
export interface XMLLine {
  lineNumber: number;
  content: string;
  indentLevel: number;
}

export function xmlToLines(xmlString: string): XMLLine[] {
  const lines = xmlString.split('\n');
  return lines.map((content, index) => {
    const trimmed = content.trimStart();
    const indentLevel = Math.floor((content.length - trimmed.length) / 2);
    return {
      lineNumber: index + 1,
      content,
      indentLevel,
    };
  });
}

/**
 * Count lines in XML string
 */
export function countLines(xmlString: string): number {
  if (!xmlString) return 0;
  return xmlString.split('\n').length;
}

/**
 * Get XML declaration if present
 */
export function getXMLDeclaration(xmlString: string): string | null {
  const match = xmlString.match(/^<\?xml[^?]*\?>/);
  return match ? match[0] : null;
}

/**
 * Remove XML declaration
 */
export function removeXMLDeclaration(xmlString: string): string {
  return xmlString.replace(/^<\?xml[^?]*\?>\s*/, '');
}

/**
 * Validate XML and return error if invalid
 */
export function validateXML(xmlString: string): { valid: boolean; error: string | null } {
  if (!xmlString || xmlString.trim() === '') {
    return { valid: false, error: 'XML 内容为空' };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      const errorText = parserError.textContent || '无效的 XML 格式';
      return { valid: false, error: errorText };
    }

    return { valid: true, error: null };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'XML 解析失败' 
    };
  }
}


