type PerfUnit = 'ms' | 'fps';

export interface PerfRecord {
  name: string;
  value: number;
  unit: PerfUnit;
  timestamp: number;
  meta?: Record<string, unknown>;
}

const records: PerfRecord[] = [];
const listeners = new Set<(record: PerfRecord) => void>();
const maxRecords = 200;
let loggingEnabled = false;

function pushRecord(record: PerfRecord) {
  records.push(record);
  if (records.length > maxRecords) {
    records.shift();
  }
  listeners.forEach(listener => listener(record));
  if (loggingEnabled) {
    const meta = record.meta ? ` ${JSON.stringify(record.meta)}` : '';
    console.debug(`[perf] ${record.name}: ${record.value.toFixed(1)}${record.unit}${meta}`);
  }
}

export function recordValue(
  name: string,
  value: number,
  unit: PerfUnit,
  meta?: Record<string, unknown>
): PerfRecord {
  const record: PerfRecord = {
    name,
    value,
    unit,
    timestamp: Date.now(),
    meta,
  };
  pushRecord(record);
  return record;
}

export function markPerf(name: string): void {
  if (typeof performance === 'undefined' || !performance.mark) return;
  performance.mark(name);
}

export function measurePerf(
  name: string,
  startMark: string,
  endMark: string,
  meta?: Record<string, unknown>
): PerfRecord | null {
  if (typeof performance === 'undefined' || !performance.measure) return null;
  if (performance.getEntriesByName(startMark).length === 0) return null;
  if (performance.getEntriesByName(endMark).length === 0) return null;

  performance.measure(name, startMark, endMark);
  const entries = performance.getEntriesByName(name);
  const entry = entries[entries.length - 1];
  if (!entry) return null;
  return recordValue(name, entry.duration, 'ms', meta);
}

export function clearMarks(names: string[]): void {
  if (typeof performance === 'undefined' || !performance.clearMarks) return;
  names.forEach(name => performance.clearMarks(name));
}

export function clearMeasures(name: string): void {
  if (typeof performance === 'undefined' || !performance.clearMeasures) return;
  performance.clearMeasures(name);
}

export function getPerfRecords(): PerfRecord[] {
  return [...records];
}

export function clearPerfRecords(): void {
  records.length = 0;
}

export function onPerfRecord(listener: (record: PerfRecord) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setPerfLoggingEnabled(enabled: boolean): void {
  loggingEnabled = enabled;
}

export function startFpsMonitor(
  onSample: (fps: number) => void,
  sampleMs = 1000
): () => void {
  if (typeof performance === 'undefined' || typeof requestAnimationFrame === 'undefined') {
    return () => {};
  }

  let rafId = 0;
  let lastTime = performance.now();
  let frames = 0;

  const tick = (now: number) => {
    frames += 1;
    const elapsed = now - lastTime;
    if (elapsed >= sampleMs) {
      const fps = (frames * 1000) / elapsed;
      onSample(fps);
      frames = 0;
      lastTime = now;
    }
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

export function startLongTaskObserver(
  onEntry: (entry: PerformanceEntry) => void,
  minDurationMs = 50
): () => void {
  if (typeof PerformanceObserver === 'undefined') return () => {};

  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (entry.duration >= minDurationMs) {
        onEntry(entry);
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['longtask'] });
  } catch {
    return () => {};
  }

  return () => observer.disconnect();
}

if (typeof window !== 'undefined') {
  (window as any).__XML_DIFF_PERF__ = {
    getRecords: getPerfRecords,
    clearRecords: clearPerfRecords,
    setLoggingEnabled: setPerfLoggingEnabled,
  };
}
