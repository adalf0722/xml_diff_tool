/**
 * Theme Definitions
 * 4 styles (dark mode only)
 */

export type ThemeStyle = 'default' | 'linear' | 'github' | 'supabase';

export interface ThemeColors {
  // Base colors
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
  accentHover: string;
  
  // Diff colors
  diffAddedBg: string;
  diffAddedText: string;
  diffAddedBorder: string;
  diffRemovedBg: string;
  diffRemovedText: string;
  diffRemovedBorder: string;
  diffModifiedBg: string;
  diffModifiedText: string;
  diffModifiedBorder: string;
  
  // Syntax highlighting
  xmlTag: string;
  xmlAttrName: string;
  xmlAttrValue: string;
}

// ============================================
// DEFAULT THEME - DARK
// ============================================
const defaultDark: ThemeColors = {
  bgPrimary: '#0f172a',
  bgSecondary: '#1e293b',
  bgTertiary: '#334155',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#64748b',
  border: '#475569',
  accent: '#818cf8',
  accentHover: '#a5b4fc',
  
  diffAddedBg: '#14532d',
  diffAddedText: '#86efac',
  diffAddedBorder: '#22c55e',
  diffRemovedBg: '#7f1d1d',
  diffRemovedText: '#fca5a5',
  diffRemovedBorder: '#ef4444',
  diffModifiedBg: '#78350f',
  diffModifiedText: '#fcd34d',
  diffModifiedBorder: '#f59e0b',
  
  xmlTag: '#f0abfc',
  xmlAttrName: '#7dd3fc',
  xmlAttrValue: '#86efac',
};

// ============================================
// LINEAR THEME - DARK (Minimal, focused)
// ============================================
const linearDark: ThemeColors = {
  bgPrimary: '#0B0E14',
  bgSecondary: '#111827',
  bgTertiary: '#0F172A',
  textPrimary: '#E5E7EB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  border: 'rgba(255,255,255,0.06)',
  accent: '#8B5CF6',
  accentHover: '#A78BFA',
  
  diffAddedBg: 'rgba(16,185,129,0.18)',
  diffAddedText: '#34D399',
  diffAddedBorder: '#10B981',
  diffRemovedBg: 'rgba(239,68,68,0.18)',
  diffRemovedText: '#F87171',
  diffRemovedBorder: '#EF4444',
  diffModifiedBg: 'rgba(234,179,8,0.20)',
  diffModifiedText: '#FACC15',
  diffModifiedBorder: '#EAB308',
  
  xmlTag: '#F0ABFC',
  xmlAttrName: '#7DD3FC',
  xmlAttrValue: '#34D399',
};

// ============================================
// GITHUB THEME - DARK (VS Code / GitHub style)
// ============================================
const githubDark: ThemeColors = {
  bgPrimary: '#0D1117',
  bgSecondary: '#161B22',
  bgTertiary: '#21262D',
  textPrimary: '#C9D1D9',
  textSecondary: '#8B949E',
  textMuted: '#6E7681',
  border: '#30363D',
  accent: '#1F6FEB',
  accentHover: '#388BFD',
  
  diffAddedBg: 'rgba(46,160,67,0.20)',
  diffAddedText: '#3FB950',
  diffAddedBorder: '#238636',
  diffRemovedBg: 'rgba(248,81,73,0.20)',
  diffRemovedText: '#F85149',
  diffRemovedBorder: '#DA3633',
  diffModifiedBg: 'rgba(187,128,9,0.25)',
  diffModifiedText: '#D29922',
  diffModifiedBorder: '#9E6A03',
  
  xmlTag: '#7EE787',
  xmlAttrName: '#79C0FF',
  xmlAttrValue: '#A5D6FF',
};

// ============================================
// SUPABASE THEME - DARK (Professional dashboard)
// ============================================
const supabaseDark: ThemeColors = {
  bgPrimary: '#020617',
  bgSecondary: '#0F172A',
  bgTertiary: '#1E293B',
  textPrimary: '#E5E7EB',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#1E293B',
  accent: '#22C55E',
  accentHover: '#4ADE80',
  
  diffAddedBg: 'rgba(34,197,94,0.18)',
  diffAddedText: '#4ADE80',
  diffAddedBorder: '#22C55E',
  diffRemovedBg: 'rgba(239,68,68,0.18)',
  diffRemovedText: '#F87171',
  diffRemovedBorder: '#EF4444',
  diffModifiedBg: 'rgba(59,130,246,0.18)',
  diffModifiedText: '#60A5FA',
  diffModifiedBorder: '#3B82F6',
  
  xmlTag: '#4ADE80',
  xmlAttrName: '#60A5FA',
  xmlAttrValue: '#34D399',
};

// ============================================
// THEME MAP
// ============================================
export const themes: Record<ThemeStyle, ThemeColors> = {
  default: defaultDark,
  linear: linearDark,
  github: githubDark,
  supabase: supabaseDark,
};

export const THEME_STYLES: ThemeStyle[] = ['default', 'linear', 'github', 'supabase'];

/**
 * Get theme colors by style
 */
export function getTheme(style: ThemeStyle): ThemeColors {
  return themes[style];
}
