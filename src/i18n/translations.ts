/**
 * Translations for XML Diff Tool
 * Supports: English (EN), Traditional Chinese (zh-TW), Simplified Chinese (zh-CN)
 */

export type Language = 'en' | 'zh-TW' | 'zh-CN';

export interface Translations {
  // App
  appTitle: string;
  appSubtitle: string;
  footer: string;

  // Header
  lightMode: string;
  darkMode: string;
  language: string;
  themeStyle: string;
  themeStyleDefault: string;
  themeStyleLinear: string;
  themeStyleGitHub: string;
  themeStyleSupabase: string;

  // Input Panel
  xmlALabel: string;
  xmlBLabel: string;
  xmlAPlaceholder: string;
  xmlBPlaceholder: string;
  formatXML: string;
  uploadFile: string;
  clearContent: string;
  characters: string;
  lines: string;
  previewModeDesc: string;
  showPreview: string;
  showFullContent: string;

  // View Tabs
  sideBySide: string;
  inline: string;
  treeView: string;

  // Diff Summary
  diffSummary: string;
  added: string;
  removed: string;
  modified: string;
  unchanged: string;
  noDifferences: string;
  enterXmlToCompare: string;
  treeSummaryScopeLabel: string;
  treeScopeFull: string;
  treeScopeDiffOnly: string;

  // Side by Side View
  originalXml: string;
  newXml: string;

  // Tree View
  expandAll: string;
  collapseAll: string;
  parseXmlToViewTree: string;

  // Errors
  xmlParseError: string;
  xmlParseErrorDesc: string;
  fixErrorsToViewDiff: string;
  emptyXml: string;
  invalidXml: string;
  parseStatusValid: string;

  // Actions
  swap: string;
  collapseInput: string;
  expandInput: string;

  // Diff badges
  badgeAdded: string;
  badgeRemoved: string;
  badgeModified: string;

  // Navigation
  previousDiff: string;
  nextDiff: string;

  // Download
  download: string;
  downloadHtml: string;
  downloadText: string;

  // Filter hints
  modifiedNotAvailableInline: string;

  // Filter actions
  resetFilters: string;

  // Stats unit
  statsLines: string;
  statsNodes: string;

  // Tree view placeholders
  addedOnOtherSide: string;
  removedFromHere: string;

  // Mode switching
  singleMode: string;
  batchMode: string;

  // Batch comparison
  batchCompare: string;
  folderA: string;
  folderB: string;
  dragFolderHere: string;
  orClickToSelect: string;
  xmlFiles: string;
  xmlFilesCount: string;
  andMore: string;
  clear: string;
  startBatchCompare: string;
  processing: string;
  processingFile: string;
  completed: string;
  failed: string;
  batchResults: string;
  filesCompared: string;
  matched: string;
  onlyInA: string;
  onlyInB: string;
  noDiff: string;
  hasDiff: string;
  viewDetails: string;
  backToList: string;
  exportAllReports: string;
  cancelBatch: string;
  cancel: string;
  parsingXMLA: string;
  parsingXMLB: string;
  computingLineDiff: string;
  computingDiff: string;
  largeFileMode: string;
  largeFileModeShort: string;
  largeFileModeDesc: string;
  showFullRendering: string;
  enableLargeFileMode: string;
  switchingView: string;
  renderingLines: string;
  showDiffOnly: string;
  showFullTree: string;
  diffOnlyTreeHint: string;
  treeExpandStateCollapsed: string;
  treeExpandStateExpanded: string;
  treeExpandStatePartial: string;
  treeExpandStateLabel: string;
  collapsedLines: string;
  expandSection: string;
  expandLines: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // App
    appTitle: 'XML Diff Tool',
    appSubtitle: 'Visualize XML document differences',
    footer: 'XML Diff Tool — Pure frontend XML comparison tool • All data processed locally for privacy',

    // Header
    lightMode: 'Light',
    darkMode: 'Dark',
    language: 'Language',
    themeStyle: 'Theme Style',
    themeStyleDefault: 'Default',
    themeStyleLinear: 'Linear',
    themeStyleGitHub: 'GitHub',
    themeStyleSupabase: 'Supabase',

