/**
 * Diff Report Generator
 * Generates downloadable diff reports in HTML and Text formats
 */

import type { DiffResult } from '../core/xml-diff';
import { getDiffSummary } from '../core/xml-diff';

/**
 * Generate and download a diff report
 */
export function generateDiffReport(
  diffResults: DiffResult[],
  xmlA: string,
  xmlB: string,
  format: 'html' | 'text'
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `xml-diff-${timestamp}.${format === 'html' ? 'html' : 'txt'}`;
  
  let content: string;
  let mimeType: string;
  
  if (format === 'html') {
    content = generateHtmlReport(diffResults, xmlA, xmlB);
    mimeType = 'text/html';
  } else {
    content = generateTextReport(diffResults, xmlA, xmlB);
    mimeType = 'text/plain';
  }
  
  // Create and trigger download
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate HTML report with styled diff view
 */
function generateHtmlReport(
  diffResults: DiffResult[],
  xmlA: string,
  xmlB: string
): string {
  const summary = getDiffSummary(diffResults);
  const timestamp = new Date().toLocaleString();
  
  const changedResults = diffResults.filter(r => r.type !== 'unchanged');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XML Diff Report - ${timestamp}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 2rem;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #f1f5f9; margin-bottom: 0.5rem; }
    .timestamp { color: #64748b; font-size: 0.875rem; margin-bottom: 2rem; }
    
    .summary {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    .stat {
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .stat-added { background: rgba(34,197,94,0.2); color: #4ade80; }
    .stat-removed { background: rgba(239,68,68,0.2); color: #f87171; }
    .stat-modified { background: rgba(234,179,8,0.2); color: #facc15; }
    .stat-unchanged { background: rgba(100,116,139,0.2); color: #94a3b8; }
    
    .diff-list { margin-top: 2rem; }
    .diff-item {
      background: #1e293b;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
      overflow: hidden;
    }
    .diff-header {
      padding: 0.75rem 1rem;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.875rem;
      border-bottom: 1px solid #334155;
    }
    .diff-header.added { background: rgba(34,197,94,0.15); color: #4ade80; }
    .diff-header.removed { background: rgba(239,68,68,0.15); color: #f87171; }
    .diff-header.modified { background: rgba(234,179,8,0.15); color: #facc15; }
    
    .diff-content {
      padding: 1rem;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.8125rem;
    }
    .diff-row { display: flex; gap: 1rem; margin-bottom: 0.5rem; }
    .diff-label { color: #64748b; min-width: 80px; }
    .diff-value { color: #e2e8f0; }
    .diff-value.old { color: #f87171; }
    .diff-value.new { color: #4ade80; }
    
    .xml-section {
      margin-top: 3rem;
      background: #1e293b;
      border-radius: 0.5rem;
      overflow: hidden;
    }
    .xml-section h2 {
      padding: 0.75rem 1rem;
      background: #334155;
      font-size: 0.875rem;
      color: #94a3b8;
    }
    .xml-content {
      padding: 1rem;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.75rem;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 400px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>XML Diff Report</h1>
    <p class="timestamp">Generated: ${timestamp}</p>
    
    <div class="summary">
      <div class="stat stat-added">+ Added: ${summary.added}</div>
      <div class="stat stat-removed">- Removed: ${summary.removed}</div>
      <div class="stat stat-modified">~ Modified: ${summary.modified}</div>
      <div class="stat stat-unchanged">= Unchanged: ${summary.unchanged}</div>
    </div>
    
    <div class="diff-list">
      <h2 style="color: #94a3b8; margin-bottom: 1rem;">Changes (${changedResults.length})</h2>
      ${changedResults.map(diff => `
        <div class="diff-item">
          <div class="diff-header ${diff.type}">
            <strong>${diff.type.toUpperCase()}</strong>: ${diff.path}
          </div>
          <div class="diff-content">
            ${diff.type === 'modified' ? `
              <div class="diff-row">
                <span class="diff-label">Old:</span>
                <span class="diff-value old">${escapeHtml(diff.oldValue || '')}</span>
              </div>
              <div class="diff-row">
                <span class="diff-label">New:</span>
                <span class="diff-value new">${escapeHtml(diff.newValue || '')}</span>
              </div>
            ` : diff.type === 'added' ? `
              <div class="diff-row">
                <span class="diff-label">Value:</span>
                <span class="diff-value new">${escapeHtml(diff.newValue || '(element)')}</span>
              </div>
            ` : `
              <div class="diff-row">
                <span class="diff-label">Value:</span>
                <span class="diff-value old">${escapeHtml(diff.oldValue || '(element)')}</span>
              </div>
            `}
            ${diff.attributeChanges.length > 0 ? `
              <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #334155;">
                <span class="diff-label">Attributes:</span>
                ${diff.attributeChanges.map(attr => `
                  <div class="diff-row" style="margin-left: 1rem;">
                    <span class="diff-label">${attr.name}:</span>
                    <span class="diff-value ${attr.type === 'added' ? 'new' : attr.type === 'removed' ? 'old' : ''}">${
                      attr.type === 'modified' 
                        ? `${escapeHtml(attr.oldValue || '')} → ${escapeHtml(attr.newValue || '')}`
                        : escapeHtml(attr.newValue || attr.oldValue || '')
                    }</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="xml-section">
      <h2>Original XML (A)</h2>
      <pre class="xml-content">${escapeHtml(xmlA)}</pre>
    </div>
    
    <div class="xml-section">
      <h2>New XML (B)</h2>
      <pre class="xml-content">${escapeHtml(xmlB)}</pre>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate plain text report
 */
function generateTextReport(
  diffResults: DiffResult[],
  xmlA: string,
  xmlB: string
): string {
  const summary = getDiffSummary(diffResults);
  const timestamp = new Date().toLocaleString();
  const separator = '='.repeat(60);
  const changedResults = diffResults.filter(r => r.type !== 'unchanged');
  
  let report = `XML DIFF REPORT
${separator}
Generated: ${timestamp}

SUMMARY
${'-'.repeat(30)}
+ Added:     ${summary.added}
- Removed:   ${summary.removed}
~ Modified:  ${summary.modified}
= Unchanged: ${summary.unchanged}
  Total:     ${summary.total}

CHANGES (${changedResults.length})
${separator}
`;

  for (const diff of changedResults) {
    const typeSymbol = diff.type === 'added' ? '+' : diff.type === 'removed' ? '-' : '~';
    report += `\n[${typeSymbol}] ${diff.type.toUpperCase()}: ${diff.path}\n`;
    
    if (diff.type === 'modified') {
      report += `    Old: ${diff.oldValue || '(empty)'}\n`;
      report += `    New: ${diff.newValue || '(empty)'}\n`;
    } else if (diff.type === 'added') {
      report += `    Value: ${diff.newValue || '(element)'}\n`;
    } else {
      report += `    Value: ${diff.oldValue || '(element)'}\n`;
    }
    
    if (diff.attributeChanges.length > 0) {
      report += `    Attribute changes:\n`;
      for (const attr of diff.attributeChanges) {
        if (attr.type === 'modified') {
          report += `      ${attr.name}: ${attr.oldValue} → ${attr.newValue}\n`;
        } else if (attr.type === 'added') {
          report += `      + ${attr.name}: ${attr.newValue}\n`;
        } else {
          report += `      - ${attr.name}: ${attr.oldValue}\n`;
        }
      }
    }
  }

  report += `

ORIGINAL XML (A)
${separator}
${xmlA}

NEW XML (B)
${separator}
${xmlB}
`;

  return report;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

