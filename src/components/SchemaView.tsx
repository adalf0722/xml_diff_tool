/**
 * Schema View Component
 * Shows schema-level differences (tables and fields)
 */

import { useMemo, useEffect, useRef, useState, type ReactElement } from 'react';
import { Table, Hash, ChevronDown, ChevronRight, PanelRight, X } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { DiffType } from '../core/xml-diff';
import type { SchemaDiffItem, SchemaDiffResult, SchemaPresetId } from '../core/schema-diff';
import { useLanguage } from '../contexts/LanguageContext';

interface SchemaViewProps {
  schemaDiff: SchemaDiffResult;
  activeFilters: Set<DiffType>;
  schemaScope?: 'all' | 'table' | 'field';
  onScopeChange?: (scope: 'all' | 'table' | 'field') => void;
  schemaPresetId?: SchemaPresetId;
  onPresetChange?: (presetId: SchemaPresetId) => void;
  activeDiffIndex?: number;
  onNavigate?: (index: number) => void;
  onNavCountChange?: (count: number) => void;
  onJumpComplete?: (index: number) => void;
  onFilterToggle?: (type: DiffType) => void;
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
  schemaScope: schemaScopeProp,
  onScopeChange,
  schemaPresetId,
  onPresetChange,
  activeDiffIndex,
  onNavigate,
  onNavCountChange,
  onJumpComplete,
  onFilterToggle,
}: SchemaViewProps) {
  const { t } = useLanguage();
  const listRef = useRef<VirtuosoHandle>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set());
  const [schemaScopeState, setSchemaScopeState] = useState<'all' | 'table' | 'field'>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const schemaScope = schemaScopeProp ?? schemaScopeState;
  const showPresetSelector = schemaPresetId !== undefined && Boolean(onPresetChange);
  const presetOptions = useMemo(
    () => [
      { id: 'struct' as const, label: t.schemaPresetStruct },
      { id: 'xsd' as const, label: t.schemaPresetXsd },
      { id: 'table' as const, label: t.schemaPresetTable },
    ],
    [t.schemaPresetStruct, t.schemaPresetTable, t.schemaPresetXsd]
  );
  const updateSchemaScope = (scope: 'all' | 'table' | 'field') => {
    if (!schemaScopeProp) {
      setSchemaScopeState(scope);
    }
    onScopeChange?.(scope);
  };

  const filteredItems = useMemo(() => {
    let items = schemaDiff.items.filter(item => activeFilters.has(item.type));
    if (schemaScope === 'table') {
      const tableNames = new Set(
        items.filter(item => item.kind === 'table').map(item => item.table)
      );
      items = items.filter(item => item.kind === 'table' || tableNames.has(item.table));
    } else if (schemaScope === 'field') {
      items = items.filter(item => item.kind === 'field');
    }
    return items;
  }, [schemaDiff.items, activeFilters, schemaScope]);

  const schemaStats = useMemo(() => {
    const result = {
      table: { added: 0, removed: 0, modified: 0 },
      field: { added: 0, removed: 0, modified: 0 },
    };
    for (const item of schemaDiff.items) {
      if (!activeFilters.has(item.type)) continue;
      if (item.kind === 'table') {
        if (item.type === 'added') result.table.added += 1;
        else if (item.type === 'removed') result.table.removed += 1;
        else if (item.type === 'modified') result.table.modified += 1;
      } else {
        if (item.type === 'added') result.field.added += 1;
        else if (item.type === 'removed') result.field.removed += 1;
        else if (item.type === 'modified') result.field.modified += 1;
      }
    }
    return result;
  }, [schemaDiff.items, activeFilters]);

  const applySchemaFilter = (scope: 'table' | 'field', type: DiffType) => {
    updateSchemaScope(scope);
    if (!onFilterToggle) return;
    const targetTypes: DiffType[] = [type];
    (['added', 'removed', 'modified'] as const).forEach(diffType => {
      const shouldBeActive = targetTypes.includes(diffType);
      const isActive = activeFilters.has(diffType);
      if (shouldBeActive !== isActive) {
        onFilterToggle(diffType);
      }
    });
  };

  const isStatActive = (scope: 'table' | 'field', type: DiffType) =>
    schemaScope === scope && activeFilters.size === 1 && activeFilters.has(type);

  const resetSchemaFilters = () => {
    updateSchemaScope('all');
    if (!onFilterToggle) return;
    (['added', 'removed', 'modified'] as const).forEach(diffType => {
      if (!activeFilters.has(diffType)) {
        onFilterToggle(diffType);
      }
    });
  };

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

  const sidebarContent = (
    <>
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t.schemaSummaryTitle}
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-md border border-[var(--color-border)] p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/60 lg:hidden"
            aria-label={t.close}
          >
            <X size={14} />
          </button>
        </div>
        {showPresetSelector && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {t.schemaPresetLabel}
            </span>
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/40 p-1 text-[10px]">
              {presetOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onPresetChange?.(option.id)}
                  className={`rounded px-2 py-1 font-semibold transition-colors ${
                    schemaPresetId === option.id
                      ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/40 p-1 text-[10px]">
            <button
              type="button"
              onClick={() => updateSchemaScope('all')}
              className={`rounded px-2 py-1 font-semibold transition-colors ${
                schemaScope === 'all'
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {t.schemaFilterAll}
            </button>
            <button
              type="button"
              onClick={() => updateSchemaScope('table')}
              className={`rounded px-2 py-1 font-semibold transition-colors ${
                schemaScope === 'table'
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {t.schemaFilterTables}
            </button>
            <button
              type="button"
              onClick={() => updateSchemaScope('field')}
              className={`rounded px-2 py-1 font-semibold transition-colors ${
                schemaScope === 'field'
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {t.schemaFilterFields}
            </button>
          </div>
          <button
            type="button"
            onClick={resetSchemaFilters}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/60"
          >
            {t.resetFilters}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3 space-y-4 text-sm text-[var(--color-text-secondary)]">
        {schemaScope !== 'field' && (
          <section>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {t.schemaTableChanges}
            </div>
            <div className="mt-2 grid gap-2">
              <StatRow
                label={t.schemaTableAddedLabel}
                count={schemaStats.table.added}
                tone="added"
                active={isStatActive('table', 'added')}
                onClick={
                  schemaStats.table.added > 0
                    ? () => applySchemaFilter('table', 'added')
                    : undefined
                }
              />
              <StatRow
                label={t.schemaTableRemovedLabel}
                count={schemaStats.table.removed}
                tone="removed"
                active={isStatActive('table', 'removed')}
                onClick={
                  schemaStats.table.removed > 0
                    ? () => applySchemaFilter('table', 'removed')
                    : undefined
                }
              />
              <StatRow
                label={t.schemaTableModifiedLabel}
                count={schemaStats.table.modified}
                tone="modified"
                active={isStatActive('table', 'modified')}
                onClick={
                  schemaStats.table.modified > 0
                    ? () => applySchemaFilter('table', 'modified')
                    : undefined
                }
              />
            </div>
          </section>
        )}
        {schemaScope !== 'table' && (
          <section>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {t.schemaFieldChanges}
            </div>
            <div className="mt-2 grid gap-2">
              <StatRow
                label={t.schemaFieldAddedLabel}
                count={schemaStats.field.added}
                tone="added"
                active={isStatActive('field', 'added')}
                onClick={
                  schemaStats.field.added > 0
                    ? () => applySchemaFilter('field', 'added')
                    : undefined
                }
              />
              <StatRow
                label={t.schemaFieldRemovedLabel}
                count={schemaStats.field.removed}
                tone="removed"
                active={isStatActive('field', 'removed')}
                onClick={
                  schemaStats.field.removed > 0
                    ? () => applySchemaFilter('field', 'removed')
                    : undefined
                }
              />
              <StatRow
                label={t.schemaFieldModifiedLabel}
                count={schemaStats.field.modified}
                tone="modified"
                active={isStatActive('field', 'modified')}
                onClick={
                  schemaStats.field.modified > 0
                    ? () => applySchemaFilter('field', 'modified')
                    : undefined
                }
              />
            </div>
          </section>
        )}
      </div>
    </>
  );

  return (
    <div className="h-full flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] lg:hidden">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t.schemaSummaryTitle}
          </span>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/60"
            aria-label={t.schemaSummaryTitle}
          >
            <PanelRight size={14} />
          </button>
        </div>
        <div className="flex-1 min-h-0">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
            <p>{t.schemaNoChanges}</p>
          </div>
        ) : (
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
        )}
        </div>
      </div>
      <aside className="hidden lg:flex lg:w-72 xl:w-80 flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        {sidebarContent}
      </aside>
      <div
        className={`fixed inset-0 z-40 lg:hidden ${isSidebarOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!isSidebarOpen}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsSidebarOpen(false)}
        />
        <div
          className={`absolute right-0 top-0 h-full w-72 max-w-[85vw] border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-lg transition-transform ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          {sidebarContent}
        </div>
      </div>
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

function StatRow({
  label,
  count,
  tone,
  active = false,
  onClick,
}: {
  label: string;
  count: number;
  tone: DiffType;
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass = getStatTone(tone);
  const interactiveClass = onClick
    ? 'cursor-pointer hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-bg-tertiary)]/60'
    : 'cursor-default';
  const activeClass = active ? 'ring-1 ring-[var(--color-accent)]/60' : '';
  return (
    <div
      className={`flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/40 px-2.5 py-2 text-xs ${interactiveClass} ${activeClass}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>
        {count}
      </span>
    </div>
  );
}

function getStatTone(type: DiffType): string {
  switch (type) {
    case 'added':
      return 'border-[var(--color-diff-added-border)]/50 bg-[var(--color-diff-added-bg)]/40 text-[var(--color-diff-added-text)]';
    case 'removed':
      return 'border-[var(--color-diff-removed-border)]/50 bg-[var(--color-diff-removed-bg)]/40 text-[var(--color-diff-removed-text)]';
    case 'modified':
      return 'border-[var(--color-diff-modified-border)]/50 bg-[var(--color-diff-modified-bg)]/40 text-[var(--color-diff-modified-text)]';
    default:
      return 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/60 text-[var(--color-text-muted)]';
  }
}