    // Input Panel
    xmlALabel: 'XML A (Original)',
    xmlBLabel: 'XML B (New)',
    xmlAPlaceholder: 'Paste original XML content here, or drag & drop an XML file...',
    xmlBPlaceholder: 'Paste new XML content here, or drag & drop an XML file...',
    formatXML: 'Format XML',
    uploadFile: 'Upload file',
    clearContent: 'Clear content',
    characters: 'characters',
    lines: 'lines',
    previewModeDesc: 'Previewing first {lines} lines to reduce rendering cost.',
    showPreview: 'Show preview',
    showFullContent: 'Show full content',

    // View Tabs
    sideBySide: 'Side by Side',
    inline: 'Inline',
    treeView: 'Tree View',

    // Diff Summary
    diffSummary: 'Diff Summary:',
    added: 'Added',
    removed: 'Removed',
    modified: 'Modified',
    unchanged: 'Unchanged',
    noDifferences: '✓ The two XML documents are identical',
    enterXmlToCompare: 'Enter XML content to compare',
    treeSummaryScopeLabel: 'Scope: {scope}',
    treeScopeFull: 'Full tree',
    treeScopeDiffOnly: 'Focus tree',

    // Side by Side View
    originalXml: 'Original XML (A)',
    newXml: 'New XML (B)',

    // Tree View
    expandAll: 'Expand All',
    collapseAll: 'Collapse All',
    parseXmlToViewTree: 'Parse XML to view tree structure',

    // Errors
    xmlParseError: 'XML Parse Error',
    xmlParseErrorDesc: 'Please check if the XML format is correct. Detailed error messages are shown below the input boxes.',
    fixErrorsToViewDiff: 'Fix XML errors to view diff results',
    emptyXml: 'XML content is empty',
    invalidXml: 'Invalid XML format',
    parseStatusValid: 'XML is valid',

    // Actions
    swap: 'Swap XML A and B',
    collapseInput: '▲ Collapse input area',
    expandInput: '▼ Expand input area',

    // Diff badges
    badgeAdded: 'Added',
    badgeRemoved: 'Removed',
    badgeModified: 'Modified',

    // Navigation
    previousDiff: 'Previous Diff',
    nextDiff: 'Next Diff',

    // Download
    download: 'Download',
    downloadHtml: 'HTML Report',
    downloadText: 'Text Report',

    // Filter hints
    modifiedNotAvailableInline: '"Modified" filter is not available in inline view (use Added/Removed instead)',

    // Filter actions
    resetFilters: 'Reset',

    // Stats unit
    statsLines: 'lines',
    statsNodes: 'nodes',

    // Tree view placeholders
    addedOnOtherSide: 'Added on other side',
    removedFromHere: 'Removed from here',

    // Mode switching
    singleMode: 'Single File',
    batchMode: 'Batch Compare',

