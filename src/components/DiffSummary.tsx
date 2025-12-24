/**
 * Diff Summary Component
 * Shows statistics about differences with clickable filter badges and download button
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import { Plus, Minus, RefreshCw, Equal, Download, ChevronDown, RotateCcw } from 'lucide-react';
import { getDiffSummary, generateLineDiff } from '../core/xml-diff';
import type { DiffResult, DiffType } from '../core/xml-diff';
import { useLanguage } from '../contexts/LanguageContext';
import { generateDiffReport } from '../utils/diff-report';
import type { ViewMode } from './ViewTabs';
import { prettyPrintXML } from '../utils/pretty-print';

interface LineLevelStats {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  total: number;
}

interface DiffSummaryProps {
  diffResults: DiffResult[];
  activeFilters: Set<DiffType>;
  onFilterToggle: (type: DiffType) => void;
  onReset: () => void;
  xmlA: string;
  xmlB: string;
  activeView: ViewMode;
  lineLevelStats: LineLevelStats;
  inlineStats?: { added: number; removed: number; unchanged: number; total: number } | null;
}

export function DiffSummary({
  diffResults,
  activeFilters,
  onFilterToggle,
  onReset,
  xmlA,
  xmlB,
  activeView,
  lineLevelStats,
  inlineStats: inlineStatsProp,
}: DiffSummaryProps) {
  const { t } = useLanguage();
  const nodeSummary = useMemo(() => getDiffSummary(diffResults), [diffResults]);
  
  // Use line-level stats for side-by-side and inline views, node-level for tree view
  const isLineBasedView = activeView === 'inline' || activeView === 'side-by-side';

   // Inline view uses unified diff: no "modified" classification, only added/removed/context
  const inlineStats = useMemo(() => {
    if (inlineStatsProp || activeView !== 'inline') return null;
    const formattedA = prettyPrintXML(xmlA);
    const formattedB = prettyPrintXML(xmlB);
    const diff = generateLineDiff(formattedA, formattedB);
    let added = 0, removed = 0, unchanged = 0;
    diff.forEach(line => {
      if (line.type === 'added') added++;
      else if (line.type === 'removed') removed++;
      else if (line.type === 'context') unchanged++;
    });
    return { added, removed, unchanged, total: added + removed + unchanged };
  }, [activeView, inlineStatsProp, xmlA, xmlB]);
  
  // Check if filters are in default state (all relevant filters selected)
  const isDefaultFilterState = activeFilters.has('added') && 
                               activeFilters.has('removed') && 
                               activeFilters.has('modified');
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const inlineStatsToUse = inlineStatsProp || inlineStats;
  const summary =
    activeView === 'tree'
      ? nodeSummary
      : activeView === 'inline' && inlineStatsToUse
        ? { added: inlineStatsToUse.added, removed: inlineStatsToUse.removed, modified: 0, unchanged: inlineStatsToUse.unchanged, total: inlineStatsToUse.total }
        : { added: lineLevelStats.added, removed: lineLevelStats.removed, modified: lineLevelStats.modified, unchanged: lineLevelStats.unchanged, total: lineLevelStats.total };

  const hasChanges = summary.added > 0 || summary.removed > 0 || summary.modified > 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDownload = (format: 'html' | 'text') => {
    generateDiffReport(diffResults, xmlA, xmlB, format);
    setIsDownloadMenuOpen(false);
  };

  // Unit label for stats
  const unitLabel = isLineBasedView ? t.statsLines : t.statsNodes;

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">
        {t.diffSummary}
        <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)]">
          ({unitLabel})
        </span>
      </span>
      
      <div className="flex items-center gap-2">
        <FilterBadge
          icon={<Plus size={14} />}
          label={t.added}
          count={summary.added}
          type="added"
          isActive={activeFilters.has('added')}
          onToggle={() => onFilterToggle('added')}
          colorClass="text-green-400 bg-green-500/20 border-green-500/40 hover:bg-green-500/30"
          activeClass="ring-2 ring-green-500/50"
        />
        
        <FilterBadge
          icon={<Minus size={14} />}
          label={t.removed}
          count={summary.removed}
          type="removed"
          isActive={activeFilters.has('removed')}
          onToggle={() => onFilterToggle('removed')}
          colorClass="text-red-400 bg-red-500/20 border-red-500/40 hover:bg-red-500/30"
          activeClass="ring-2 ring-red-500/50"
        />
        
        {/* Modified badge - show for all views */}
        <FilterBadge
          icon={<RefreshCw size={14} />}
          label={t.modified}
          count={summary.modified}
          type="modified"
          isActive={activeFilters.has('modified')}
          onToggle={() => onFilterToggle('modified')}
          colorClass="text-yellow-400 bg-yellow-500/20 border-yellow-500/40 hover:bg-yellow-500/30"
          activeClass="ring-2 ring-yellow-500/50"
          disabled={activeView === 'inline'}
          disabledTooltip={t.modifiedNotAvailableInline}
        />

        {/* Unchanged count - display only, not a filter */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border-[var(--color-border)]">
          <Equal size={14} />
          <span className="text-xs font-medium">
            {t.unchanged}: {summary.unchanged}
          </span>
        </div>

        {/* Reset button - only show when not in default state */}
        {!isDefaultFilterState && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            title={t.resetFilters}
          >
            <RotateCcw size={12} />
            {t.resetFilters}
          </button>
        )}
      </div>

      <div className="flex-1" />

      {!hasChanges && summary.total > 0 && (
        <span className="text-sm text-green-400 font-medium">
          {t.noDifferences}
        </span>
      )}

      {summary.total === 0 && (
        <span className="text-sm text-[var(--color-text-muted)]">
          {t.enterXmlToCompare}
        </span>
      )}

      {/* Download button */}
      {hasChanges && (
        <div className="relative" ref={downloadMenuRef}>
          <button
            onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30 transition-colors"
          >
            <Download size={14} />
            <span className="text-xs font-medium">{t.download}</span>
            <ChevronDown
              size={12}
              className={`transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isDownloadMenuOpen && (
            <div className="absolute right-0 top-full mt-1 py-1 w-36 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-lg z-50">
              <button
                onClick={() => handleDownload('html')}
                className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                {t.downloadHtml}
              </button>
              <button
                onClick={() => handleDownload('text')}
                className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                {t.downloadText}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FilterBadgeProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  type: DiffType;
  isActive: boolean;
  onToggle: () => void;
  colorClass: string;
  activeClass: string;
  disabled?: boolean;
  disabledTooltip?: string;
}

function FilterBadge({
  icon,
  label,
  count,
  isActive,
  onToggle,
  colorClass,
  activeClass,
  disabled = false,
  disabledTooltip,
}: FilterBadgeProps) {
  const handleClick = () => {
    if (!disabled) {
      onToggle();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`
        flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all
        ${disabled 
          ? 'opacity-30 cursor-not-allowed line-through' 
          : `cursor-pointer ${colorClass} ${isActive ? activeClass : 'opacity-40'}`
        }
      `}
      title={disabled ? disabledTooltip : (isActive ? `Hide ${label}` : `Show ${label}`)}
    >
      {icon}
      <span className="text-xs font-medium">
        {label}: {count}
      </span>
    </button>
  );
}
