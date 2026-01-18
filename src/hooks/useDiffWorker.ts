/**
 * React Hook for Web Worker-based XML Diff
 * Manages worker lifecycle and provides async diff operations
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import type { DiffResult, DiffSummary, UnifiedDiffLine } from '../core/xml-diff';
import type { ParseResult } from '../core/xml-parser';
import type { LineDiffOp } from '../utils/line-diff';
import type { LineLevelStats } from '../utils/line-diff-stats';

// Worker message types (matching diff-worker.ts)
interface WorkerRequest {
  id: string;
  type: 'diff' | 'parse' | 'batch-diff';
  payload: unknown;
}

interface WorkerResponse {
  id: string;
  type: 'diff-result' | 'parse-result' | 'batch-progress' | 'batch-complete' | 'single-diff-progress' | 'error';
  payload: unknown;
}

interface DiffResultPayload {
  results: DiffResult[];
  summary: DiffSummary;
  parseA: ParseResult;
  parseB: ParseResult;
  lineDiff: LineDiffPayload;
}

// BatchProgressPayload type from worker (used for internal typing)

interface BatchResultItem {
  id: string;
  name: string;
  success: boolean;
  error?: string;
  results?: DiffResult[];
  summary?: DiffSummary;
}

interface BatchCompletePayload {
  results: BatchResultItem[];
}

interface BatchFileInput {
  id: string;
  name: string;
  xmlA: string;
  xmlB: string;
}

interface BatchProgress {
  completed: number;
  total: number;
  currentFile: string;
}

interface SingleDiffProgress {
  stage: 'parsing-a' | 'parsing-b' | 'computing-line-diff' | 'computing-diff' | 'done';
  progress: number; // 0-100
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: BatchProgress | SingleDiffProgress) => void;
};

export interface InlineLineStats {
  added: number;
  removed: number;
  unchanged: number;
  total: number;
}

export interface LineDiffPayload {
  ops: LineDiffOp[];
  inlineLines: UnifiedDiffLine[];
  inlineStats: InlineLineStats;
  sideBySideStats: LineLevelStats;
  inlineDiffCount: number;
  formattedXmlA: string;
  formattedXmlB: string;
  isCoarse: boolean;
}

/**
 * Hook to manage a Web Worker for XML diff operations
 */
export function useDiffWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRequests = useRef<Map<string, PendingRequest>>(new Map());
  const [isReady, setIsReady] = useState(false);
  const requestIdCounter = useRef(0);

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/diff-worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, type, payload } = event.data;
      const pending = pendingRequests.current.get(id);

      if (!pending && type !== 'batch-progress' && type !== 'single-diff-progress') {
        console.warn('Received response for unknown request:', id);
        return;
      }

      switch (type) {
        case 'diff-result':
        case 'parse-result':
          pending?.resolve(payload);
          pendingRequests.current.delete(id);
          break;

        case 'batch-progress':
          pending?.onProgress?.(payload as BatchProgress);
          break;

        case 'single-diff-progress':
          pending?.onProgress?.(payload as SingleDiffProgress);
          break;

        case 'batch-complete':
          pending?.resolve(payload);
          pendingRequests.current.delete(id);
          break;

        case 'error':
          pending?.reject(new Error((payload as { message: string }).message));
          pendingRequests.current.delete(id);
          break;
      }
    };

    worker.onerror = (error) => {
      console.error('Worker error:', error);
      // Reject all pending requests
      for (const [id, pending] of pendingRequests.current.entries()) {
        pending.reject(new Error(error.message || 'Worker error'));
        pendingRequests.current.delete(id);
      }
    };

    workerRef.current = worker;
    setIsReady(true);

    return () => {
      worker.terminate();
      workerRef.current = null;
      setIsReady(false);
    };
  }, []);

  // Generate unique request ID
  const generateId = useCallback(() => {
    return `req-${Date.now()}-${requestIdCounter.current++}`;
  }, []);

  // Send request to worker
  const sendRequest = useCallback(<T>(
    type: WorkerRequest['type'],
    payload: unknown,
    onProgress?: (progress: BatchProgress | SingleDiffProgress) => void
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = generateId();
      pendingRequests.current.set(id, { 
        resolve: resolve as (value: unknown) => void, 
        reject,
        onProgress 
      });

      workerRef.current.postMessage({
        id,
        type,
        payload,
      } as WorkerRequest);
    });
  }, [generateId]);

  // Public API: Compute diff between two XML strings
  const computeDiff = useCallback(async (
    xmlA: string,
    xmlB: string,
    onProgress?: (progress: SingleDiffProgress) => void,
    options?: { strictMode?: boolean }
  ): Promise<DiffResultPayload> => {
    return sendRequest<DiffResultPayload>(
      'diff',
      { xmlA, xmlB, strictMode: options?.strictMode },
      onProgress as (progress: BatchProgress | SingleDiffProgress) => void
    );
  }, [sendRequest]);

  // Public API: Parse a single XML string
  const parseXML = useCallback(async (
    xml: string,
    options?: { strictMode?: boolean }
  ): Promise<ParseResult> => {
    return sendRequest<ParseResult>('parse', { xml, strictMode: options?.strictMode });
  }, [sendRequest]);

  // Public API: Batch diff multiple file pairs
  const batchDiff = useCallback(async (
    files: BatchFileInput[],
    onProgress?: (progress: BatchProgress) => void
  ): Promise<BatchCompletePayload> => {
    return sendRequest<BatchCompletePayload>('batch-diff', { files }, onProgress as (progress: BatchProgress | SingleDiffProgress) => void);
  }, [sendRequest]);

  // Cancel all pending requests
  const cancelAll = useCallback(() => {
    for (const [id, pending] of pendingRequests.current.entries()) {
      pending.reject(new Error('Request cancelled'));
      pendingRequests.current.delete(id);
    }
  }, []);

  return {
    isReady,
    computeDiff,
    parseXML,
    batchDiff,
    cancelAll,
  };
}

/**
 * Export types for consumers
 */
export type { 
  DiffResultPayload, 
  BatchProgress, 
  BatchResultItem, 
  BatchCompletePayload,
  BatchFileInput,
  SingleDiffProgress
};

