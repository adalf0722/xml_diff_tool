import { useEffect, useMemo, useState } from 'react';
import type { PerfRecord } from '../utils/perf-metrics';
import {
  clearPerfRecords,
  getPerfRecords,
  onPerfRecord,
  setPerfLoggingEnabled,
} from '../utils/perf-metrics';

const MAX_RECORDS = 50;
const MAX_ROWS = 8;

function formatValue(record?: PerfRecord): string {
  if (!record) return '--';
  return `${record.value.toFixed(1)} ${record.unit}`;
}

function formatAge(ts: number): string {
  const diffMs = Date.now() - ts;
  if (diffMs < 1000) return `${diffMs.toFixed(0)}ms`;
  return `${(diffMs / 1000).toFixed(1)}s`;
}

export function PerfDebugPanel() {
  const [records, setRecords] = useState<PerfRecord[]>(() =>
    getPerfRecords().slice(-MAX_RECORDS)
  );
  const [open, setOpen] = useState(false);
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    const unsubscribe = onPerfRecord(record => {
      setRecords(prev => {
        const next = [...prev, record];
        if (next.length > MAX_RECORDS) {
          next.shift();
        }
        return next;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setPerfLoggingEnabled(logging);
  }, [logging]);

  const latestByName = useMemo(() => {
    const map = new Map<string, PerfRecord>();
    for (const record of records) {
      map.set(record.name, record);
    }
    return map;
  }, [records]);

  const recent = useMemo(() => {
    return records.slice(-MAX_ROWS).reverse();
  }, [records]);

  const handleClear = () => {
    clearPerfRecords();
    setRecords([]);
  };

  if (!open) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setOpen(true)}
          className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1 text-xs text-[var(--color-text-secondary)] shadow-sm hover:bg-[var(--color-bg-tertiary)]"
        >
          Perf
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] shadow-lg">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <span className="text-xs font-semibold text-[var(--color-text-primary)]">Perf</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLogging(prev => !prev)}
            className="rounded px-2 py-1 text-[10px] hover:bg-[var(--color-bg-tertiary)]"
          >
            {logging ? 'Log: On' : 'Log: Off'}
          </button>
          <button
            onClick={handleClear}
            className="rounded px-2 py-1 text-[10px] hover:bg-[var(--color-bg-tertiary)]"
          >
            Clear
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded px-2 py-1 text-[10px] hover:bg-[var(--color-bg-tertiary)]"
          >
            Close
          </button>
        </div>
      </div>

      <div className="px-3 py-2 text-[11px]">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Jump</div>
            <div className="font-semibold text-[var(--color-text-primary)]">
              {formatValue(latestByName.get('measure:jump'))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Diff</div>
            <div className="font-semibold text-[var(--color-text-primary)]">
              {formatValue(latestByName.get('measure:diff'))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)]">View</div>
            <div className="font-semibold text-[var(--color-text-primary)]">
              {formatValue(latestByName.get('measure:view'))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)]">FPS</div>
            <div className="font-semibold text-[var(--color-text-primary)]">
              {formatValue(latestByName.get('fps'))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Longtask</div>
            <div className="font-semibold text-[var(--color-text-primary)]">
              {formatValue(latestByName.get('longtask'))}
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-[var(--color-border)] pt-2">
          <div className="mb-1 text-[10px] text-[var(--color-text-muted)]">Recent</div>
          <div className="space-y-1">
            {recent.length === 0 && (
              <div className="text-[10px] text-[var(--color-text-muted)]">No records</div>
            )}
            {recent.map((record, index) => (
              <div
                key={`${record.timestamp}-${record.name}-${index}`}
                className="flex items-center justify-between"
              >
                <span className="truncate">
                  {record.name.replace('measure:', '')}
                </span>
                <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">
                  {record.value.toFixed(1)}
                  {record.unit} · {formatAge(record.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
