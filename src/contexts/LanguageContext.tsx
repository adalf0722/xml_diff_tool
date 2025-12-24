/**
 * Language Context
 * Provides internationalization (i18n) support
 */

import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { translations, defaultLanguage, languageNames } from '../i18n/translations';
import type { Language, Translations } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  languageNames: typeof languageNames;
  availableLanguages: Language[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Check localStorage first
    const saved = localStorage.getItem('xmldiff-language') as Language;
    if (saved && translations[saved]) {
      return saved;
    }
    
    // Check browser language preference
    const browserLang = navigator.language;
    if (browserLang.startsWith('zh')) {
      // Check for Traditional Chinese regions
      if (browserLang === 'zh-TW' || browserLang === 'zh-HK' || browserLang === 'zh-Hant') {
        return 'zh-TW';
      }
      // Default to Simplified Chinese for other zh variants
      return 'zh-CN';
    }
    
    return defaultLanguage;
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('xmldiff-language', lang);
  }, []);

  const t = translations[language];
  const availableLanguages: Language[] = ['en', 'zh-TW', 'zh-CN'];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languageNames,
        availableLanguages,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

