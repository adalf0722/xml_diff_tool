/**
 * Theme Context
 * Provides theme style switching functionality (dark mode only)
 * Style: default | linear | github | supabase
 */

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ThemeStyle } from '../themes';

interface ThemeContextType {
  style: ThemeStyle;
  setStyle: (style: ThemeStyle) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

const STORAGE_KEY_STYLE = 'xmldiff-theme-style';

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [style, setStyleState] = useState<ThemeStyle>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_STYLE) as ThemeStyle;
    if (saved === 'default' || saved === 'linear' || saved === 'github' || saved === 'supabase') {
      return saved;
    }
    return 'linear';
  });

  useEffect(() => {
    // Update document classes: add style and always dark mode
    const html = document.documentElement;
    
    // Remove old classes
    html.classList.remove('default', 'linear', 'github', 'supabase', 'light', 'dark');
    
    // Add new classes (always dark mode)
    html.classList.add(style, 'dark');
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY_STYLE, style);
  }, [style]);

  const setStyle = (newStyle: ThemeStyle) => {
    setStyleState(newStyle);
  };

  return (
    <ThemeContext.Provider value={{ style, setStyle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
