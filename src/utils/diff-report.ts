/**
 * Diff Report Generator
 * Generates downloadable diff reports in HTML and Text formats
 */

import type { DiffResult } from '../core/xml-diff';
import type { SchemaDiffResult } from '../core/schema-diff';
import { generateLineDiff, getDiffSummary } from '../core/xml-diff';
import { prettyPrintXML } from './pretty-print';
import { diffLines } from './line-diff';

export type DiffReportType = 'side' | 'inline' | 'node' | 'schema';
export type DiffReportFormat = 'html' | 'text';

export interface DiffReportSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  total: number;
}

interface DiffReportOptions {
  diffResults: DiffResult[];
  reportType: DiffReportType;
  format: DiffReportFormat;
  xmlA?: string;
  xmlB?: string;
  summaryOverride?: DiffReportSummary;
  schemaDiff?: SchemaDiffResult;
}

/**
 * Generate and download a diff report
 */
export function generateDiffReport({
  diffResults,
  reportType,
  format,
  xmlA,
  xmlB,
  summaryOverride,
  schemaDiff,
}: DiffReportOptions) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const typeLabel =
    reportType === 'side'
      ? 'side'
      : reportType === 'inline'
        ? 'inline'
        : reportType === 'node'
          ? 'nodes'
          : 'schema';
  const filename = `xml-diff-${typeLabel}-${timestamp}.${format === 'html' ? 'html' : 'txt'}`;

  let content: string;
  let mimeType: string;

  if (format === 'html') {
    content = generateHtmlReport(diffResults, reportType, xmlA, xmlB, summaryOverride, schemaDiff);
    mimeType = 'text/html';
  } else {
    content = generateTextReport(diffResults, reportType, xmlA, xmlB, summaryOverride, schemaDiff);
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
  reportType: DiffReportType,
  xmlA?: string,
  xmlB?: string,
  summaryOverride?: DiffReportSummary,
  schemaDiff?: SchemaDiffResult
): string {
  if (reportType === 'side') {
    return generateSideHtmlReport(xmlA, xmlB);
  }
  if (reportType === 'inline') {
    return generateInlineHtmlReport(xmlA, xmlB);
  }
  if (reportType === 'schema') {
    return generateSchemaHtmlReport(schemaDiff);
  }
  return generateNodeHtmlReport(diffResults, summaryOverride);
}

function buildInlineSummary(lines: ReturnType<typeof generateLineDiff>): DiffReportSummary {
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const line of lines) {
    if (line.type === 'added') added += 1;
    else if (line.type === 'removed') removed += 1;
    else if (line.type === 'context') unchanged += 1;
  }

  return {
    added,
    removed,
    modified: 0,
    unchanged,
    total: added + removed + unchanged,
  };
}

interface SideBySideEntry {
  type: 'added' | 'removed' | 'modified';
  oldLine: number | null;
  newLine: number | null;
  oldContent: string | null;
  newContent: string | null;
}

function buildSideBySideEntries(xmlA?: string, xmlB?: string): {
  entries: SideBySideEntry[];
  summary: DiffReportSummary;
} {
  const formattedA = prettyPrintXML(xmlA ?? '');
  const formattedB = prettyPrintXML(xmlB ?? '');
  const ops = diffLines(formattedA.split('\n'), formattedB.split('\n')).ops;

  let added = 0;
  let removed = 0;
  let modified = 0;
  let unchanged = 0;
  let oldLine = 0;
  let newLine = 0;
  const entries: SideBySideEntry[] = [];

  let idx = 0;
  while (idx < ops.length) {
    if (ops[idx].type === 'equal') {
      unchanged += 1;
      oldLine += 1;
      newLine += 1;
      idx += 1;
      continue;
    }

    const removedLines: Array<{ line: number; content: string }> = [];
    const addedLines: Array<{ line: number; content: string }> = [];

    while (idx < ops.length && ops[idx].type !== 'equal') {
      const op = ops[idx];
      if (op.type === 'delete') {
        oldLine += 1;
        removedLines.push({ line: oldLine, content: op.line });
      } else {
        newLine += 1;
        addedLines.push({ line: newLine, content: op.line });
      }
      idx += 1;
    }

    const pairCount = Math.max(removedLines.length, addedLines.length);
    for (let i = 0; i < pairCount; i += 1) {
      const removedLine = removedLines[i];
      const addedLine = addedLines[i];
      if (removedLine && addedLine) {
        modified += 1;
        entries.push({
          type: 'modified',
          oldLine: removedLine.line,
          newLine: addedLine.line,
          oldContent: removedLine.content,
          newContent: addedLine.content,
        });
      } else if (removedLine) {
        removed += 1;
        entries.push({
          type: 'removed',
          oldLine: removedLine.line,
          newLine: null,
          oldContent: removedLine.content,
          newContent: null,
        });
      } else if (addedLine) {
        added += 1;
        entries.push({
          type: 'added',
          oldLine: null,
          newLine: addedLine.line,
          oldContent: null,
          newContent: addedLine.content,
        });
      }
    }
  }

  return {
    entries,
    summary: {
      added,
      removed,
      modified,
      unchanged,
      total: added + removed + modified + unchanged,
    },
  };
}

