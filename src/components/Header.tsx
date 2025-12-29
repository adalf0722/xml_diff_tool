/**
 * Header Component
 * App header with title, mode toggle, theme style selector, and language selector
 */

import { useState, useRef, useEffect } from 'react';
import { Code2, Globe, ChevronDown, Palette, FileText, FolderOpen, HelpCircle } from 'lucide-react';
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
    <header className="flex items-center justify-between px-6 py-4 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)]">
      {/* Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
          <Code2 size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
            {t.appTitle}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t.appSubtitle}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Mode Toggle Group - Primary Actions */}
        {onModeChange && (
          <div className="flex items-center bg-[var(--color-bg-tertiary)]/40 rounded-lg p-1 border border-[var(--color-border)]/60">
            <button
              onClick={() => onModeChange('single')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'single'
                  ? 'bg-[var(--color-accent)] text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
              }`}
              title={t.singleMode}
            >
              <FileText size={14} />
              {t.singleMode}
            </button>
            <button
              onClick={() => onModeChange('batch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'batch'
                  ? 'bg-[var(--color-accent)] text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
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
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)]/60 bg-[var(--color-bg-secondary)]/60 px-2.5 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            title={t.help}
            aria-label={t.help}
          >
            <HelpCircle size={16} className="text-[var(--color-text-muted)]" />
            <span className="hidden sm:inline">{t.help}</span>
          </button>
        )}

        {/* Settings Group - Preferences */}
        <div className="flex items-center gap-1 bg-[var(--color-bg-secondary)]/60 rounded-lg px-1 py-0.5 border border-[var(--color-border)]/40">
          {/* Theme Style Selector */}
          <div className="relative" ref={styleMenuRef}>
          <button
            onClick={() => setIsStyleMenuOpen(!isStyleMenuOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
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
            <div className="absolute right-0 top-full mt-1 py-1 w-40 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-lg z-50">
              {THEME_STYLES.map((styleKey) => (
                <button
                  key={styleKey}
                  onClick={() => handleStyleChange(styleKey)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors ${
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
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
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
            <div className="absolute right-0 top-full mt-1 py-1 w-40 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-lg z-50">
              {availableLanguages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleLanguageChange(lang)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors ${
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
    </header>
  );
}
