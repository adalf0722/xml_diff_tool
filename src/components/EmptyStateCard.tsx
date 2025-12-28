import { FileText, Layers, Download, Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface EmptyStateCardProps {
  onUseSample: () => void;
  onOpenHelp: () => void;
}

export function EmptyStateCard({ onUseSample, onOpenHelp }: EmptyStateCardProps) {
  const { t } = useLanguage();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/80 p-6 shadow-sm">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_var(--color-accent)_0%,_transparent_55%)] opacity-10" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
            <Sparkles size={18} className="text-[var(--color-accent)]" />
            <h2 className="text-lg font-semibold">{t.emptyTitle}</h2>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {t.emptySubtitle}
          </p>
          <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)]">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-xs font-semibold text-[var(--color-text-muted)]">
                1
              </span>
              <FileText size={16} className="text-[var(--color-accent)]" />
              <span>{t.emptyStep1}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-xs font-semibold text-[var(--color-text-muted)]">
                2
              </span>
              <Layers size={16} className="text-[var(--color-accent)]" />
              <span>{t.emptyStep2}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-xs font-semibold text-[var(--color-text-muted)]">
                3
              </span>
              <Download size={16} className="text-[var(--color-accent)]" />
              <span>{t.emptyStep3}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 min-w-[180px]">
          <button
            type="button"
            onClick={onUseSample}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            {t.emptyUseSample}
          </button>
          <button
            type="button"
            onClick={onOpenHelp}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            {t.emptyOpenHelp}
          </button>
        </div>
      </div>
    </div>
  );
}
