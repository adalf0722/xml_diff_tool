import React, { useMemo, useCallback } from 'react';

interface DiffOverviewMarker {
  diffIndex: number;
  lineIndex: number;
}

interface DiffOverviewBarProps {
  totalLines: number;
  markers: DiffOverviewMarker[];
  activeIndex?: number;
  viewport?: { start: number; end: number } | null;
  onSelect?: (index: number) => void;
  maxMarkers?: number;
  className?: string;
}

export function DiffOverviewBar({
  totalLines,
  markers,
  activeIndex,
  viewport = null,
  onSelect,
  maxMarkers = 200,
  className = '',
}: DiffOverviewBarProps) {
  const sortedByLine = useMemo(() => {
    return [...markers].sort((a, b) => a.lineIndex - b.lineIndex);
  }, [markers]);

  const visibleMarkers = useMemo(() => {
    if (totalLines <= 0 || markers.length === 0) return [];
    const sorted = [...markers].sort((a, b) => a.diffIndex - b.diffIndex);
    if (sorted.length <= maxMarkers) return sorted;

    const step = Math.ceil(sorted.length / maxMarkers);
    const sampled: DiffOverviewMarker[] = [];
    sorted.forEach((marker, idx) => {
      if (idx % step === 0) sampled.push(marker);
    });

    if (activeIndex !== undefined) {
      const activeMarker = sorted.find(marker => marker.diffIndex === activeIndex);
      if (activeMarker && !sampled.some(marker => marker.diffIndex === activeIndex)) {
        sampled.push(activeMarker);
      }
    }

    return sampled.sort((a, b) => a.diffIndex - b.diffIndex);
  }, [activeIndex, markers, maxMarkers, totalLines]);

  const densityBuckets = useMemo(() => {
    if (totalLines <= 0 || markers.length === 0) return [];
    const bucketCount = Math.min(80, Math.max(24, Math.round(totalLines / 500)));
    const buckets = new Array<number>(bucketCount).fill(0);
    const denominator = Math.max(totalLines - 1, 1);
    markers.forEach(marker => {
      const ratio = marker.lineIndex / denominator;
      const idx = Math.min(bucketCount - 1, Math.floor(ratio * bucketCount));
      buckets[idx] += 1;
    });
    const maxCount = Math.max(...buckets, 1);
    return buckets.map((count, index) => ({
      index,
      opacity: 0.12 + 0.68 * (count / maxCount),
      heightPercent: 100 / bucketCount,
    }));
  }, [markers, totalLines]);

  const handleBarJump = useCallback(
    (ratio: number) => {
      if (!onSelect || sortedByLine.length === 0) return;
      const clamped = Math.max(0, Math.min(1, ratio));
      const targetLine = Math.round(clamped * Math.max(totalLines - 1, 1));

      let left = 0;
      let right = sortedByLine.length - 1;
      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (sortedByLine[mid].lineIndex < targetLine) {
          left = mid + 1;
        } else {
          right = mid;
        }
      }

      const candidate = sortedByLine[left];
      const prev = sortedByLine[left - 1];
      const closest =
        prev && Math.abs(prev.lineIndex - targetLine) < Math.abs(candidate.lineIndex - targetLine)
          ? prev
          : candidate;
      onSelect(closest.diffIndex);
    },
    [onSelect, sortedByLine, totalLines]
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const offset = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
      const ratio = rect.height > 0 ? offset / rect.height : 0;
      handleBarJump(ratio);
    },
    [handleBarJump]
  );


  if (totalLines <= 0 || markers.length === 0) return null;

  const denominator = Math.max(totalLines - 1, 1);

  return (
    <div className={`absolute right-2 top-4 bottom-4 z-20 flex items-stretch ${className}`.trim()}>
      <div
        className="relative w-[6px] rounded-full border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/70 cursor-pointer shadow-sm"
        onClick={handleClick}
      >
        {densityBuckets.map(bucket => (
          <span
            key={bucket.index}
            className="absolute left-0 right-0 pointer-events-none bg-[var(--color-accent)]"
            style={{
              top: `${bucket.index * bucket.heightPercent}%`,
              height: `${bucket.heightPercent}%`,
              opacity: bucket.opacity,
            }}
          />
        ))}

        {viewport && (
          <span
            className="absolute left-0 right-0 rounded border border-[var(--color-accent)]/70 bg-[var(--color-bg-primary)]/40 pointer-events-none"
            style={{
              top: `${Math.max(0, viewport.start) * 100}%`,
              height: `${Math.max(0, viewport.end - viewport.start) * 100}%`,
            }}
          />
        )}

        {visibleMarkers.map(marker => {
          const topPercent = (marker.lineIndex / denominator) * 100;
          const isActive = marker.diffIndex === activeIndex;
          return (
            <button
              key={marker.diffIndex}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.(marker.diffIndex);
              }}
              className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full transition-transform ${
                isActive
                  ? 'bg-[var(--color-accent)] scale-110'
                  : 'bg-[var(--color-text-muted)]/80 hover:bg-[var(--color-text-secondary)]'
              }`}
              style={{ top: `${topPercent}%` }}
              aria-label={`Jump to diff #${marker.diffIndex + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}
