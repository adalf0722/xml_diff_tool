import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import type { DiffType } from '../core/xml-diff';

interface DiffChunkCounts {
  added: number;
  removed: number;
  modified: number;
}

export interface DiffChunkItem {
  id: string;
  label: string;
  rangeLabel: string;
  diffIndexStart: number;
  diffIndexEnd: number;
  counts: DiffChunkCounts;
}

interface DiffChunkListProps {
  title: string;
  chunks: DiffChunkItem[];
  activeDiffIndex?: number;
  activeFilters: Set<DiffType>;
  onFilterToggle: (type: DiffType) => void;
  onResetFilters: () => void;
  allowModified?: boolean;
  onSelect?: (index: number) => void;
  className?: string;
}

export function DiffChunkList({
  title,
  chunks,
  activeDiffIndex,
  activeFilters,
  onFilterToggle,
  onResetFilters,
  allowModified = true,
  onSelect,
  className = '',
}: DiffChunkListProps) {
  const { t } = useLanguage();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const filterStats = useMemo(() => {
    return chunks.reduce(
      (acc, chunk) => {
        acc.added += chunk.counts.added;
        acc.removed += chunk.counts.removed;
        acc.modified += chunk.counts.modified;
        return acc;
      },
      { added: 0, removed: 0, modified: 0 }
    );
  }, [chunks]);

  const allowedFilterTypes = useMemo(() => {
    const types: DiffType[] = ['added', 'removed'];
    if (allowModified) types.push('modified');
    return types;
  }, [allowModified]);

  const activeFilterTypes = useMemo(() => {
    return allowedFilterTypes.filter(type => activeFilters.has(type));
  }, [activeFilters, allowedFilterTypes]);

  const visibleChunks = useMemo(() => {
    if (activeFilterTypes.length === 0) return [];
    return chunks.filter(chunk =>
      activeFilterTypes.some(type => {
        if (type === 'added') return chunk.counts.added > 0;
        if (type === 'removed') return chunk.counts.removed > 0;
        return chunk.counts.modified > 0;
      })
    );
  }, [activeFilterTypes, chunks]);

  const activeChunkId = useMemo(() => {
    if (activeDiffIndex === undefined) return null;
    const match = chunks.find(
      chunk => activeDiffIndex >= chunk.diffIndexStart && activeDiffIndex <= chunk.diffIndexEnd
    );
    return match?.id ?? null;
  }, [activeDiffIndex, chunks]);

  const activeVisibleIndex = useMemo(() => {
    if (!activeChunkId) return -1;
    return visibleChunks.findIndex(chunk => chunk.id === activeChunkId);
  }, [activeChunkId, visibleChunks]);

  useEffect(() => {
    if (activeVisibleIndex >= 0) {
      setFocusedIndex(activeVisibleIndex);
    }
  }, [activeVisibleIndex]);

  useEffect(() => {
    if (visibleChunks.length === 0) {
      setFocusedIndex(0);
      return;
    }
    setFocusedIndex(prev => Math.max(0, Math.min(prev, visibleChunks.length - 1)));
  }, [visibleChunks.length]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (visibleChunks.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, visibleChunks.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setFocusedIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setFocusedIndex(visibleChunks.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = visibleChunks[focusedIndex];
      if (target) {
        onSelect?.(target.diffIndexStart);
      }
    }
  }, [focusedIndex, onSelect, visibleChunks]);

  useEffect(() => {
    const node = itemRefs.current[focusedIndex];
    if (node) {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, visibleChunks.length]);

  const summaryText = useMemo(() => {
    return t.chunkCountLabel.replace('{count}', visibleChunks.length.toString());
  }, [t, visibleChunks.length]);

  const filterOptions = useMemo(() => {
    const options: Array<{ value: DiffType; label: string; disabled: boolean }> = [
      { value: 'added', label: t.added, disabled: filterStats.added === 0 },
      { value: 'removed', label: t.removed, disabled: filterStats.removed === 0 },
    ];
    if (allowModified) {
      options.push({ value: 'modified', label: t.modified, disabled: filterStats.modified === 0 });
    }
    return options;
  }, [allowModified, filterStats.added, filterStats.modified, filterStats.removed, t]);
  const allFilterTypes = useMemo(() => {
    return allowedFilterTypes;
  }, [allowedFilterTypes]);
  const isAllActive = useMemo(() => {
    return allFilterTypes.every(type => activeFilters.has(type));
  }, [activeFilters, allFilterTypes]);
  const disableAll = chunks.length === 0;

  return (
    <div className={`flex h-full flex-col ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{title}</span>
        <span className="text-[10px] text-[var(--color-text-muted)]">{summaryText}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">
          {t.chunkFilterLabel}
        </span>
        <button
          type="button"
          disabled={disableAll}
          onClick={onResetFilters}
          className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
            disableAll
              ? 'opacity-40 cursor-not-allowed text-[var(--color-text-muted)]'
              : isAllActive
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          {t.chunkFilterAll}
        </button>
        {filterOptions.map(option => {
          const isActive = activeFilters.has(option.value);
          return (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              onClick={() => onFilterToggle(option.value)}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                option.disabled
                  ? 'opacity-40 cursor-not-allowed text-[var(--color-text-muted)]'
                  : isActive
                    ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div
        ref={containerRef}
        tabIndex={0}
        role="listbox"
        aria-label={t.chunkListTitle}
        onKeyDown={handleKeyDown}
        className="flex-1 overflow-auto p-2 space-y-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
      >
        {visibleChunks.length === 0 && (
          <div className="px-2 py-3 text-[10px] text-[var(--color-text-muted)]">
            {t.chunkEmpty}
          </div>
        )}
        {visibleChunks.map((chunk, index) => {
          const isActive =
            activeDiffIndex !== undefined &&
            activeDiffIndex >= chunk.diffIndexStart &&
            activeDiffIndex <= chunk.diffIndexEnd;
          const isFocused = focusedIndex === index;
          return (
            <button
              key={chunk.id}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              onClick={() => {
                setFocusedIndex(index);
                onSelect?.(chunk.diffIndexStart);
              }}
              role="option"
              aria-selected={isActive}
              className={`w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
                isActive
                  ? 'border-[var(--color-accent)]/70 bg-[var(--color-bg-tertiary)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-tertiary)]/40'
              } ${isFocused ? 'ring-1 ring-[var(--color-accent)]/60' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--color-text-primary)]">{chunk.label}</span>
                {chunk.rangeLabel && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {chunk.rangeLabel}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                {chunk.counts.added > 0 && (
                  <span className="rounded border border-[var(--color-diff-added-border)] bg-[var(--color-diff-added-bg)] px-1.5 py-0.5 text-[var(--color-diff-added-text)]">
                    +{chunk.counts.added}
                  </span>
                )}
                {chunk.counts.removed > 0 && (
                  <span className="rounded border border-[var(--color-diff-removed-border)] bg-[var(--color-diff-removed-bg)] px-1.5 py-0.5 text-[var(--color-diff-removed-text)]">
                    -{chunk.counts.removed}
                  </span>
                )}
                {chunk.counts.modified > 0 && (
                  <span className="rounded border border-[var(--color-diff-modified-border)] bg-[var(--color-diff-modified-bg)] px-1.5 py-0.5 text-[var(--color-diff-modified-text)]">
                    ~{chunk.counts.modified}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