function generateInlineHtmlReport(xmlA?: string, xmlB?: string): string {
  const timestamp = new Date().toLocaleString();
  const oldXml = xmlA ?? '';
  const newXml = xmlB ?? '';
  const formattedA = prettyPrintXML(oldXml);
  const formattedB = prettyPrintXML(newXml);
  const allLines = generateLineDiff(formattedA, formattedB);
  const summary = buildInlineSummary(allLines);
  const diffLines = allLines.filter(line => line.type !== 'context');

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
      display: grid;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .summary-block {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.75rem;
      padding: 1rem;
    }
    .summary-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
      margin-bottom: 0.5rem;
    }
    .summary-row {
      display: flex;
      gap: 0.75rem;
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
      margin-bottom: 0.75rem;
      padding: 0.75rem 1rem;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.8125rem;
    }
    .diff-item.added { border-left: 3px solid #4ade80; }
    .diff-item.removed { border-left: 3px solid #f87171; }
    .diff-meta { color: #94a3b8; margin-bottom: 0.25rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>XML Diff Inline Summary</h1>
    <p class="timestamp">Generated: ${timestamp}</p>
    <div class="summary">
      <div class="stat stat-added">+ Added: ${summary.added}</div>
      <div class="stat stat-removed">- Removed: ${summary.removed}</div>
      <div class="stat stat-modified">~ Modified: ${summary.modified}</div>
      <div class="stat stat-unchanged">= Unchanged: ${summary.unchanged}</div>
    </div>
    <div class="diff-list">
      <h2 style="color: #94a3b8; margin-bottom: 1rem;">Line Changes (${diffLines.length})</h2>
      ${diffLines.map(line => `
        <div class="diff-item ${line.type}">
          <div class="diff-meta">
            ${line.type.toUpperCase()} | old: ${line.lineNumber.old ?? '-'} | new: ${line.lineNumber.new ?? '-'}
          </div>
          <div>${escapeHtml(line.content)}</div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;
}

function generateSideHtmlReport(xmlA?: string, xmlB?: string): string {
  const timestamp = new Date().toLocaleString();
  const { entries, summary } = buildSideBySideEntries(xmlA, xmlB);

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
    .diff-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 1rem;
      margin-bottom: 0.75rem;
    }
    .diff-cell {
      background: #1e293b;
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.8125rem;
      border-left: 3px solid transparent;
    }
    .diff-cell.added { border-color: #4ade80; }
    .diff-cell.removed { border-color: #f87171; }
    .diff-cell.modified { border-color: #facc15; }
    .diff-meta { color: #94a3b8; margin-bottom: 0.25rem; }
    .diff-empty { color: #64748b; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <h1>XML Diff Side-by-Side Summary</h1>
    <p class="timestamp">Generated: ${timestamp}</p>
    <div class="summary">
      <div class="stat stat-added">+ Added: ${summary.added}</div>
      <div class="stat stat-removed">- Removed: ${summary.removed}</div>
      <div class="stat stat-modified">~ Modified: ${summary.modified}</div>
      <div class="stat stat-unchanged">= Unchanged: ${summary.unchanged}</div>
    </div>
    <div class="diff-list">
      <h2 style="color: #94a3b8; margin-bottom: 1rem;">Paired Changes (${entries.length})</h2>
      ${entries.map(entry => `
        <div class="diff-row">
          <div class="diff-cell ${entry.type}">
            <div class="diff-meta">A | line: ${entry.oldLine ?? '-'}</div>
            <div>${entry.oldContent ? escapeHtml(entry.oldContent) : '<span class="diff-empty">(empty)</span>'}</div>
          </div>
          <div class="diff-cell ${entry.type}">
            <div class="diff-meta">B | line: ${entry.newLine ?? '-'}</div>
            <div>${entry.newContent ? escapeHtml(entry.newContent) : '<span class="diff-empty">(empty)</span>'}</div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;
}

function generateNodeHtmlReport(
  diffResults: DiffResult[],
  summaryOverride?: DiffReportSummary
): string {
  const summary = summaryOverride ?? getDiffSummary(diffResults);
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
  </style>
</head>
<body>
  <div class="container">
    <h1>XML Diff Node Summary</h1>
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
                        ? `${escapeHtml(attr.oldValue || '')} ??${escapeHtml(attr.newValue || '')}`
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
  </div>
</body>
</html>`;
}

interface SchemaReportSummary {
  table: { added: number; removed: number; modified: number };
  field: { added: number; removed: number; modified: number };
}

function buildSchemaReportSummary(schemaDiff?: SchemaDiffResult): SchemaReportSummary {
  const summary: SchemaReportSummary = {
    table: { added: 0, removed: 0, modified: 0 },
    field: { added: 0, removed: 0, modified: 0 },
  };
  if (!schemaDiff) return summary;

  const addedTables = new Set<string>();
  const removedTables = new Set<string>();
  const modifiedTables = new Set<string>();

  schemaDiff.items.forEach(item => {
    if (item.kind !== 'table') return;
    if (item.type === 'added') addedTables.add(item.table);
    else if (item.type === 'removed') removedTables.add(item.table);
  });

  schemaDiff.items.forEach(item => {
    if (item.kind !== 'field') return;
    if (addedTables.has(item.table) || removedTables.has(item.table)) return;
    if (item.type === 'added' || item.type === 'removed' || item.type === 'modified') {
      modifiedTables.add(item.table);
    }
  });

  summary.table.added = addedTables.size;
  summary.table.removed = removedTables.size;
  summary.table.modified = modifiedTables.size;
  summary.field.added = schemaDiff.stats.fieldAdded;
  summary.field.removed = schemaDiff.stats.fieldRemoved;
  summary.field.modified = schemaDiff.stats.fieldModified;
  return summary;
}

function generateSchemaHtmlReport(schemaDiff?: SchemaDiffResult): string {
  const summary = buildSchemaReportSummary(schemaDiff);
  const timestamp = new Date().toLocaleString();
  const items = schemaDiff?.items ?? [];
  const grouped = new Map<string, SchemaDiffResult['items']>();
  for (const item of items) {
    if (!grouped.has(item.table)) grouped.set(item.table, []);
    grouped.get(item.table)!.push(item);
  }
  const tables = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));

  const tableSections = tables.map(table => {
    const tableItems = grouped.get(table) ?? [];
    const itemBlocks = tableItems.map(item => {
      const typeLabel = item.type.toUpperCase();
      const kindLabel = item.kind === 'table' ? 'Table' : 'Field';
      const title = item.kind === 'table' ? item.table : item.field ?? '';
      const fieldMeta =
        item.kind === 'table' && item.fieldCount !== undefined
          ? `<div class="meta">Fields: ${item.fieldCount}</div>`
          : item.kind === 'field'
            ? `<div class="meta">Table: ${escapeHtml(item.table)}</div>`
            : '';
      const attrList = item.kind === 'field' && item.fieldDef
        ? [
            { key: 'type', value: item.fieldDef.type },
            { key: 'size', value: item.fieldDef.size },
            { key: 'defaultvalue', value: item.fieldDef.defaultvalue },
          ]
            .map(attr => {
              if (!attr.value) return '';
              return `<span class="attr-chip">${attr.key}: ${escapeHtml(attr.value)}</span>`;
            })
            .filter(Boolean)
            .join('')
        : '';
      const changeRows = item.kind === 'field' && item.changes
        ? item.changes
            .map(change => {
              const oldValue = escapeHtml(change.oldValue || '-');
              const newValue = escapeHtml(change.newValue || '-');
              return `
                <div class="change-row">
                  <span class="change-key">${change.key}</span>
                  <span class="change-old">${oldValue}</span>
                  <span class="change-arrow">-></span>
                  <span class="change-new">${newValue}</span>
                </div>
              `;
            })
            .join('')
        : '';
      const detailSection = changeRows
        ? `<div class="change-list">${changeRows}</div>`
        : attrList
          ? `<div class="attr-list">${attrList}</div>`
          : '';

      return `
        <div class="schema-item ${item.type}">
          <div class="schema-header">
            <span class="schema-type">${typeLabel}</span>
            <span class="schema-kind">${kindLabel}</span>
            <span class="schema-name">${escapeHtml(title)}</span>
          </div>
          ${fieldMeta}
          ${detailSection}
        </div>
      `;
    }).join('');

    return `
      <div class="table-group">
        <div class="table-title">Table: ${escapeHtml(table)}</div>
        <div class="schema-list">
          ${itemBlocks || '<div class="empty">No changes in this table.</div>'}
        </div>
      </div>
    `;
  }).join('');

  const contentSection = items.length === 0
    ? `<p class="empty">No schema differences.</p>`
    : tableSections;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XML Diff Schema Report - ${timestamp}</title>
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

    .table-group { margin-bottom: 2rem; }
    .table-title {
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 0.75rem;
      font-size: 1rem;
    }
    .schema-list { display: grid; gap: 0.75rem; }
    .schema-item {
      background: #1e293b;
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      border-left: 3px solid transparent;
    }
    .schema-item.added { border-color: #4ade80; }
    .schema-item.removed { border-color: #f87171; }
    .schema-item.modified { border-color: #facc15; }
    .schema-header {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: baseline;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.85rem;
      margin-bottom: 0.25rem;
    }
    .schema-type { color: #94a3b8; font-weight: 600; }
    .schema-kind { color: #64748b; text-transform: uppercase; font-size: 0.7rem; }
    .schema-name { color: #f1f5f9; font-weight: 600; }
    .meta { color: #94a3b8; font-size: 0.75rem; margin-bottom: 0.5rem; }
    .attr-list, .change-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .attr-chip {
      background: rgba(148,163,184,0.2);
      color: #cbd5f5;
      border-radius: 999px;
      padding: 0.25rem 0.6rem;
      font-size: 0.7rem;
    }
    .change-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(30,41,59,0.8);
      border-radius: 0.5rem;
      padding: 0.3rem 0.6rem;
      font-size: 0.7rem;
      border: 1px solid rgba(148,163,184,0.2);
    }
    .change-key { color: #cbd5e1; text-transform: uppercase; font-size: 0.65rem; }
    .change-old { color: #f87171; font-weight: 600; }
    .change-new { color: #4ade80; font-weight: 600; }
    .change-arrow { color: #94a3b8; }
    .empty { color: #94a3b8; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <h1>XML Diff Schema Summary</h1>
    <p class="timestamp">Generated: ${timestamp}</p>
    <div class="summary">
      <div class="summary-block">
        <div class="summary-title">Table Summary</div>
        <div class="summary-row">
          <div class="stat stat-added">+ Added tables: ${summary.table.added}</div>
          <div class="stat stat-removed">- Removed tables: ${summary.table.removed}</div>
          <div class="stat stat-modified">~ Modified tables: ${summary.table.modified}</div>
        </div>
      </div>
      <div class="summary-block">
        <div class="summary-title">Field Summary</div>
        <div class="summary-row">
          <div class="stat stat-added">+ Added fields: ${summary.field.added}</div>
          <div class="stat stat-removed">- Removed fields: ${summary.field.removed}</div>
          <div class="stat stat-modified">~ Modified fields: ${summary.field.modified}</div>
        </div>
      </div>
    </div>
    ${contentSection}
  </div>
</body>
</html>`;
}

/**
 * Generate plain text report
 */
function generateTextReport(
  diffResults: DiffResult[],
  reportType: DiffReportType,
  xmlA?: string,
  xmlB?: string,
  summaryOverride?: DiffReportSummary,
  schemaDiff?: SchemaDiffResult
): string {
  if (reportType === 'side') {
    return generateSideTextReport(xmlA, xmlB);
  }
  if (reportType === 'inline') {
    return generateInlineTextReport(xmlA, xmlB);
  }
  if (reportType === 'schema') {
    return generateSchemaTextReport(schemaDiff);
  }
  return generateNodeTextReport(diffResults, summaryOverride);
}

function generateInlineTextReport(xmlA?: string, xmlB?: string): string {
  const timestamp = new Date().toLocaleString();
  const separator = '='.repeat(60);
  const formattedA = prettyPrintXML(xmlA ?? '');
  const formattedB = prettyPrintXML(xmlB ?? '');
  const allLines = generateLineDiff(formattedA, formattedB);
  const summary = buildInlineSummary(allLines);
  const diffLines = allLines.filter(line => line.type !== 'context');

  let report = `XML DIFF INLINE REPORT
${separator}
Generated: ${timestamp}

SUMMARY
${'-'.repeat(30)}
+ Added:     ${summary.added}
- Removed:   ${summary.removed}
~ Modified:  ${summary.modified}
= Unchanged: ${summary.unchanged}
  Total:     ${summary.total}

LINE CHANGES (${diffLines.length})
${separator}
`;

  for (const line of diffLines) {
    const typeSymbol = line.type === 'added' ? '+' : '-';
    const oldLine = line.lineNumber.old ?? '-';
    const newLine = line.lineNumber.new ?? '-';
    report += `[${typeSymbol}] old:${oldLine} new:${newLine} ${line.content}\n`;
  }

  return report;
}

function generateSideTextReport(xmlA?: string, xmlB?: string): string {
  const timestamp = new Date().toLocaleString();
  const separator = '='.repeat(60);
  const { entries, summary } = buildSideBySideEntries(xmlA, xmlB);

  let report = `XML DIFF SIDE-BY-SIDE REPORT
${separator}
Generated: ${timestamp}

SUMMARY
${'-'.repeat(30)}
+ Added:     ${summary.added}
- Removed:   ${summary.removed}
~ Modified:  ${summary.modified}
= Unchanged: ${summary.unchanged}
  Total:     ${summary.total}

PAIRED CHANGES (${entries.length})
${separator}
`;

  for (const entry of entries) {
    const typeSymbol = entry.type === 'added' ? '+' : entry.type === 'removed' ? '-' : '~';
    report += `[${typeSymbol}] A:${entry.oldLine ?? '-'} B:${entry.newLine ?? '-'}\n`;
    if (entry.oldContent) {
      report += `    A: ${entry.oldContent}\n`;
    } else {
      report += `    A: (empty)\n`;
    }
    if (entry.newContent) {
      report += `    B: ${entry.newContent}\n`;
    } else {
      report += `    B: (empty)\n`;
    }
  }

  return report;
}

function generateNodeTextReport(
  diffResults: DiffResult[],
  summaryOverride?: DiffReportSummary
): string {
  const summary = summaryOverride ?? getDiffSummary(diffResults);
  const timestamp = new Date().toLocaleString();
  const separator = '='.repeat(60);
  const changedResults = diffResults.filter(r => r.type !== 'unchanged');

  let report = `XML DIFF NODE REPORT
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
          report += `      ${attr.name}: ${attr.oldValue} ??${attr.newValue}\n`;
        } else if (attr.type === 'added') {
          report += `      + ${attr.name}: ${attr.newValue}\n`;
        } else {
          report += `      - ${attr.name}: ${attr.oldValue}\n`;
        }
      }
    }
  }

  return report;
}

function generateSchemaTextReport(schemaDiff?: SchemaDiffResult): string {
  const summary = buildSchemaReportSummary(schemaDiff);
  const timestamp = new Date().toLocaleString();
  const separator = '='.repeat(60);
  const items = schemaDiff?.items ?? [];
  const grouped = new Map<string, SchemaDiffResult['items']>();
  for (const item of items) {
    if (!grouped.has(item.table)) grouped.set(item.table, []);
    grouped.get(item.table)!.push(item);
  }
  const tables = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));

  let report = `XML DIFF SCHEMA REPORT
${separator}
Generated: ${timestamp}

TABLE SUMMARY
${'-'.repeat(30)}
+ Added tables:    ${summary.table.added}
- Removed tables:  ${summary.table.removed}
~ Modified tables: ${summary.table.modified}

FIELD SUMMARY
${'-'.repeat(30)}
+ Added fields:    ${summary.field.added}
- Removed fields:  ${summary.field.removed}
~ Modified fields: ${summary.field.modified}

SCHEMA CHANGES (${items.length})
${separator}
`;

  if (items.length === 0) {
    report += 'No schema differences.\n';
    return report;
  }

  for (const table of tables) {
    report += `\nTABLE: ${table}\n`;
    const tableItems = grouped.get(table) ?? [];
    for (const item of tableItems) {
      const typeSymbol = item.type === 'added' ? '+' : item.type === 'removed' ? '-' : '~';
      if (item.kind === 'table') {
        report += `  [${typeSymbol}] TABLE ${item.table}`;
        if (item.fieldCount !== undefined) {
          report += ` (fields: ${item.fieldCount})`;
        }
        report += '\n';
        continue;
      }
      report += `  [${typeSymbol}] FIELD ${item.field ?? ''}\n`;
      if (item.changes && item.changes.length > 0) {
        for (const change of item.changes) {
          report += `      ${change.key}: ${change.oldValue || '-'} -> ${change.newValue || '-'}\n`;
        }
      } else if (item.fieldDef) {
        const fieldAttrs: Array<{ key: string; value?: string }> = [
          { key: 'type', value: item.fieldDef.type },
          { key: 'size', value: item.fieldDef.size },
          { key: 'defaultvalue', value: item.fieldDef.defaultvalue },
        ];
        for (const attr of fieldAttrs) {
          if (!attr.value) continue;
          report += `      ${attr.key}: ${attr.value}\n`;
        }
      }
    }
  }

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
