/**
 * Schema View Component
 * Shows schema-level differences (tables and fields)
 */

import { useMemo, useEffect, useRef, useState, type ReactElement } from 'react';
import { Table, Hash, ChevronDown, ChevronRight } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { DiffType } from '../core/xml-diff';
import type { SchemaDiffItem, SchemaDiffResult } from '../core/schema-diff';
import { useLanguage } from '../contexts/LanguageContext';

interface SchemaViewProps {
  schemaDiff: SchemaDiffResult;
  activeFilters: Set<DiffType>;
  activeDiffIndex?: number;
  onNavigate?: (index: number) => void;
  onNavCountChange?: (count: number) => void;
  onJumpComplete?: (index: number) => void;
}

type SchemaViewRow =
  | {
      kind: 'group';
      id: string;
      table: string;
      tableType?: DiffType;
      tableItemId?: string;
      tableNavIndex?: number;
      counts: { added: number; removed: number; modified: number };
      fieldTotal: number;
      isCollapsed: boolean;
    }
  | {
      kind: 'item';
      id: string;
      item: SchemaDiffItem;
      navIndex: number;
    };

const FIELD_ATTR_KEYS = ['type', 'size', 'defaultvalue'] as const;

export function SchemaView({
  schemaDiff,
  activeFilters,
  activeDiffIndex,
  onNavigate,
  onNavCountChange,
  onJumpComplete,
}: SchemaViewProps) {
  const { t } = useLanguage();
  const listRef = useRef<VirtuosoHandle>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set());

  const filteredItems = useMemo(
    () => schemaDiff.items.filter(item => activeFilters.has(item.type)),
    [schemaDiff.items, activeFilters]
  );

  const { rows, navItems, navIndexToRowIndex, navIndexById } = useMemo(() => {
    const grouped = new Map<string, SchemaDiffItem[]>();
    for (const item of filteredItems) {
      if (!grouped.has(item.table)) grouped.set(item.table, []);
      grouped.get(item.table)!.push(item);
    }

    const tables = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
    const rows: SchemaViewRow[] = [];
    const navItems: SchemaDiffItem[] = [];
    const navIndexToRowIndex = new Map<number, number>();
    const navIndexById = new Map<string, number>();

    let rowIndex = 0;
    let navIndex = 0;

    for (const table of tables) {
      const items = grouped.get(table) ?? [];
      const tableItem = items.find(item => item.kind === 'table');
      const fieldItems = items.filter(item => item.kind === 'field');
      const counts = fieldItems.reduce(
        (acc, item) => {
          if (item.type === 'added') acc.added += 1;
          if (item.type === 'removed') acc.removed += 1;
          if (item.type === 'modified') acc.modified += 1;
          return acc;
        },
        { added: 0, removed: 0, modified: 0 }
      );
      const isCollapsed = collapsedTables.has(table);
      const fieldTotal = tableItem?.fieldCount ?? fieldItems.length;
      const groupRow: SchemaViewRow = {
        kind: 'group',
        id: `group:${table}`,
        table,
        tableType: tableItem?.type,
        tableItemId: tableItem?.id,
        tableNavIndex: tableItem ? navIndex : undefined,
        counts,
        fieldTotal,
        isCollapsed,
      };
      rows.push(groupRow);
      if (tableItem) {
        navItems.push(tableItem);
        navIndexToRowIndex.set(navIndex, rowIndex);
        navIndexById.set(tableItem.id, navIndex);
        navIndex += 1;
      }
      rowIndex += 1;

      if (isCollapsed) {
        continue;
      }

      const sortedFields = [...fieldItems].sort((a, b) => {
        if (a.field && b.field) return a.field.localeCompare(b.field);
        return a.table.localeCompare(b.table);
      });

      for (const item of sortedFields) {
        rows.push({ kind: 'item', id: item.id, item, navIndex });
        navItems.push(item);
        navIndexToRowIndex.set(navIndex, rowIndex);
        navIndexById.set(item.id, navIndex);
        navIndex += 1;
        rowIndex += 1;
      }
    }

    return { rows, navItems, navIndexToRowIndex, navIndexById };
  }, [filteredItems, collapsedTables]);

  useEffect(() => {
    onNavCountChange?.(navItems.length);
  }, [navItems.length, onNavCountChange]);

  useEffect(() => {
    if (activeDiffIndex === undefined || activeDiffIndex < 0) return;
    const rowIndex = navIndexToRowIndex.get(activeDiffIndex);
    if (rowIndex === undefined) return;
    const targetItem = navItems[activeDiffIndex];
    if (!targetItem) return;

    listRef.current?.scrollToIndex({ index: rowIndex, align: 'center', behavior: 'smooth' });
    setHighlightedId(targetItem.id);
    const timer = setTimeout(() => setHighlightedId(null), 1000);
    const doneTimer = setTimeout(() => onJumpComplete?.(activeDiffIndex), 120);

    return () => {
      clearTimeout(timer);
      clearTimeout(doneTimer);
    };
  }, [activeDiffIndex, navIndexToRowIndex, navItems, onJumpComplete]);

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        <p>{t.schemaNoChanges}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Virtuoso
        ref={listRef}
        data={rows}
        className="flex-1"
        style={{ height: '100%' }}
        itemContent={(_index, row) => {
          if (row.kind === 'group') {
            const { added, removed, modified } = row.counts;
            const highlightGroup = row.tableItemId && highlightedId === row.tableItemId;
            const isCollapsible = row.fieldTotal > 0;
            const tableBadgeLabel = row.tableType
              ? `${diffLabel(t, row.tableType)} ${t.schemaTable}`
              : null;
            const groupTone = getTableTone(row.tableType);
            return (
              <div className="px-4 pt-4 pb-2">
                <div
                  className={`flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)]/60 px-3 py-2 ${groupTone} ${
                    highlightGroup ? 'diff-highlight-pulse' : ''
                  } ${row.tableNavIndex !== undefined ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (row.tableNavIndex !== undefined) {
                      onNavigate?.(row.tableNavIndex);
                    }
                  }}
                >
                  <button
                    type="button"
                    className="flex items-center justify-center rounded-md p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/40"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!isCollapsible) return;
                      setCollapsedTables(prev => {
                        const next = new Set(prev);
                        if (next.has(row.table)) {
                          next.delete(row.table);
                        } else {
                          next.add(row.table);
                        }
                        return next;
                      });
                    }}
                    aria-label={row.isCollapsed ? t.expandSection : t.collapseAll}
                  >
                    {row.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <Table size={14} className="text-[var(--color-accent)]" />
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {row.table}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    {t.schemaTable}
                  </span>
                  {tableBadgeLabel && (
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${getTableBadgeTone(row.tableType)}`}>
                      {tableBadgeLabel}
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {t.schemaFieldCount.replace('{count}', row.fieldTotal.toString())}
                  </span>
                  <div className="ml-auto flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                    {added > 0 && (
                      <span className="px-2 py-0.5 rounded-full border border-[var(--color-diff-added-border)]/50 bg-[var(--color-diff-added-bg)]/30 text-[var(--color-diff-added-text)]">
                        {t.added}: {added}
                      </span>
                    )}
                    {removed > 0 && (
                      <span className="px-2 py-0.5 rounded-full border border-[var(--color-diff-removed-border)]/50 bg-[var(--color-diff-removed-bg)]/30 text-[var(--color-diff-removed-text)]">
                        {t.removed}: {removed}
                      </span>
                    )}
                    {modified > 0 && (
                      <span className="px-2 py-0.5 rounded-full border border-[var(--color-diff-modified-border)]/50 bg-[var(--color-diff-modified-bg)]/30 text-[var(--color-diff-modified-text)]">
                        {t.modified}: {modified}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          const { item } = row;
          const navIndex = navIndexById.get(item.id);
          const isHighlighted = highlightedId === item.id;
          const diffClass = getDiffClass(item.type);
          const hasNav = navIndex !== undefined && onNavigate;
          const attrLabelMap: Record<(typeof FIELD_ATTR_KEYS)[number], string> = {
            type: t.schemaAttributeType,
            size: t.schemaAttributeSize,
            defaultvalue: t.schemaAttributeDefault,
          };

          const renderFieldAttributes = () => {
            if (!item.fieldDef) return null;
            const chips: ReactElement[] = [];
            for (const key of FIELD_ATTR_KEYS) {
              const value = item.fieldDef?.[key];
              if (!value) continue;
              chips.push(
                <span
                  key={key}
                  className="px-2 py-0.5 rounded-md border border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)]/60"
                >
                  {attrLabelMap[key]}: {value}
                </span>
              );
            }
            if (chips.length === 0) return null;
            return <div className="mt-2 flex flex-wrap gap-2">{chips}</div>;
          };

          const renderChanges = () => {
            if (!item.changes || item.changes.length === 0) return null;
            return (
              <div className="mt-2 space-y-2">
                {item.changes.map(change => {
                  const oldValue = change.oldValue || '-';
                  const newValue = change.newValue || '-';
                  return (
                    <div
                      key={`${item.id}-${change.key}`}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/40 px-2 py-1"
                    >
                      <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                        {attrLabelMap[change.key]}
                      </span>
                      <span className="px-2 py-0.5 rounded-md border border-[var(--color-diff-removed-border)]/40 bg-[var(--color-diff-removed-bg)]/40 text-[10px] text-[var(--color-diff-removed-text)]">
                        {oldValue}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{'->'}</span>
                      <span className="px-2 py-0.5 rounded-md border border-[var(--color-diff-added-border)]/40 bg-[var(--color-diff-added-bg)]/40 text-[10px] text-[var(--color-diff-added-text)]">
                        {newValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          };

          if (item.kind === 'table') {
            return null;
          }

          return (
            <div className="px-4 pb-2">
              <div
                className={`flex flex-col gap-2 rounded-md border border-[var(--color-border)]/60 px-3 py-2 transition-colors ${diffClass} ${
                  isHighlighted ? 'diff-highlight-pulse' : ''
                } ${hasNav ? 'cursor-pointer hover:border-[var(--color-accent)]/60' : ''}`}
                onClick={() => {
                  if (navIndex !== undefined) onNavigate?.(navIndex);
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Hash size={14} className="text-[var(--color-text-muted)]" />
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {item.field}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                    {t.schemaField}
                  </span>
                  <DiffBadge type={item.type} label={diffLabel(t, item.type)} />
                </div>
                {item.type !== 'modified' && renderFieldAttributes()}
                {item.type === 'modified' && renderChanges()}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}

function diffLabel(t: ReturnType<typeof useLanguage>['t'], type: DiffType): string {
  if (type === 'added') return t.added;
  if (type === 'removed') return t.removed;
  if (type === 'modified') return t.modified;
  return t.unchanged;
}

function getDiffClass(type: DiffType): string {
  switch (type) {
    case 'added':
      return 'bg-[var(--color-diff-added-bg)]/20 border-[var(--color-diff-added-border)]/60';
    case 'removed':
      return 'bg-[var(--color-diff-removed-bg)]/20 border-[var(--color-diff-removed-border)]/60';
    case 'modified':
      return 'bg-[var(--color-diff-modified-bg)]/20 border-[var(--color-diff-modified-border)]/60';
    default:
      return '';
  }
}

function getTableTone(type?: DiffType): string {
  switch (type) {
    case 'added':
      return 'border-l-4 border-[var(--color-diff-added-border)] bg-[var(--color-diff-added-bg)]/20';
    case 'removed':
      return 'border-l-4 border-[var(--color-diff-removed-border)] bg-[var(--color-diff-removed-bg)]/20';
    case 'modified':
      return 'border-l-4 border-[var(--color-diff-modified-border)] bg-[var(--color-diff-modified-bg)]/20';
    default:
      return 'border-l-4 border-[var(--color-accent)]/40 bg-[var(--color-bg-secondary)]/70';
  }
}

function getTableBadgeTone(type?: DiffType): string {
  switch (type) {
    case 'added':
      return 'border-[var(--color-diff-added-border)] bg-[var(--color-diff-added-bg)]/40 text-[var(--color-diff-added-text)]';
    case 'removed':
      return 'border-[var(--color-diff-removed-border)] bg-[var(--color-diff-removed-bg)]/40 text-[var(--color-diff-removed-text)]';
    case 'modified':
      return 'border-[var(--color-diff-modified-border)] bg-[var(--color-diff-modified-bg)]/40 text-[var(--color-diff-modified-text)]';
    default:
      return 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/60 text-[var(--color-text-muted)]';
  }
}

function DiffBadge({ type, label }: { type: DiffType; label: string }) {
  if (type === 'unchanged') return null;
  const colorMap = {
    added: 'bg-[var(--color-diff-added-bg)] text-[var(--color-diff-added-text)] border border-[var(--color-diff-added-border)]',
    removed: 'bg-[var(--color-diff-removed-bg)] text-[var(--color-diff-removed-text)] border border-[var(--color-diff-removed-border)]',
    modified: 'bg-[var(--color-diff-modified-bg)] text-[var(--color-diff-modified-text)] border border-[var(--color-diff-modified-border)]',
    unchanged: '',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${colorMap[type]}`}>
      {label}
    </span>
  );
}
