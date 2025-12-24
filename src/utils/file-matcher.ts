/**
 * File Matching Utilities
 * Handles file reading, filtering, and matching for batch comparison
 */

export interface FileEntry {
  name: string;
  content: string;
  path?: string;
}

export interface MatchedFilePair {
  id: string;
  name: string;
  status: 'matched' | 'only-in-a' | 'only-in-b';
  fileA?: FileEntry;
  fileB?: FileEntry;
}

export interface MatchResult {
  matched: MatchedFilePair[];
  onlyInA: MatchedFilePair[];
  onlyInB: MatchedFilePair[];
  all: MatchedFilePair[];
}

/**
 * Read files from a FileList (from input element)
 */
export async function readFilesFromFileList(fileList: FileList): Promise<FileEntry[]> {
  const files: FileEntry[] = [];
  
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    try {
      // Use FileReader to read the file content (handles size: 0 files)
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result);
        };
        reader.onerror = () => {
          reject(reader.error);
        };
        reader.readAsText(file);
      });
      
      files.push({
        name: file.name,
        content,
        path: file.webkitRelativePath || file.name,
      });
    } catch (error) {
      console.error('[readFilesFromFileList] Error reading file:', file.name, error);
      files.push({
        name: file.name,
        content: '',
        path: file.webkitRelativePath || file.name,
      });
    }
  }
  
  return files;
}

/**
 * Read files from DataTransfer (from drag & drop)
 */
export async function readFilesFromDataTransfer(items: DataTransferItemList): Promise<FileEntry[]> {
  const files: FileEntry[] = [];
  const fileEntries: FileSystemEntry[] = [];
  
  // Collect all file entries
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.webkitGetAsEntry) {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        fileEntries.push(entry);
      }
    }
  }
  
  // Recursively read files from directory entries
  async function readEntry(entry: FileSystemEntry, path: string = ''): Promise<void> {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      try {
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject);
        });
        
        // Use FileReader to read the file content
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });
        
        files.push({
          name: file.name,
          content,
          path: path ? `${path}/${file.name}` : file.name,
        });
      } catch (error) {
        console.error('[readFilesFromDataTransfer] Error reading file:', entry.name, error);
        files.push({
          name: entry.name,
          content: '',
          path: path ? `${path}/${entry.name}` : entry.name,
        });
      }
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        const results: FileSystemEntry[] = [];
        const readEntries = () => {
          reader.readEntries((batch) => {
            if (batch.length === 0) {
              resolve(results);
            } else {
              results.push(...batch);
              readEntries();
            }
          }, reject);
        };
        readEntries();
      });
      
      for (const subEntry of entries) {
        const subPath = path ? `${path}/${subEntry.name}` : subEntry.name;
        await readEntry(subEntry, subPath);
      }
    }
  }
  
  for (const entry of fileEntries) {
    await readEntry(entry);
  }
  
  return files;
}

/**
 * Filter files to only include XML files
 */
export function filterXMLFiles(files: FileEntry[]): FileEntry[] {
  return files.filter(file => {
    const name = file.name.toLowerCase();
    return name.endsWith('.xml');
  });
}

/**
 * Get folder name from file entries (extract from path)
 */
export function getFolderName(files: FileEntry[]): string {
  if (files.length === 0) return '';
  
  // Try to extract folder name from path
  const firstPath = files[0].path || files[0].name;
  if (firstPath.includes('/')) {
    const parts = firstPath.split('/');
    return parts[0] || '';
  }
  
  // Fallback: use first file's directory
  return 'Folder';
}

/**
 * Match files from two folders by filename
 */
export function matchFiles(filesA: FileEntry[], filesB: FileEntry[]): MatchResult {
  // Create maps by filename (case-insensitive)
  const mapA = new Map<string, FileEntry>();
  const mapB = new Map<string, FileEntry>();
  
  for (const file of filesA) {
    const key = file.name.toLowerCase();
    if (!mapA.has(key)) {
      mapA.set(key, file);
    }
  }
  
  for (const file of filesB) {
    const key = file.name.toLowerCase();
    if (!mapB.has(key)) {
      mapB.set(key, file);
    }
  }
  
  const matched: MatchedFilePair[] = [];
  const onlyInA: MatchedFilePair[] = [];
  const onlyInB: MatchedFilePair[] = [];
  
  // Find matched files
  for (const [key, fileA] of mapA.entries()) {
    const fileB = mapB.get(key);
    if (fileB) {
      matched.push({
        id: `matched-${key}`,
        name: fileA.name,
        status: 'matched',
        fileA,
        fileB,
      });
    } else {
      onlyInA.push({
        id: `only-a-${key}`,
        name: fileA.name,
        status: 'only-in-a',
        fileA,
      });
    }
  }
  
  // Find files only in B
  for (const [key, fileB] of mapB.entries()) {
    if (!mapA.has(key)) {
      onlyInB.push({
        id: `only-b-${key}`,
        name: fileB.name,
        status: 'only-in-b',
        fileB,
      });
    }
  }
  
  // Combine all results
  const all: MatchedFilePair[] = [
    ...matched,
    ...onlyInA,
    ...onlyInB,
  ];
  
  return {
    matched,
    onlyInA,
    onlyInB,
    all,
  };
}

