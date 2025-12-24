/**
 * Folder Upload Component
 * Dual dropzone for uploading two folders for batch comparison
 */

import { useState, useCallback, useRef } from 'react';
import { FolderOpen, Upload, X, FileText } from 'lucide-react';
import { 
  readFilesFromFileList, 
  readFilesFromDataTransfer, 
  filterXMLFiles,
  getFolderName,
  type FileEntry 
} from '../utils/file-matcher';
import { useLanguage } from '../contexts/LanguageContext';

interface FolderUploadProps {
  onFoldersSelected: (filesA: FileEntry[], filesB: FileEntry[]) => void;
  disabled?: boolean;
}

interface FolderDropZoneProps {
  label: string;
  files: FileEntry[];
  folderName: string;
  onFilesSelected: (files: FileEntry[]) => void;
  onClear: () => void;
  disabled?: boolean;
}

function FolderDropZone({
  label,
  files,
  folderName,
  onFilesSelected,
  onClear,
  disabled,
}: FolderDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (disabled) return;

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const allFiles = await readFilesFromDataTransfer(items);
      const xmlFiles = filterXMLFiles(allFiles);
      onFilesSelected(xmlFiles);
    }
  }, [disabled, onFilesSelected]);

  const handleInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      const allFiles = await readFilesFromFileList(fileList);
      const xmlFiles = filterXMLFiles(allFiles);
      onFilesSelected(xmlFiles);
    }
    // Reset input so same folder can be selected again
    e.target.value = '';
  }, [onFilesSelected]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const hasFiles = files.length > 0;

  return (
    <div
      className={`
        relative flex-1 min-h-[200px] border-2 border-dashed rounded-xl
        transition-all duration-200 cursor-pointer
        ${isDragOver 
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10' 
          : hasFiles
            ? 'border-[var(--color-success)] bg-[var(--color-success)]/5'
            : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        // @ts-expect-error - webkitdirectory is not in the types
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleInputChange}
      />

      {hasFiles ? (
        <div className="p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[var(--color-success)]">
              <FolderOpen size={20} />
              <span className="font-medium">{folderName}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="p-1 rounded-md hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              title={t.clear}
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto">
            <div className="text-xs text-[var(--color-text-secondary)] mb-2">
              {t.xmlFilesCount.replace('{count}', String(files.length))}
            </div>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {files.slice(0, 10).map((file, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]"
                >
                  <FileText size={12} />
                  <span className="truncate">{file.name}</span>
                </div>
              ))}
              {files.length > 10 && (
                <div className="text-xs text-[var(--color-text-tertiary)] italic">
                  ... {t.andMore.replace('{count}', String(files.length - 10))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <div className={`
            p-4 rounded-full mb-3
            ${isDragOver ? 'bg-[var(--color-accent)]/20' : 'bg-[var(--color-bg-tertiary)]'}
          `}>
            <Upload size={28} className={isDragOver ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'} />
          </div>
          <div className="font-medium text-[var(--color-text-primary)] mb-1">
            {label}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">
            {t.dragFolderHere}
          </div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
            {t.orClickToSelect}
          </div>
        </div>
      )}
    </div>
  );
}

export function FolderUpload({ onFoldersSelected, disabled }: FolderUploadProps) {
  const [filesA, setFilesA] = useState<FileEntry[]>([]);
  const [filesB, setFilesB] = useState<FileEntry[]>([]);
  const [folderNameA, setFolderNameA] = useState('');
  const [folderNameB, setFolderNameB] = useState('');
  const { t } = useLanguage();

  const handleFilesA = useCallback((files: FileEntry[]) => {
    setFilesA(files);
    setFolderNameA(getFolderName(files));
  }, []);

  const handleFilesB = useCallback((files: FileEntry[]) => {
    setFilesB(files);
    setFolderNameB(getFolderName(files));
  }, []);

  const handleClearA = useCallback(() => {
    setFilesA([]);
    setFolderNameA('');
  }, []);

  const handleClearB = useCallback(() => {
    setFilesB([]);
    setFolderNameB('');
  }, []);

  const canCompare = filesA.length > 0 && filesB.length > 0;

  const handleCompare = useCallback(() => {
    if (canCompare) {
      onFoldersSelected(filesA, filesB);
    }
  }, [canCompare, filesA, filesB, onFoldersSelected]);

  return (
    <div className="p-6 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)]">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
        {t.batchCompare}
      </h2>
      
      <div className="flex gap-4 mb-4">
        <FolderDropZone
          label={t.folderA}
          files={filesA}
          folderName={folderNameA}
          onFilesSelected={handleFilesA}
          onClear={handleClearA}
          disabled={disabled}
        />
        
        <div className="flex items-center text-[var(--color-text-tertiary)]">
          vs
        </div>
        
        <FolderDropZone
          label={t.folderB}
          files={filesB}
          folderName={folderNameB}
          onFilesSelected={handleFilesB}
          onClear={handleClearB}
          disabled={disabled}
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleCompare}
          disabled={!canCompare || disabled}
          className={`
            flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium
            transition-all duration-200
            ${canCompare && !disabled
              ? 'bg-[var(--color-accent)] text-white hover:brightness-110'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] cursor-not-allowed'
            }
          `}
        >
          {t.startBatchCompare}
        </button>
      </div>
    </div>
  );
}

export default FolderUpload;


