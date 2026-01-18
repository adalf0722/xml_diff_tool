/**
 * View Tabs Component
 * Tab navigation for different diff views
 */

import { Columns, AlignLeft, GitBranch, Table } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export type ViewMode = 'side-by-side' | 'inline' | 'tree' | 'schema';

interface ViewTabsProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  compact?: boolean;
  className?: string;
}

export function ViewTabs({ activeView, onViewChange, compact = false, className = '' }: ViewTabsProps) {
  const { t } = useLanguage();

  const tabs: { id: ViewMode; label: string; hint: string; icon: React.ReactNode }[] = [
    { id: 'side-by-side', label: t.sideBySide, hint: t.helpViewSide, icon: <Columns size={16} /> },
    { id: 'inline', label: t.inline, hint: t.helpViewInline, icon: <AlignLeft size={16} /> },
    { id: 'tree', label: t.treeView, hint: t.helpViewTree, icon: <GitBranch size={16} /> },
    { id: 'schema', label: t.schemaView, hint: t.helpViewSchema, icon: <Table size={16} /> },
  ];

  const containerClass = compact
    ? 'flex items-center gap-1'
    : 'flex items-center gap-1 px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]';

  const tabBaseClass = compact
    ? 'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all'
    : 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all';
  const tabActiveClass = compact
    ? 'bg-[var(--color-accent)]/80 text-white ring-1 ring-[var(--color-accent)]/30'
    : 'bg-[var(--color-accent)] text-white shadow-md shadow-[var(--color-accent)]/25';
  const tabInactiveClass = compact
    ? 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]';

  return (
    <div className={`${containerClass} ${className}`.trim()}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onViewChange(tab.id)}
          title={tab.hint}
          aria-label={`${tab.label} - ${tab.hint}`}
          className={`${tabBaseClass} ${activeView === tab.id ? tabActiveClass : tabInactiveClass}`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
