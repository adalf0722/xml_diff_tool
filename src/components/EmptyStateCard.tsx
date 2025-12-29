import { FileText, Layers, Download, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface EmptyStateCardProps {
  onUseSample: () => void;
  onOpenHelp: () => void;
}

export function EmptyStateCard({ onUseSample, onOpenHelp }: EmptyStateCardProps) {
  const { t } = useLanguage();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/90 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
      <div className="absolute -right-16 -top-10 h-40 w-40 rounded-full bg-[var(--color-accent)]/15 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-16 w-2/3 bg-gradient-to-r from-[var(--color-accent)]/20 to-transparent" />
      <div className="relative space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <Sparkles size={18} className="text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold">{t.emptyTitle}</h2>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t.emptySubtitle}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck size={12} className="text-[var(--color-accent)]" />
                {t.emptyPrivacyNote}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 min-w-[200px]">
            <button
              type="button"
              onClick={onUseSample}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              {t.emptyUseSample}
            </button>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {t.emptySampleHint}
            </span>
            <button
              type="button"
              onClick={onOpenHelp}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              {t.emptyOpenHelp}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-bg-primary)]/55 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-white shadow-sm">
              1
            </span>
            <div>
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <FileText size={16} className="text-[var(--color-accent)]" />
                <span className="text-[10px] uppercase tracking-wide">{t.emptyStepLabel}</span>
              </div>
              <div className="text-base font-semibold text-[var(--color-text-primary)]">{t.emptyStep1}</div>
            </div>
          </div>
          <ArrowRight size={18} className="hidden text-[var(--color-text-muted)] sm:block" />
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-white shadow-sm">
              2
            </span>
            <div>
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <Layers size={16} className="text-[var(--color-accent)]" />
                <span className="text-[10px] uppercase tracking-wide">{t.emptyStepLabel}</span>
              </div>
              <div className="text-base font-semibold text-[var(--color-text-primary)]">{t.emptyStep2}</div>
            </div>
          </div>
          <ArrowRight size={18} className="hidden text-[var(--color-text-muted)] sm:block" />
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-white shadow-sm">
              3
            </span>
            <div>
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <Download size={16} className="text-[var(--color-accent)]" />
                <span className="text-[10px] uppercase tracking-wide">{t.emptyStepLabel}</span>
              </div>
              <div className="text-base font-semibold text-[var(--color-text-primary)]">{t.emptyStep3}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
