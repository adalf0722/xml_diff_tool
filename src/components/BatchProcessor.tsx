/**
 * Batch Processor Component
 * Displays progress during batch XML comparison
 */

import { X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type { BatchProgress } from '../hooks/useDiffWorker';

interface BatchProcessorProps {
  progress: BatchProgress | null;
  onCancel: () => void;
}

export function BatchProcessor({ progress, onCancel }: BatchProcessorProps) {
  const { t } = useLanguage();
  
  const completed = progress?.completed || 0;
  const total = progress?.total || 0;
  const currentFile = progress?.currentFile || '';
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="p-6 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t.processing}
        </h2>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors"
        >
          <X size={14} />
          {t.cancelBatch}
        </button>
      </div>

      <div className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--color-text-secondary)]">
              {completed} / {total} {t.filesCompared}
            </span>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {percentage}%
            </span>
          </div>
          <div className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Current file */}
        {currentFile && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            {t.processingFile.replace('{file}', currentFile)}
          </div>
        )}
      </div>
    </div>
  );
}

export default BatchProcessor;

