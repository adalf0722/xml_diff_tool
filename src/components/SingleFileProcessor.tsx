/**
 * Single File Processor Component
 * Displays progress during single file XML comparison
 */

import { X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type { SingleDiffProgress } from '../hooks/useDiffWorker';

interface SingleFileProcessorProps {
  progress: SingleDiffProgress | null;
  onCancel?: () => void;
}

export function SingleFileProcessor({ progress, onCancel }: SingleFileProcessorProps) {
  const { t } = useLanguage();
  
  const currentProgress = progress?.progress || 0;
  const stage = progress?.stage || 'parsing-a';
  const isDone = stage === 'done';
  
  // Get stage description
  const getStageText = () => {
    switch (stage) {
      case 'parsing-a':
        return t.parsingXMLA || 'Parsing XML A...';
      case 'parsing-b':
        return t.parsingXMLB || 'Parsing XML B...';
      case 'computing-line-diff':
        return t.computingLineDiff || 'Computing line diff...';
      case 'computing-diff':
        return t.computingDiff || 'Computing differences...';
      case 'done':
        return t.completed || 'Completed';
      default:
        return t.processing || 'Processing...';
    }
  };

  return (
    <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {isDone ? (t.completed || 'Completed') : (t.processing || 'Processing...')}
        </h3>
        {onCancel && !isDone && (
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors"
          >
            <X size={12} />
            {t.cancel || 'Cancel'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[var(--color-text-secondary)]">
              {getStageText()}
            </span>
            <span className="text-xs font-medium text-[var(--color-text-primary)]">
              {Math.round(currentProgress)}%
            </span>
          </div>
          <div className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SingleFileProcessor;

