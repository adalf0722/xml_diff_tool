/**
 * Diff Navigation Component
 * Provides prev/next navigation between differences
 */

import { useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface DiffNavigationProps {
  currentIndex: number;
  totalDiffs: number;
  onNavigate: (index: number) => void;
}

export function DiffNavigation({
  currentIndex,
  totalDiffs,
  onNavigate,
}: DiffNavigationProps) {
  const { t } = useLanguage();

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    } else {
      // Wrap around to the last diff
      onNavigate(totalDiffs - 1);
    }
  }, [currentIndex, totalDiffs, onNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex < totalDiffs - 1) {
      onNavigate(currentIndex + 1);
    } else {
      // Wrap around to the first diff
      onNavigate(0);
    }
  }, [currentIndex, totalDiffs, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Don't trigger if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === 'p' || event.key === 'P') {
        event.preventDefault();
        handlePrevious();
      } else if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        handleNext();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevious, handleNext]);

  if (totalDiffs === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <button
        onClick={handlePrevious}
        className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors text-[var(--color-text-secondary)]"
        title={`${t.previousDiff} (P)`}
      >
        <ChevronUp size={16} />
      </button>
      
      <span className="text-xs font-medium text-[var(--color-text-muted)] min-w-[60px] text-center">
        {currentIndex + 1} / {totalDiffs}
      </span>
      
      <button
        onClick={handleNext}
        className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors text-[var(--color-text-secondary)]"
        title={`${t.nextDiff} (N)`}
      >
        <ChevronDown size={16} />
      </button>

      <span className="text-[10px] text-[var(--color-text-muted)] ml-1">
        (P/N)
      </span>
    </div>
  );
}

