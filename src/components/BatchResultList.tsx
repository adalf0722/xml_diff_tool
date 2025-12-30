/**
 * Batch Result List Component
 * Displays the results of batch comparison
 */

import { useState, useCallback } from 'react';
import { 
  Check, 
  X, 
  AlertCircle, 
  FileText, 
  ChevronRight,
  ArrowLeft,
  Plus,
  Minus,
  RefreshCw
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type { BatchResultItem } from '../hooks/useDiffWorker';
import type { MatchedFilePair } from '../utils/file-matcher';
import { SideBySideView } from './SideBySideView';
import type { DiffType } from '../core/xml-diff';
import { computeLineLevelStats } from '../utils/line-diff-stats';

interface BatchResultListProps {
  matchResults: MatchedFilePair[];
  diffResults: BatchResultItem[];
  onReset: () => void;
  xmlContentsA: Map<string, string>;
  xmlContentsB: Map<string, string>;
}

type ViewState = 
  | { type: 'list' }
  | { type: 'detail'; item: BatchResultItem; pair: MatchedFilePair };

export function BatchResultList({ 
  matchResults, 
  diffResults, 
  onReset,
  xmlContentsA,
  xmlContentsB,
}: BatchResultListProps) {
  const { t } = useLanguage();
  const [viewState, setViewState] = useState<ViewState>({ type: 'list' });
  const [activeFilters] = useState<Set<DiffType>>(new Set(['added', 'removed', 'modified']));

  // Create a map of diff results by id
  const diffMap = new Map<string, BatchResultItem>();
  for (const result of diffResults) {
    diffMap.set(result.id, result);
  }

  // Stats
  const successCount = diffResults.filter(r => r.success).length;
  const failedCount = diffResults.filter(r => !r.success).length;
  const noDiffCount = diffResults.filter(r => r.success && r.summary && 
    r.summary.added === 0 && r.summary.removed === 0 && r.summary.modified === 0
  ).length;
  const hasDiffCount = successCount - noDiffCount;

  const handleViewDetail = useCallback((pair: MatchedFilePair) => {
    const diffResult = diffMap.get(pair.id);
    if (diffResult) {
      setViewState({ type: 'detail', item: diffResult, pair });
    }
  }, [diffMap]);

  const handleBack = useCallback(() => {
    setViewState({ type: 'list' });
  }, []);

  // Detail view
  if (viewState.type === 'detail') {
    const { item, pair } = viewState;
    // Try to get content from map first, fallback to pair's content
    const keyA = pair.fileA?.name.toLowerCase();
    const keyB = pair.fileB?.name.toLowerCase();
    
    const xmlA = pair.fileA 
      ? (xmlContentsA.get(keyA!) || pair.fileA.content || '')
      : '';
    const xmlB = pair.fileB 
      ? (xmlContentsB.get(keyB!) || pair.fileB.content || '')
      : '';

    // Calculate line-level stats directly (not using useMemo to avoid Hooks rules violation)
    const lineLevelStats = (xmlA && xmlB) 
      ? computeLineLevelStats(xmlA, xmlB)
      : { added: 0, removed: 0, modified: 0 };

    return (
      <div className="flex flex-col gap-4">
        {/* Back button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft size={16} />
            {t.backToList}
          </button>
          <span className="text-[var(--color-text-primary)] font-medium">
            {pair.name}
          </span>
        </div>

        {/* Diff summary for this file - use line-level stats to match display */}
        <div className="flex items-center gap-4 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
          <span className="flex items-center gap-1.5 text-green-400">
            <Plus size={14} />
            {lineLevelStats.added}
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <Minus size={14} />
            {lineLevelStats.removed}
          </span>
          <span className="flex items-center gap-1.5 text-yellow-400">
            <RefreshCw size={14} />
            {lineLevelStats.modified}
          </span>
        </div>

        {/* Diff view */}
        <div className="h-[70vh] min-h-[420px] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <SideBySideView
            xmlA={xmlA}
            xmlB={xmlB}
            diffResults={item.results || []}
            activeFilters={activeFilters}
          />
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t.batchResults}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors"
          >
            <ArrowLeft size={14} />
            {t.backToList}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-[var(--color-text-secondary)]" />
          <span className="text-[var(--color-text-primary)] font-medium">
            {matchResults.length} {t.filesCompared}
          </span>
        </div>
        <div className="flex items-center gap-4 ml-auto text-sm">
          <span className="flex items-center gap-1.5 text-green-400">
            <Check size={14} />
            {noDiffCount} {t.noDiff}
          </span>
          <span className="flex items-center gap-1.5 text-yellow-400">
            <AlertCircle size={14} />
            {hasDiffCount} {t.hasDiff}
          </span>
          {failedCount > 0 && (
            <span className="flex items-center gap-1.5 text-red-400">
              <X size={14} />
              {failedCount} {t.failed}
            </span>
          )}
        </div>
      </div>

      {/* Results list */}
      <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">
                {t.xmlFiles}
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-secondary)] w-24">
                {t.added}
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-secondary)] w-24">
                {t.removed}
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-secondary)] w-24">
                {t.modified}
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-secondary)] w-28">
                Status
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)] w-24">
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {matchResults.map((pair) => {
              const diffResult = diffMap.get(pair.id);
              const isSuccess = diffResult?.success;
              
              // Calculate line-level stats for matched files (consistent with detail view)
              let summary = diffResult?.summary;
              if (isSuccess && pair.status === 'matched' && pair.fileA && pair.fileB) {
                const keyA = pair.fileA.name.toLowerCase();
                const keyB = pair.fileB.name.toLowerCase();
                const xmlA = xmlContentsA.get(keyA) || pair.fileA.content || '';
                const xmlB = xmlContentsB.get(keyB) || pair.fileB.content || '';
                
                if (xmlA && xmlB) {
                  const lineStats = computeLineLevelStats(xmlA, xmlB);
                  summary = {
                    added: lineStats.added,
                    removed: lineStats.removed,
                    modified: lineStats.modified,
                    unchanged: lineStats.unchanged,
                    total: lineStats.added + lineStats.removed + lineStats.modified + lineStats.unchanged,
                  };
                }
              }
              
              const hasDiff = summary && (summary.added > 0 || summary.removed > 0 || summary.modified > 0);
              
              return (
                <tr 
                  key={pair.id}
                  className="hover:bg-[var(--color-bg-tertiary)]/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-[var(--color-text-secondary)]" />
                      <span className="text-[var(--color-text-primary)]">{pair.name}</span>
                      {pair.status === 'only-in-a' && (
                        <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                          {t.onlyInA}
                        </span>
                      )}
                      {pair.status === 'only-in-b' && (
                        <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                          {t.onlyInB}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isSuccess && summary ? (
                      <span className={summary.added > 0 ? 'text-green-400 font-medium' : 'text-[var(--color-text-tertiary)]'}>
                        {summary.added}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isSuccess && summary ? (
                      <span className={summary.removed > 0 ? 'text-red-400 font-medium' : 'text-[var(--color-text-tertiary)]'}>
                        {summary.removed}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isSuccess && summary ? (
                      <span className={summary.modified > 0 ? 'text-yellow-400 font-medium' : 'text-[var(--color-text-tertiary)]'}>
                        {summary.modified}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!diffResult ? (
                      <span className="text-[var(--color-text-tertiary)]">-</span>
                    ) : !isSuccess ? (
                      <span 
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded cursor-help"
                        title={diffResult.error || 'Unknown error'}
                      >
                        <X size={12} />
                        {t.failed}
                      </span>
                    ) : hasDiff ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                        <AlertCircle size={12} />
                        {t.hasDiff}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                        <Check size={12} />
                        {t.noDiff}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isSuccess && pair.status === 'matched' && (
                      <button
                        onClick={() => handleViewDetail(pair)}
                        className="flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline ml-auto"
                      >
                        {t.viewDetails}
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BatchResultList;

