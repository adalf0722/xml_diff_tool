/**
 * View Tabs Component
 * Tab navigation for different diff views
 */

import { Columns, AlignLeft, GitBranch } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export type ViewMode = 'side-by-side' | 'inline' | 'tree';

interface ViewTabsProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewTabs({ activeView, onViewChange }: ViewTabsProps) {
  const { t } = useLanguage();

  const tabs: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'side-by-side', label: t.sideBySide, icon: <Columns size={16} /> },
    { id: 'inline', label: t.inline, icon: <AlignLeft size={16} /> },
    { id: 'tree', label: t.treeView, icon: <GitBranch size={16} /> },
  ];

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onViewChange(tab.id)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${
              activeView === tab.id
                ? 'bg-[var(--color-accent)] text-white shadow-md shadow-[var(--color-accent)]/25'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }
          `}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