    // Batch comparison
    batchCompare: 'Batch Comparison',
    folderA: 'Folder A (Original)',
    folderB: 'Folder B (New)',
    dragFolderHere: 'Drag folder here',
    orClickToSelect: 'or click to select folder',
    xmlFiles: 'XML Files',
    xmlFilesCount: '{count} XML files',
    andMore: '+{count} more',
    clear: 'Clear',
    startBatchCompare: 'Start Comparison',
    processing: 'Processing...',
    processingFile: 'Processing: {file}',
    completed: 'Completed',
    failed: 'Failed',
    batchResults: 'Batch Results',
    filesCompared: 'files compared',
    matched: 'Matched',
    onlyInA: 'Only in A',
    onlyInB: 'Only in B',
    noDiff: 'No Diff',
    hasDiff: 'Has Diff',
    viewDetails: 'View Details',
    backToList: 'Back to List',
    exportAllReports: 'Export All Reports',
    cancelBatch: 'Cancel',
    cancel: 'Cancel',
    parsingXMLA: 'Parsing XML A...',
    parsingXMLB: 'Parsing XML B...',
    computingLineDiff: 'Computing line diff...',
    computingDiff: 'Computing differences...',
    largeFileMode: 'Large file mode',
    largeFileModeShort: 'Large file',
    largeFileModeDesc: 'Reduced rendering to improve performance on large files.',
    showFullRendering: 'Show full rendering',
    enableLargeFileMode: 'Enable large file mode',
    switchingView: 'Switching to {view}...',
    renderingLines: 'Rendering {current}/{total} lines...',
    showDiffOnly: 'Focus mode',
    showFullTree: 'Show full tree',
    diffOnlyTreeHint: 'Show diff nodes with ancestor paths for context.',
    treeExpandStateCollapsed: 'Collapsed',
    treeExpandStateExpanded: 'Expanded',
    treeExpandStatePartial: 'Partial',
    treeExpandStateLabel: 'Tree state: {state}',
    collapsedLines: 'Collapsed {count} lines',
    expandSection: 'Expand section',
    expandLines: 'Expand {count} lines',
  },

  'zh-TW': {
    // App
    appTitle: 'XML 差異比較工具',
    appSubtitle: '視覺化比較 XML 文件差異',
    footer: 'XML Diff Tool — 純前端 XML 比較工具 • 所有資料本地處理，保護隱私',

    // Header
    lightMode: '亮色',
    darkMode: '暗色',
    language: '語言',
    themeStyle: '主題風格',
    themeStyleDefault: '預設',
    themeStyleLinear: 'Linear',
    themeStyleGitHub: 'GitHub',
    themeStyleSupabase: 'Supabase',

    // Input Panel
    xmlALabel: 'XML A (原始)',
    xmlBLabel: 'XML B (新版)',
    xmlAPlaceholder: '在此貼上原始 XML 內容，或拖放 XML 檔案...',
    xmlBPlaceholder: '在此貼上新版 XML 內容，或拖放 XML 檔案...',
    formatXML: '格式化 XML',
    uploadFile: '上傳檔案',
    clearContent: '清除內容',
    characters: '字元',
    lines: '行',
    previewModeDesc: '僅顯示前 {lines} 行以降低資源耗用。',
    showPreview: '顯示預覽',
    showFullContent: '展開完整內容',

    // View Tabs
    sideBySide: '並排對比',
    inline: '內聯對比',
    treeView: '樹狀檢視',

    // Diff Summary
    diffSummary: '差異摘要:',
    added: '新增',
    removed: '刪除',
    modified: '修改',
    unchanged: '未變',
    noDifferences: '✓ 兩個 XML 文件完全相同',
    enterXmlToCompare: '請輸入 XML 內容進行比較',
    treeSummaryScopeLabel: '範圍：{scope}',
    treeScopeFull: '完整樹',
    treeScopeDiffOnly: '焦點樹',

    // Side by Side View
    originalXml: '原始 XML (A)',
    newXml: '新 XML (B)',

    // Tree View
    expandAll: '展開全部',
    collapseAll: '摺疊全部',
    parseXmlToViewTree: '解析 XML 以檢視樹狀結構',

    // Errors
    xmlParseError: 'XML 解析錯誤',
    xmlParseErrorDesc: '請檢查輸入的 XML 格式是否正確。詳細錯誤訊息顯示在對應的輸入框下方。',
    fixErrorsToViewDiff: '修復 XML 錯誤後將顯示差異比較結果',
    emptyXml: 'XML 內容為空',
    invalidXml: '無效的 XML 格式',
    parseStatusValid: 'XML 正常',

    // Actions
    swap: '交換 XML A 和 B',
    collapseInput: '▲ 收起輸入區域',
    expandInput: '▼ 展開輸入區域',

    // Diff badges
    badgeAdded: '新增',
    badgeRemoved: '刪除',
    badgeModified: '修改',

    // Navigation
    previousDiff: '上一個差異',
    nextDiff: '下一個差異',

    // Download
    download: '下載',
    downloadHtml: 'HTML 報告',
    downloadText: '文字報告',

    // Filter hints
    modifiedNotAvailableInline: '「修改」篩選器不適用於內聯視圖（請使用新增/刪除）',

    // Filter actions
    resetFilters: '重置',

    // Stats unit
    statsLines: '行',
    statsNodes: '節點',

    // Tree view placeholders
    addedOnOtherSide: '新增於另一邊',
    removedFromHere: '已從此處刪除',

    // Mode switching
    singleMode: '單檔比較',
    batchMode: '批量比較',

    // Batch comparison
    batchCompare: '批量比較',
    folderA: '資料夾 A（原始）',
    folderB: '資料夾 B（新版）',
    dragFolderHere: '拖放資料夾到此處',
    orClickToSelect: '或點擊選擇資料夾',
    xmlFiles: 'XML 檔案',
    xmlFilesCount: '{count} 個 XML 檔案',
    andMore: '還有 {count} 個...',
    clear: '清除',
    startBatchCompare: '開始比較',
    processing: '處理中...',
    processingFile: '正在處理: {file}',
    completed: '已完成',
    failed: '失敗',
    batchResults: '批量結果',
    filesCompared: '個檔案已比較',
    matched: '配對成功',
    onlyInA: '僅在 A',
    onlyInB: '僅在 B',
    noDiff: '無差異',
    hasDiff: '有差異',
    viewDetails: '查看詳情',
    backToList: '返回列表',
    exportAllReports: '匯出所有報告',
    cancelBatch: '取消',
    cancel: '取消',
    parsingXMLA: '解析 XML A...',
    parsingXMLB: '解析 XML B...',
    computingLineDiff: '計算行級差異...',
    computingDiff: '計算差異...',
    largeFileMode: '大型檔案模式',
    largeFileModeShort: '大檔',
    largeFileModeDesc: '已降低渲染負擔以提升效能。',
    showFullRendering: '顯示完整渲染',
    enableLargeFileMode: '啟用大型檔案模式',
    switchingView: '正在切換到 {view}...',
    renderingLines: '正在渲染 {current}/{total} 行...',
    showDiffOnly: '焦點模式',
    showFullTree: '顯示完整樹',
    diffOnlyTreeHint: '只顯示差異節點與祖先路徑。',
    treeExpandStateCollapsed: '已收合',
    treeExpandStateExpanded: '已展開',
    treeExpandStatePartial: '部分展開',
    treeExpandStateLabel: '樹狀狀態：{state}',
    collapsedLines: '已收合 {count} 行',
    expandSection: '展開區段',
    expandLines: '展開 {count} 行',
  },

  'zh-CN': {
    // App
    appTitle: 'XML 差异比较工具',
    appSubtitle: '可视化比较 XML 文档差异',
    footer: 'XML Diff Tool — 纯前端 XML 比较工具 • 所有数据本地处理，保护隐私',

    // Header
    lightMode: '亮色',
    darkMode: '暗色',
    language: '语言',
    themeStyle: '主题风格',
    themeStyleDefault: '默认',
    themeStyleLinear: 'Linear',
    themeStyleGitHub: 'GitHub',
    themeStyleSupabase: 'Supabase',

    // Input Panel
    xmlALabel: 'XML A (原始)',
    xmlBLabel: 'XML B (新版)',
    xmlAPlaceholder: '在此粘贴原始 XML 内容，或拖放 XML 文件...',
    xmlBPlaceholder: '在此粘贴新版 XML 内容，或拖放 XML 文件...',
    formatXML: '格式化 XML',
    uploadFile: '上传文件',
    clearContent: '清除内容',
    characters: '字符',
    lines: '行',
    previewModeDesc: '仅显示前 {lines} 行以降低资源占用。',
    showPreview: '显示预览',
    showFullContent: '展开完整内容',

    // View Tabs
    sideBySide: '并排对比',
    inline: '内联对比',
    treeView: '树形视图',

    // Diff Summary
    diffSummary: '差异摘要:',
    added: '新增',
    removed: '删除',
    modified: '修改',
    unchanged: '未变',
    noDifferences: '✓ 两个 XML 文档完全相同',
    enterXmlToCompare: '请输入 XML 内容进行比较',
    treeSummaryScopeLabel: '范围：{scope}',
    treeScopeFull: '完整树',
    treeScopeDiffOnly: '焦点树',

    // Side by Side View
    originalXml: '原始 XML (A)',
    newXml: '新 XML (B)',

    // Tree View
    expandAll: '展开全部',
    collapseAll: '折叠全部',
    parseXmlToViewTree: '解析 XML 以查看树形结构',

    // Errors
    xmlParseError: 'XML 解析错误',
    xmlParseErrorDesc: '请检查输入的 XML 格式是否正确。详细错误信息显示在对应的输入框下方。',
    fixErrorsToViewDiff: '修复 XML 错误后将显示差异比较结果',
    emptyXml: 'XML 内容为空',
    invalidXml: '无效的 XML 格式',
    parseStatusValid: 'XML 正常',

    // Actions
    swap: '交换 XML A 和 B',
    collapseInput: '▲ 收起输入区域',
    expandInput: '▼ 展开输入区域',

    // Diff badges
    badgeAdded: '新增',
    badgeRemoved: '删除',
    badgeModified: '修改',

    // Navigation
    previousDiff: '上一个差异',
    nextDiff: '下一个差异',

    // Download
    download: '下载',
    downloadHtml: 'HTML 报告',
    downloadText: '文本报告',

    // Filter hints
    modifiedNotAvailableInline: '"修改"筛选器不适用于内联视图（请使用新增/删除）',

    // Filter actions
    resetFilters: '重置',

    // Stats unit
    statsLines: '行',
    statsNodes: '节点',

    // Tree view placeholders
    addedOnOtherSide: '新增于另一侧',
    removedFromHere: '已从此处删除',

    // Mode switching
    singleMode: '单文件',
    batchMode: '批量比较',

    // Batch comparison
    batchCompare: '批量比较',
    folderA: '文件夹 A（原始）',
    folderB: '文件夹 B（新版）',
    dragFolderHere: '拖放文件夹到此处',
    orClickToSelect: '或点击选择文件夹',
    xmlFiles: 'XML 文件',
    xmlFilesCount: '{count} 个 XML 文件',
    andMore: '还有 {count} 个...',
    clear: '清除',
    startBatchCompare: '开始比较',
    processing: '处理中...',
    processingFile: '正在处理: {file}',
    completed: '已完成',
    failed: '失败',
    batchResults: '批量结果',
    filesCompared: '个文件已比较',
    matched: '配对成功',
    onlyInA: '仅在 A',
    onlyInB: '仅在 B',
    noDiff: '无差异',
    hasDiff: '有差异',
    viewDetails: '查看详情',
    backToList: '返回列表',
    exportAllReports: '导出所有报告',
    cancelBatch: '取消',
    cancel: '取消',
    parsingXMLA: '解析 XML A...',
    parsingXMLB: '解析 XML B...',
    computingLineDiff: '计算行级差异...',
    computingDiff: '计算差异...',
    largeFileMode: '大型文件模式',
    largeFileModeShort: '大文件',
    largeFileModeDesc: '已降低渲染负担以提升性能。',
    showFullRendering: '显示完整渲染',
    enableLargeFileMode: '启用大型文件模式',
    switchingView: '正在切换到 {view}...',
    renderingLines: '正在渲染 {current}/{total} 行...',
    showDiffOnly: '焦点模式',
    showFullTree: '显示完整树',
    diffOnlyTreeHint: '仅显示差异节点与祖先路径。',
    treeExpandStateCollapsed: '已收合',
    treeExpandStateExpanded: '已展开',
    treeExpandStatePartial: '部分展开',
    treeExpandStateLabel: '树状状态：{state}',
    collapsedLines: '已折叠 {count} 行',
    expandSection: '展开区段',
    expandLines: '展开 {count} 行',
  },
};

export const languageNames: Record<Language, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
};

export const defaultLanguage: Language = 'en';

