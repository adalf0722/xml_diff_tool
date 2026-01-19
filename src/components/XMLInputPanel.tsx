/**
 * XML Input Panel Component
 * Supports file upload, text paste, and drag & drop
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { Upload, FileText, Trash2, Wand2, EyeOff, Search, Pencil, Maximize2, Minimize2 } from 'lucide-react';
import { prettyPrintXML } from '../utils/pretty-print';
import { useLanguage } from '../contexts/LanguageContext';
import { XMLInspectView } from './XMLInspectView';

interface XMLInputPanelProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onUpload?: (value: string) => void;
  error?: string | null;
  placeholder?: string;
  isLarge?: boolean;
  isPreview?: boolean;
  previewLines?: number;
  previewChars?: number;
  onShowFull?: () => void;
  onShowPreview?: () => void;
  inspectMode?: boolean;
  inspectJumpTarget?: { path: string; token: number } | null;
  onInspectModeChange?: (isInspect: boolean) => void;
  isPanelFocused?: boolean;
  onToggleFocus?: () => void;
}

export function XMLInputPanel({
  label,
  value,
  onChange,
  onUpload,
  error,
  placeholder,
  isLarge = false,
  isPreview = false,
  previewLines = 5,
  previewChars = 2000,
  onShowFull,
  onShowPreview,
  inspectMode,
  inspectJumpTarget,
  onInspectModeChange,
  isPanelFocused = false,
  onToggleFocus,
}: XMLInputPanelProps) {
  const { t } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [panelMode, setPanelMode] = useState<'edit' | 'inspect'>('edit');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const previewText = useMemo(() => {
    if (!value) return '';
    const maxChars = Math.min(value.length, previewChars);
    let index = 0;
    let lines = 0;
    while (index < maxChars && lines < previewLines) {
      if (value[index] === '\n') {
        lines += 1;
      }
      index += 1;
    }
    const preview = value.slice(0, index);
    return index < value.length ? `${preview}\n...` : preview;
  }, [previewChars, previewLines, value]);

  const isInspectMode = panelMode === 'inspect';
  const showOverlay = !value && !isDragging && !isPreview && !isFocused;
  const textareaPlaceholder = showOverlay ? '' : placeholder;

  const handleFileRead = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onChange(content);
        onUpload?.(content);
      }
    };
    reader.onerror = () => {
      console.error('Error reading file');
    };
    reader.readAsText(file);
  }, [onChange, onUpload]);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'text/xml' || file.type === 'application/xml' || file.name.endsWith('.xml')) {
        handleFileRead(file);
      } else {
        // Try to read it anyway
        handleFileRead(file);
      }
    }
  }, [handleFileRead]);

  const handleFileInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileRead(files[0]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileRead]);

  const handleTextChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [onChange]);

  const handleFormat = useCallback(() => {
    if (value.trim()) {
      const formatted = prettyPrintXML(value);
      onChange(formatted);
    }
  }, [value, onChange]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleToggleInspect = useCallback(() => {
    setPanelMode(prev => {
      const next = prev === 'inspect' ? 'edit' : 'inspect';
      onInspectModeChange?.(next === 'inspect');
      return next;
    });
  }, [onInspectModeChange]);

  useEffect(() => {
    if (inspectMode === undefined) return;
    setPanelMode(inspectMode ? 'inspect' : 'edit');
  }, [inspectMode]);

  useEffect(() => {
    return () => {
      onInspectModeChange?.(false);
    };
  }, [onInspectModeChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <FileText size={16} className="text-[var(--color-accent)]" />
          {label}
        </h3>
        <div className="flex items-center gap-2">
          {isLarge && !isPreview && onShowPreview && !isInspectMode && (
            <button
              onClick={onShowPreview}
              className="p-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] transition-colors"
              title={t.showPreview}
            >
              <EyeOff size={16} className="text-[var(--color-text-secondary)]" />
            </button>
          )}
          {onToggleFocus && (
            <button
              onClick={onToggleFocus}
              className={`p-1.5 rounded-md transition-colors ${
                isPanelFocused
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                  : 'hover:bg-[var(--color-bg-tertiary)]'
              }`}
              title={isPanelFocused ? t.restorePanel : t.expandPanel}
            >
              {isPanelFocused ? (
                <Minimize2 size={16} className="text-[var(--color-accent)]" />
              ) : (
                <Maximize2 size={16} className="text-[var(--color-text-secondary)]" />
              )}
            </button>
          )}
          <button
            onClick={handleToggleInspect}
            className={`p-1.5 rounded-md transition-colors ${
              isInspectMode
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                : 'hover:bg-[var(--color-bg-tertiary)]'
            }`}
            title={isInspectMode ? t.editMode : t.inspectMode}
          >
            {isInspectMode ? (
              <Pencil size={16} className="text-[var(--color-accent)]" />
            ) : (
              <Search size={16} className="text-[var(--color-text-secondary)]" />
            )}
          </button>
          <button
            onClick={handleFormat}
            disabled={!value.trim()}
            className="p-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={t.formatXML}
          >
            <Wand2 size={16} className="text-[var(--color-text-secondary)]" />
          </button>
          <button
            onClick={handleUploadClick}
            className="p-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] transition-colors"
            title={t.uploadFile}
          >
            <Upload size={16} className="text-[var(--color-text-secondary)]" />
          </button>
          <button
            onClick={handleClear}
            disabled={!value}
            className="p-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={t.clearContent}
          >
            <Trash2 size={16} className="text-[var(--color-text-secondary)]" />
          </button>
        </div>
      </div>

      {/* Textarea with drag & drop */}
      <div
        className={`relative flex-1 ${
          isDragging
            ? 'bg-[var(--color-accent)]/10 border-2 border-dashed border-[var(--color-accent)]'
            : ''
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isInspectMode ? (
          <XMLInspectView value={value} jumpTarget={inspectJumpTarget} />
        ) : isPreview ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-muted)]">
              <span>
                {t.previewModeDesc.replace('{lines}', String(previewLines))}
              </span>
              {onShowFull && (
                <button
                  onClick={onShowFull}
                  className="px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  {t.showFullContent}
                </button>
              )}
            </div>
            <pre className="flex-1 overflow-auto p-4 whitespace-pre text-[var(--color-text-primary)] font-mono text-sm leading-relaxed">
              {previewText || placeholder || ''}
            </pre>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextChange}
            placeholder={textareaPlaceholder}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={`w-full h-full p-4 bg-transparent resize-none outline-none
              text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
              font-mono text-sm leading-relaxed
              ${error ? 'border-l-4 border-red-500' : ''}
            `}
            spellCheck={false}
          />
        )}

        {showOverlay && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/80 px-4 py-3 text-center text-xs text-[var(--color-text-muted)] shadow-sm">
              <div className="flex items-center justify-center gap-2 text-[var(--color-text-secondary)]">
                <Upload size={16} className="text-[var(--color-accent)]" />
                <span>{t.emptyDropHint}</span>
              </div>
              <div className="mt-1">{t.emptyPasteHint}</div>
            </div>
          </div>
        )}

        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-primary)]/80 pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-[var(--color-accent)]">
              <Upload size={48} />
              <span className="text-lg font-medium">{t.uploadFile}</span>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/30">
          <p className="text-sm text-red-500 font-medium">
            ⚠️ {error}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
          <span>{value.length} {t.characters}</span>
          <span>{value.split('\n').length} {t.lines}</span>
        </div>
      </div>
    </div>
  );
}
