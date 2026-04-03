import { FileText, Layers, Download, Sparkles, ShieldCheck, ArrowRight, Wand2, ScanSearch, LayoutTemplate } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface EmptyStateCardProps {
  onUseSample: () => void;
  onStartEditing: () => void;
  onOpenHelp: () => void;
}

export function EmptyStateCard({ onUseSample, onStartEditing, onOpenHelp }: EmptyStateCardProps) {
  const { t } = useLanguage();
  const featureChips = [
    t.emptyPrivacyNote,
    `${t.singleMode} / ${t.batchMode}`,
    `${t.sideBySide} / ${t.inline} / ${t.treeView} / ${t.schemaView}`,
  ];

  const quickStats = [
    { value: '100%', label: t.emptyPrivacyNote },
    { value: '4', label: t.helpViewsTitle },
    { value: '2', label: `${t.singleMode} + ${t.batchMode}` },
  ];

  return (
    <div className="hero-shell relative flex h-full min-h-0 w-full overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.92))] p-5 shadow-[0_28px_80px_rgba(2,6,23,0.45)] ring-1 ring-white/5 lg:p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="hero-orb absolute -left-12 top-10 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="hero-orb hero-orb-delay absolute right-0 top-0 h-56 w-56 rounded-full bg-[var(--color-accent)]/18 blur-3xl" />
      <div className="hero-orb absolute bottom-0 left-1/3 h-40 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-y-10 left-[14%] hidden w-px bg-gradient-to-b from-transparent via-white/8 to-transparent xl:block" />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="grid min-h-0 flex-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1.35fr)_320px]">
          <div className="flex min-h-0 flex-col justify-between gap-4">
            <div className="hero-enter hero-enter-1 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent-hover)]">
              <Sparkles size={14} className="text-[var(--color-accent)]" />
              XML Workflow
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                <ShieldCheck size={18} className="text-[var(--color-accent)]" />
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">{t.emptyPrivacyNote}</span>
              </div>
              <div className="max-w-3xl space-y-2.5">
                <h2 className="max-w-2xl text-2xl font-bold tracking-[-0.04em] text-white md:text-[2rem]">
                  {t.emptyTitle}
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                  {t.emptySubtitle} {t.helpSubtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {featureChips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
                >
                  {chip}
                </span>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {quickStats.map((item) => (
                <div key={item.label} className="hero-enter hero-enter-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 backdrop-blur-sm">
                  <div className="text-2xl font-bold tracking-[-0.04em] text-white">{item.value}</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="hero-enter hero-enter-3 relative hidden overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-3.5 xl:block">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(99,102,241,0.12),transparent_40%)]" />
              <div className="relative grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
                <div className="space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                    XML Snapshot
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/15 p-3 font-mono text-[10px] leading-5.5 text-sky-100/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="text-fuchsia-200">&lt;bookstore&gt;</div>
                    <div className="pl-4 text-sky-200">&lt;book category=<span className="text-emerald-300">"fiction"</span>&gt;</div>
                    <div className="pl-8 text-white/85">&lt;title&gt;<span className="text-amber-200">The Great Gatsby</span>&lt;/title&gt;</div>
                    <div className="pl-8 text-white/85">&lt;price&gt;<span className="rounded bg-emerald-500/15 px-1 text-emerald-300">12.99</span>&lt;/price&gt;</div>
                    <div className="pl-8 text-white/70">&lt;isbn&gt;<span className="rounded bg-indigo-500/15 px-1 text-indigo-200">978-0062316097</span>&lt;/isbn&gt;</div>
                    <div className="pl-4 text-sky-200">&lt;/book&gt;</div>
                    <div className="text-fuchsia-200">&lt;/bookstore&gt;</div>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                    Compare Focus
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-400/15 bg-emerald-500/8 px-3 py-1.5 text-xs text-emerald-300">
                      + Added node
                    </span>
                    <span className="rounded-full border border-amber-400/15 bg-amber-500/8 px-3 py-1.5 text-xs text-amber-200">
                      ~ Modified value
                    </span>
                    <span className="rounded-full border border-sky-400/15 bg-sky-500/8 px-3 py-1.5 text-xs text-sky-200">
                      = {t.sideBySide}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/15 p-3 text-[11px] leading-5 text-[var(--color-text-secondary)]">
                    <div className="flex items-center justify-between">
                      <span>{t.helpModeGuideSide}</span>
                    </div>
                    <div className="mt-2 h-px bg-white/8" />
                    <div className="mt-2 flex items-center justify-between">
                      <span>{t.helpModeGuideTree}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>

          <div className="hero-enter hero-enter-2 relative flex h-full min-h-0 flex-col rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(30,41,59,0.88))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
              <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                  {t.helpQuickStartTitle}
                </div>
                <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">
                  {t.emptyUseSample}
                </div>
                <p className="mt-2 text-sm leading-5 text-[var(--color-text-secondary)]">
                  {t.emptySampleHint} {t.emptyPasteHint}
                </p>
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={onStartEditing}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <FileText size={16} />
                  {t.emptyStartNow}
                </button>
                <button
                  type="button"
                  onClick={onUseSample}
                  className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-hover))] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(99,102,241,0.35)] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <Wand2 size={16} />
                  {t.emptyUseSample}
                  <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
                <button
                  type="button"
                  onClick={onOpenHelp}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <ScanSearch size={16} />
                  {t.emptyOpenHelp}
                </button>
              </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/15 p-3.5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-accent)]/16 text-[var(--color-accent)]">
                    <LayoutTemplate size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t.helpModeGuideTitle}</div>
                    <p className="mt-1 text-xs leading-6 text-[var(--color-text-muted)]">
                      {t.helpModeGuideSide} {t.helpModeGuideTree}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-enter hero-enter-4 mt-auto grid gap-3 pt-5 lg:grid-cols-3">
          {[
            { icon: FileText, step: '01', title: t.emptyStep1 },
            { icon: Layers, step: '02', title: t.emptyStep2 },
            { icon: Download, step: '03', title: t.emptyStep3 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="group flex min-h-[118px] flex-col justify-between rounded-[22px] border border-white/8 bg-white/[0.035] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent)]/16 text-[var(--color-accent)]">
                    <Icon size={18} />
                  </div>
                  <span className="text-[11px] font-semibold tracking-[0.22em] text-[var(--color-text-muted)]">
                    {t.emptyStepLabel} {item.step}
                  </span>
                </div>
                <div className="mt-5 text-base font-semibold tracking-[-0.03em] text-white">
                  {item.title}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
