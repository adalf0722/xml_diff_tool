import React, { useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface DiffOverviewMarker {
  diffIndex: number;
  lineIndex: number;
  type?: 'added' | 'removed' | 'modified';
  side?: 'A' | 'B';
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

const DENSITY_BINS = 72;

export function DiffOverviewBar({
  totalLines,
  markers,
  activeIndex,
  viewport = null,
  onSelect,
  maxMarkers = 200,
  className = '',
}: DiffOverviewBarProps) {
  const { t } = useLanguage();
  const uniqueMarkers = useMemo(() => {
    const map = new Map<number, DiffOverviewMarker>();
    markers.forEach(marker => {
      const existing = map.get(marker.diffIndex);
      if (!existing || marker.lineIndex < existing.lineIndex) {
        map.set(marker.diffIndex, marker);
      }
    });
    return Array.from(map.values());
  }, [markers]);

  const sortedByLine = useMemo(() => {
    return [...uniqueMarkers].sort((a, b) => a.lineIndex - b.lineIndex);
  }, [uniqueMarkers]);

  const visibleMarkers = useMemo(() => {
    if (totalLines <= 0 || uniqueMarkers.length === 0) return [];
    const sorted = [...uniqueMarkers].sort((a, b) => a.diffIndex - b.diffIndex);
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
  }, [activeIndex, maxMarkers, totalLines, uniqueMarkers]);

  const coverageRatio = useMemo(() => {
    if (totalLines <= 0) return 0;
    return Math.min(1, uniqueMarkers.length / totalLines);
  }, [uniqueMarkers.length, totalLines]);

  const lineMarkers = useMemo(() => {
    if (totalLines <= 0 || markers.length === 0) return [];
    const denominator = Math.max(totalLines - 1, 1);
    const used = new Map<string, { topPercent: number; diffIndex: number; type?: DiffOverviewMarker['type']; side: 'A' | 'B' }>();
    const rank = (type?: DiffOverviewMarker['type']) => {
      if (type === 'modified') return 3;
      if (type === 'added' || type === 'removed') return 2;
      return 1;
    };

    markers.forEach(marker => {
      const top = (marker.lineIndex / denominator) * 100;
      const rounded = Math.round(top * 10) / 10;
      const side = marker.side ?? 'A';
      const key = `${side}:${rounded}`;
      const existing = used.get(key);
      if (!existing || rank(marker.type) > rank(existing.type)) {
        used.set(key, { topPercent: top, diffIndex: marker.diffIndex, type: marker.type, side });
      }
    });

    return Array.from(used.values());
  }, [markers, totalLines]);

  const densityBands = useMemo(() => {
    if (totalLines <= 0 || markers.length === 0) return [];
    const denominator = Math.max(totalLines - 1, 1);
    const counts = new Array<number>(DENSITY_BINS).fill(0);
    markers.forEach(marker => {
      const ratio = marker.lineIndex / denominator;
      const index = Math.min(DENSITY_BINS - 1, Math.max(0, Math.floor(ratio * DENSITY_BINS)));
      counts[index] += 1;
    });
    const max = Math.max(...counts);
    if (max <= 0) return [];
    const levels = counts.map(count => {
      if (count <= 0) return -1;
      const ratio = count / max;
      if (ratio >= 0.66) return 2;
      if (ratio >= 0.33) return 1;
      return 0;
    });
    const segments: { start: number; end: number; level: 0 | 1 | 2 }[] = [];
    let start = 0;
    let current = levels[0];
    for (let i = 1; i <= DENSITY_BINS; i += 1) {
      if (i === DENSITY_BINS || levels[i] !== current) {
        if (current >= 0) {
          segments.push({ start, end: i, level: current as 0 | 1 | 2 });
        }
        start = i;
        current = levels[i];
      }
    }
    return segments;
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

  const coverageText = t.overviewCoverageLabel.replace(
    '{percent}',
    Math.round(coverageRatio * 100).toString()
  );
  const densityText = coverageRatio > 0.8 ? ` · ${t.overviewHighDensity}` : '';

  return (
    <div className={`absolute right-2 top-4 bottom-4 z-20 flex items-stretch ${className}`.trim()}>
      <span className="absolute -left-24 top-2 min-w-[92px] px-2 py-0.5 text-[10px] text-right rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)]/90 text-[var(--color-text-secondary)] shadow-sm pointer-events-none">
        {coverageText}
        {densityText}
      </span>
      <div
        className="relative w-[14px] rounded-full border border-[var(--color-accent)]/70 bg-[var(--color-bg-primary)]/40 shadow-[0_0_0_1px_var(--color-bg-primary)]/80 backdrop-blur cursor-pointer transition-colors hover:border-[var(--color-accent)]/90"
        onClick={handleClick}
      >
        {/* Density band */}
        {densityBands.map((band, index) => {
          const opacity = band.level === 2 ? 0.85 : band.level === 1 ? 0.6 : 0.3;
          return (
            <span
              key={`density-${band.start}-${band.end}-${index}`}
              className="absolute left-[2px] right-[2px] rounded-sm pointer-events-none"
              style={{
                top: `${(band.start / DENSITY_BINS) * 100}%`,
                height: `${((band.end - band.start) / DENSITY_BINS) * 100}%`,
                backgroundColor: 'var(--color-accent)',
                opacity,
              }}
            />
          );
        })}
        {/* Base layer */}
        {lineMarkers.map(marker => (
          <span
            key={`base-${marker.diffIndex}-${marker.topPercent}`}
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: `${marker.topPercent}%`,
              height: '1px',
              backgroundColor: 'var(--color-border)',
              opacity: 0.25,
              left: marker.side === 'A' ? '1px' : undefined,
              right: marker.side === 'B' ? '1px' : undefined,
              width: '5px',
            }}
          />
        ))}
        {/* Color layer */}
        {lineMarkers.map(marker => {
          const color =
            marker.type === 'added'
              ? 'var(--color-diff-added-border)'
              : marker.type === 'removed'
                ? 'var(--color-diff-removed-border)'
                : marker.type === 'modified'
                  ? 'var(--color-diff-modified-border)'
                  : 'var(--color-accent)';
          const isActive = marker.diffIndex === activeIndex;
          return (
            <span
              key={`color-${marker.diffIndex}-${marker.topPercent}`}
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: `${marker.topPercent}%`,
                height: isActive ? '2px' : '1px',
                backgroundColor: color,
                opacity: isActive ? 1 : 0.9,
                boxShadow: isActive ? `0 0 6px ${color}` : undefined,
                left: marker.side === 'A' ? '1px' : undefined,
                right: marker.side === 'B' ? '1px' : undefined,
                width: '5px',
              }}
            />
          );
        })}

        {viewport && (
          <span
            className="absolute left-0 right-0 rounded pointer-events-none"
            style={{
              top: `${Math.max(0, viewport.start) * 100}%`,
              height: `${Math.max(0, viewport.end - viewport.start) * 100}%`,
            }}
          >
            <span className="absolute inset-0 rounded border border-[var(--color-accent)]/55 bg-[var(--color-bg-primary)]/18" />
            <span
              className="absolute inset-[1px] rounded border border-[var(--color-accent)]/95"
              style={{ boxShadow: '0 0 10px var(--color-accent), 0 0 2px var(--color-accent)' }}
            />
            <span
              className="absolute left-1/2 -translate-x-1/2 -top-1 h-1.5 w-2 rounded-full bg-[var(--color-accent)]/90"
              style={{ boxShadow: '0 0 6px var(--color-accent)' }}
            />
            <span
              className="absolute left-1/2 -translate-x-1/2 -bottom-1 h-1.5 w-2 rounded-full bg-[var(--color-accent)]/90"
              style={{ boxShadow: '0 0 6px var(--color-accent)' }}
            />
          </span>
        )}

        {/* Ticks */}
        {[0, 0.5, 1].map(tick => (
          <span
            key={`tick-${tick}`}
            className="absolute -left-1 w-2 h-[1px] bg-[var(--color-text-muted)]/60 pointer-events-none"
            style={{ top: `${tick * 100}%` }}
          />
        ))}

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
