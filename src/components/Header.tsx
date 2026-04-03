/**
 * Header Component
 * App header with title, mode toggle, theme style selector, and language selector
 */

import { useState, useRef, useEffect } from 'react';
import { Code2, Globe, ChevronDown, Palette, FileText, FolderOpen, HelpCircle, Github } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { THEME_STYLES } from '../themes';
import type { ThemeStyle } from '../themes';
import type { Language } from '../i18n/translations';

export type AppMode = 'single' | 'batch';

interface HeaderProps {
  mode?: AppMode;
  onModeChange?: (mode: AppMode) => void;
  onOpenHelp?: () => void;
}

export function Header({ mode = 'single', onModeChange, onOpenHelp }: HeaderProps) {
  const { style, setStyle } = useTheme();
  const { language, setLanguage, t, languageNames, availableLanguages } = useLanguage();
  
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
  
  const langMenuRef = useRef<HTMLDivElement>(null);
  const styleMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
      if (styleMenuRef.current && !styleMenuRef.current.contains(event.target as Node)) {
        setIsStyleMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setIsLangMenuOpen(false);
  };

  const handleStyleChange = (newStyle: ThemeStyle) => {
    setStyle(newStyle);
    setIsStyleMenuOpen(false);
  };

  const githubReadmeUrl =
    language === 'zh-TW'
      ? 'https://github.com/adalf0722/xml_diff_tool/blob/main/README.zh-TW.md'
      : language === 'zh-CN'
        ? 'https://github.com/adalf0722/xml_diff_tool/blob/main/README.zh-CN.md'
        : 'https://github.com/adalf0722/xml_diff_tool/blob/main/README.md';

  // Get localized style name
  const getStyleName = (styleKey: ThemeStyle): string => {
    const styleNames: Record<ThemeStyle, keyof typeof t> = {
      default: 'themeStyleDefault',
      linear: 'themeStyleLinear',
      github: 'themeStyleGitHub',
      supabase: 'themeStyleSupabase',
    };
    return t[styleNames[styleKey]] as string;
  };

  return (
    <header className="relative z-40 border-b border-white/8 bg-[linear-gradient(180deg,rgba(11,14,20,0.92),rgba(11,14,20,0.8))] px-4 py-4 backdrop-blur-xl sm:px-6">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      {/* Logo & Title */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6d5dfc,#8b5cf6_58%,#22d3ee)] shadow-[0_16px_40px_rgba(109,93,252,0.32)] ring-1 ring-white/20">
            <Code2 size={22} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
                {t.appTitle}
              </h1>
              <span className="hidden rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-hover)] sm:inline-flex">
                XML
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {t.appSubtitle}
            </p>
          </div>
        </div>

      {/* Controls */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
        {/* Mode Toggle Group - Primary Actions */}
        {onModeChange && (
            <div className="flex items-center rounded-2xl border border-white/8 bg-white/[0.035] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <button
              onClick={() => onModeChange('single')}
              className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                mode === 'single'
                  ? 'bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-hover))] text-white shadow-[0_12px_24px_rgba(99,102,241,0.28)]'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.05] hover:text-[var(--color-text-primary)]'
              }`}
              title={t.singleMode}
            >
              <FileText size={14} />
              {t.singleMode}
            </button>
            <button
              onClick={() => onModeChange('batch')}
              className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                mode === 'batch'
                  ? 'bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-hover))] text-white shadow-[0_12px_24px_rgba(99,102,241,0.28)]'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.05] hover:text-[var(--color-text-primary)]'
              }`}
              title={t.batchMode}
            >
              <FolderOpen size={14} />
              {t.batchMode}
            </button>
          </div>
        )}

        {onOpenHelp && (
          <button
            onClick={onOpenHelp}
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-white/[0.06]"
            title={t.help}
            aria-label={t.help}
          >
            <HelpCircle size={16} className="text-[var(--color-text-muted)]" />
            <span className="hidden sm:inline">{t.help}</span>
          </button>
        )}

        {/* Settings Group - Preferences */}
          <div className="flex items-center gap-1 rounded-2xl border border-white/8 bg-white/[0.035] px-1 py-1">
          <a
            href={githubReadmeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.06]"
            title="GitHub"
            aria-label="GitHub"
          >
            <Github size={18} className="text-[var(--color-text-muted)]" />
          </a>
          {/* Theme Style Selector */}
          <div className="relative" ref={styleMenuRef}>
          <button
            onClick={() => setIsStyleMenuOpen(!isStyleMenuOpen)}
            className="flex h-10 items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.06]"
            title={t.themeStyle}
          >
            <Palette size={18} className="text-[var(--color-text-muted)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">
              {getStyleName(style)}
            </span>
            <ChevronDown
              size={14}
              className={`text-[var(--color-text-muted)] transition-transform ${
                isStyleMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Style Dropdown Menu */}
          {isStyleMenuOpen && (
            <div className="absolute right-0 top-full z-[70] mt-2 w-44 rounded-2xl border border-white/10 bg-[rgba(11,14,20,0.96)] py-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl">
              {THEME_STYLES.map((styleKey) => (
                <button
                  key={styleKey}
                  onClick={() => handleStyleChange(styleKey)}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-white/[0.06] ${
                    style === styleKey
                      ? 'text-[var(--color-accent)] font-medium'
                      : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  {getStyleName(styleKey)}
                  {style === styleKey && (
                    <span className="ml-2">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Language Selector */}
        <div className="relative" ref={langMenuRef}>
          <button
            onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
            className="flex h-10 items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.06]"
            title={t.language}
          >
            <Globe size={18} className="text-[var(--color-text-muted)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">
              {languageNames[language]}
            </span>
            <ChevronDown
              size={14}
              className={`text-[var(--color-text-muted)] transition-transform ${
                isLangMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Language Dropdown Menu */}
          {isLangMenuOpen && (
            <div className="absolute right-0 top-full z-[70] mt-2 w-44 rounded-2xl border border-white/10 bg-[rgba(11,14,20,0.96)] py-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl">
              {availableLanguages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleLanguageChange(lang)}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-white/[0.06] ${
                    language === lang
                      ? 'text-[var(--color-accent)] font-medium'
                      : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  {languageNames[lang]}
                  {language === lang && (
                    <span className="ml-2">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        </div>{/* End Settings Group */}
      </div>
      </div>
    </header>
  );
}
