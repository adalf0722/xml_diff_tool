import { useEffect } from 'react';
import { X, BookOpen, Layers, FileText, Download, Sparkles, Keyboard, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUseSample: () => void;
}

export function HelpDrawer({
  isOpen,
  onClose,
  onUseSample,
}: HelpDrawerProps) {
  const { t } = useLanguage();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.helpTitle}
        className="absolute right-0 top-0 h-full w-full max-w-md border-l border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
          <div>
            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <BookOpen size={18} className="text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold">{t.helpTitle}</h2>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t.helpSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
            aria-label={t.close}
          >
            <X size={16} />
          </button>
        </div>

        <div className="h-[calc(100%-140px)] overflow-y-auto p-4 space-y-5">
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 p-4">
            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <Sparkles size={16} className="text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold">{t.helpQuickStartTitle}</h3>
            </div>
            <ol className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li>1. {t.helpQuickStep1}</li>
              <li>2. {t.helpQuickStep2}</li>
              <li>3. {t.helpQuickStep3}</li>
            </ol>
          </section>

          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 p-4">
            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <Layers size={16} className="text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold">{t.helpViewsTitle}</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li>
                <span className="font-semibold text-[var(--color-text-primary)]">{t.sideBySide}</span>
                <span className="ml-2">{t.helpViewSide}</span>
              </li>
              <li>
                <span className="font-semibold text-[var(--color-text-primary)]">{t.inline}</span>
                <span className="ml-2">{t.helpViewInline}</span>
              </li>
              <li>
                <span className="font-semibold text-[var(--color-text-primary)]">{t.treeView}</span>
                <span className="ml-2">{t.helpViewTree}</span>
              </li>
            </ul>
          </section>

          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 p-4">
            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <Keyboard size={16} className="text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold">{t.helpShortcutsTitle}</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li>{t.helpShortcutPrevNext}</li>
              <li>{t.helpShortcutChunkNav}</li>
              <li>{t.helpShortcutEscape}</li>
            </ul>
          </section>

          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 p-4">
            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <AlertTriangle size={16} className="text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold">{t.helpLargeFileLimitTitle}</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li>{t.helpLargeFileLimitHighlight}</li>
              <li>{t.helpLargeFileLimitCollapsed}</li>
              <li>{t.helpLargeFileLimitProgressive}</li>
              <li>{t.helpLargeFileLimitOverride}</li>
            </ul>
          </section>

          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 p-4">
            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <Download size={16} className="text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold">{t.helpReportsTitle}</h3>
            </div>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {t.helpReportsDesc}
            </p>
          </section>

          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 p-4">
            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <FileText size={16} className="text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold">{t.helpTipsTitle}</h3>
            </div>
            <ul className="mt-2 space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li>{t.helpTipLargeFiles}</li>
              <li>{t.helpTipChunks}</li>
            </ul>
          </section>
        </div>

        <div className="border-t border-[var(--color-border)] p-4">
          <button
            type="button"
            onClick={onUseSample}
            className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            {t.emptyUseSample}
          </button>
        </div>
      </div>
    </div>
  );
}
