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
  summary?: string;
  chunks: DiffChunkItem[];
  activeDiffIndex?: number;
  onSelect?: (index: number) => void;
  className?: string;
}

export function DiffChunkList({
  title,
  summary,
  chunks,
  activeDiffIndex,
  onSelect,
  className = '',
}: DiffChunkListProps) {
  return (
    <div className={`flex h-full flex-col ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{title}</span>
        {summary && (
          <span className="text-[10px] text-[var(--color-text-muted)]">{summary}</span>
        )}
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {chunks.map(chunk => {
          const isActive =
            activeDiffIndex !== undefined &&
            activeDiffIndex >= chunk.diffIndexStart &&
            activeDiffIndex <= chunk.diffIndexEnd;
          return (
            <button
              key={chunk.id}
              type="button"
              onClick={() => onSelect?.(chunk.diffIndexStart)}
              className={`w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
                isActive
                  ? 'border-[var(--color-accent)]/60 bg-[var(--color-bg-tertiary)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-tertiary)]/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--color-text-primary)]">{chunk.label}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">{chunk.rangeLabel}</span>
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
