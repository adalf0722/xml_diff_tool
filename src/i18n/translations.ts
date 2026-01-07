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
  inspectMode: string;
  editMode: string;
  expandPanel: string;
  restorePanel: string;
  inspectTreeTitle: string;
  inspectTreeEmpty: string;
  inspectSearchPlaceholder: string;
  inspectSearchCount: string;
  inspectSearchNoMatch: string;
  inspectSearchPrev: string;
  inspectSearchNext: string;

  // View Tabs
  sideBySide: string;
  inline: string;
  treeView: string;
  schemaView: string;

  // Diff Summary
  diffSummary: string;
  added: string;
  removed: string;
  modified: string;
  unchanged: string;
  sideOnlyA: string;
  sideOnlyB: string;
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

  // Schema View
  schemaTable: string;
  schemaField: string;
  schemaFieldCount: string;
  schemaNoChanges: string;
  schemaNoTableMatch: string;
  schemaAttributeType: string;
  schemaAttributeSize: string;
  schemaAttributeDefault: string;
  schemaInTable: string;
  schemaPresetLabel: string;
  schemaPresetStruct: string;
  schemaPresetXsd: string;
  schemaPresetTable: string;
  schemaPresetCustom: string;
  schemaCustomTitle: string;
  schemaCustomTableTags: string;
  schemaCustomFieldTags: string;
  schemaCustomTableNameAttrs: string;
  schemaCustomFieldNameAttrs: string;
  schemaCustomIgnoreNodes: string;
  schemaCustomIgnoreNamespaces: string;
  schemaCustomCaseSensitive: string;
  schemaCustomFieldSearchMode: string;
  schemaCustomFieldSearchChildren: string;
  schemaCustomFieldSearchDescendants: string;
  schemaCustomListHint: string;
  schemaCustomApply: string;
  schemaCustomReset: string;
  schemaCustomOpen: string;
  schemaSummaryTitle: string;
  schemaFilterAll: string;
  schemaFilterTables: string;
  schemaFilterFields: string;
  schemaTableChanges: string;
  schemaFieldChanges: string;
  schemaTableAddedLabel: string;
  schemaTableRemovedLabel: string;
  schemaTableModifiedLabel: string;
  schemaFieldAddedLabel: string;
  schemaFieldAddedExistingLabel: string;
  schemaFieldAddedFromNewTableLabel: string;
  schemaFieldRemovedLabel: string;
  schemaFieldModifiedLabel: string;

  enabled: string;
  disabled: string;

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
  close: string;

  // Help & Empty State
  help: string;
  helpTitle: string;
  helpSubtitle: string;
  helpQuickStartTitle: string;
  helpQuickStep1: string;
  helpQuickStep2: string;
  helpQuickStep3: string;
  helpViewsTitle: string;
  helpViewSide: string;
  helpViewInline: string;
  helpViewTree: string;
  helpViewSchema: string;
  helpSchemaCustomTitle: string;
  helpSchemaCustomStep1: string;
  helpSchemaCustomStep2: string;
  helpSchemaCustomStep3: string;
  helpSchemaCustomNote: string;
  helpReportsTitle: string;
  helpReportsDesc: string;
  helpTipsTitle: string;
  helpTipLargeFiles: string;
  helpTipChunks: string;
  helpShortcutsTitle: string;
  helpShortcutPrevNext: string;
  helpShortcutChunkNav: string;
  helpShortcutEscape: string;
  helpLargeFileLimitTitle: string;
  helpLargeFileLimitHighlight: string;
  helpLargeFileLimitCollapsed: string;
  helpLargeFileLimitProgressive: string;
  helpLargeFileLimitOverride: string;
  emptyTitle: string;
  emptySubtitle: string;
  emptyStep1: string;
  emptyStep2: string;
  emptyStep3: string;
  emptyUseSample: string;
  emptyOpenHelp: string;
  emptyDropHint: string;
  emptyPrivacyNote: string;
  emptySampleHint: string;
  emptyPasteHint: string;
  emptyStepLabel: string;

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
  downloadSide: string;
  downloadInline: string;
  downloadTree: string;
  downloadSchema: string;

  // Filter hints
  modifiedNotAvailableInline: string;

  // Filter actions
  resetFilters: string;

  // Stats unit
  statsLines: string;
  statsNodes: string;
  statsFields: string;

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
  backToBatch: string;
  batchSearchPlaceholder: string;
  batchSortLabel: string;
  batchSortAsc: string;
  batchSortDesc: string;
  batchSortName: string;
  batchSortAdded: string;
  batchSortRemoved: string;
  batchSortModified: string;
  batchSortStatus: string;
  batchFilterStatusLabel: string;
  batchFilterDiffLabel: string;
  batchFilterAll: string;
  batchFilterHasDiff: string;
  batchFilterNoDiff: string;
  batchFilterFailed: string;
  batchFilterOnlyA: string;
  batchFilterOnlyB: string;
  batchStatusLabel: string;
  batchNoResults: string;
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
  overviewModeLabel: string;
  overviewModeAuto: string;
  overviewModeMinimap: string;
  overviewModeHybrid: string;
  overviewModeChunks: string;
  overviewModeAutoHint: string;
  overviewCoverageLabel: string;
  overviewHighDensity: string;
  overviewHighDensityHint: string;
  chunkListTitle: string;
  chunkCountLabel: string;
  chunkLabel: string;
  chunkRangeLabel: string;
  chunkFilterLabel: string;
  chunkFilterAll: string;
  chunkEmpty: string;
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
    inspectMode: 'Inspect mode',
    editMode: 'Edit mode',
    expandPanel: 'Maximize panel',
    restorePanel: 'Restore panel',
    inspectTreeTitle: 'Outline',
    inspectTreeEmpty: 'No nodes to display',
    inspectSearchPlaceholder: 'Search node/attr/text...',
    inspectSearchCount: '{current}/{total}',
    inspectSearchNoMatch: 'No matches',
    inspectSearchPrev: 'Previous match',
    inspectSearchNext: 'Next match',

    // View Tabs
    sideBySide: 'Side by Side',
    inline: 'Inline',
    treeView: 'Tree View',
    schemaView: 'Schema',

    // Diff Summary
    diffSummary: 'Diff Summary:',
    added: 'Added',
    removed: 'Removed',
    modified: 'Modified',
    unchanged: 'Unchanged',
    sideOnlyA: 'A only',
    sideOnlyB: 'B only',
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

    // Schema View
    schemaTable: 'Table',
    schemaField: 'Field',
    schemaFieldCount: '{count} fields',
    schemaNoChanges: 'No schema differences',
    schemaNoTableMatch: 'No tables matched the current preset ({preset}). Adjust the settings.',
    schemaAttributeType: 'type',
    schemaAttributeSize: 'size',
    schemaAttributeDefault: 'default',
    schemaInTable: 'in {table}',
    schemaPresetLabel: 'Preset',
    schemaPresetStruct: 'Struct/Entry',
    schemaPresetXsd: 'XSD (complexType/element)',
    schemaPresetTable: 'Table/Column',
    schemaPresetCustom: 'Custom',
    schemaCustomTitle: 'Custom template',
    schemaCustomTableTags: 'Table tags',
    schemaCustomFieldTags: 'Field tags',
    schemaCustomTableNameAttrs: 'Table name attributes',
    schemaCustomFieldNameAttrs: 'Field name attributes',
    schemaCustomIgnoreNodes: 'Ignore nodes',
    schemaCustomIgnoreNamespaces: 'Ignore namespaces',
    schemaCustomCaseSensitive: 'Case-sensitive names',
    schemaCustomFieldSearchMode: 'Field search mode',
    schemaCustomFieldSearchChildren: 'Children only',
    schemaCustomFieldSearchDescendants: 'Include descendants',
    schemaCustomListHint: 'Multiple values, comma-separated',
    schemaCustomApply: 'Apply',
    schemaCustomReset: 'Reset',
    schemaCustomOpen: 'Custom settings',
    schemaSummaryTitle: 'Schema summary',
    schemaFilterAll: 'All',
    schemaFilterTables: 'Tables',
    schemaFilterFields: 'Fields',
    schemaTableChanges: 'Table changes',
    schemaFieldChanges: 'Field changes',
    schemaTableAddedLabel: 'Tables added',
    schemaTableRemovedLabel: 'Tables removed',
    schemaTableModifiedLabel: 'Tables modified',
    schemaFieldAddedLabel: 'Fields added',
    schemaFieldAddedExistingLabel: 'Fields added (existing tables)',
    schemaFieldAddedFromNewTableLabel: 'Fields added (new tables)',
    schemaFieldRemovedLabel: 'Fields removed',
    schemaFieldModifiedLabel: 'Fields modified',

    enabled: 'Enabled',
    disabled: 'Disabled',

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
    close: 'Close',

    // Help & Empty State
    help: 'Help',
    helpTitle: 'Getting Started',
    helpSubtitle: 'Quick tips to compare XML files faster.',
    helpQuickStartTitle: 'Quick start',
    helpQuickStep1: 'Paste or upload XML in A and B.',
    helpQuickStep2: 'Pick a view (Side by Side / Inline / Tree / Schema).',
    helpQuickStep3: 'Use diff navigation or download a report.',
    helpViewsTitle: 'View modes',
    helpViewSide: 'Line-by-line comparison with synced scrolling.',
    helpViewInline: 'Unified diff with additions and removals.',
    helpViewTree: 'Tree diff for structural changes.',
    helpViewSchema: 'Schema view for tables and fields.',
    helpSchemaCustomTitle: 'Custom schema template',
    helpSchemaCustomStep1: 'Switch to Schema view and select the Custom preset.',
    helpSchemaCustomStep2: 'Open Custom settings to set table/field tags and name attributes.',
    helpSchemaCustomStep3: 'Apply to re-calculate schema differences.',
    helpSchemaCustomNote: 'Multiple tags/attributes are supported; separate them with commas.',
    helpReportsTitle: 'Reports',
    helpReportsDesc: 'Download summaries that match the current view.',
    helpTipsTitle: 'Tips',
    helpTipLargeFiles: 'Large file mode reduces rendering for performance.',
    helpTipChunks: 'Use diff chunks or minimap to jump quickly.',
    helpShortcutsTitle: 'Common shortcuts',
    helpShortcutPrevNext: 'P / N: previous or next diff.',
    helpShortcutChunkNav: 'Chunk list: ↑/↓, Home/End to move; Enter/Space to jump.',
    helpShortcutEscape: 'Esc: close the help drawer.',
    helpLargeFileLimitTitle: 'Large file limitations',
    helpLargeFileLimitHighlight: 'Syntax highlighting is disabled to improve performance.',
    helpLargeFileLimitCollapsed: 'Unchanged sections may be collapsed into context windows.',
    helpLargeFileLimitProgressive: 'Rendering is progressive while scrolling.',
    helpLargeFileLimitOverride: 'Use "Show full rendering" to disable large file mode.',
    emptyTitle: 'Welcome to XML Diff Tool',
    emptySubtitle: 'Paste XML or start with a sample to see differences.',
    emptyStep1: 'Upload or paste XML A and XML B.',
    emptyStep2: 'Choose the view that fits your task.',
    emptyStep3: 'Review changes and export a report.',
    emptyUseSample: 'Use sample XML',
    emptyOpenHelp: 'Open help',
    emptyDropHint: 'Drag & drop XML files here',
    emptyPrivacyNote: 'All processing stays in your browser.',
    emptySampleHint: 'Try a 30-second demo to get started.',
    emptyPasteHint: 'Or paste XML directly into the editor.',
    emptyStepLabel: 'Step',

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
    downloadSide: 'Side-by-Side Summary',
    downloadInline: 'Inline Summary',
    downloadTree: 'Tree Summary',
    downloadSchema: 'Schema Summary',

    // Filter hints
    modifiedNotAvailableInline: '"Modified" filter is not available in inline view (use Added/Removed instead)',

    // Filter actions
    resetFilters: 'Reset',

    // Stats unit
    statsLines: 'lines',
    statsNodes: 'nodes',
    statsFields: 'fields',

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
    backToBatch: 'Back to Batch Compare',
    batchSearchPlaceholder: 'Search files...',
    batchSortLabel: 'Sort',
    batchSortAsc: 'Asc',
    batchSortDesc: 'Desc',
    batchSortName: 'Name',
    batchSortAdded: 'Added',
    batchSortRemoved: 'Removed',
    batchSortModified: 'Modified',
    batchSortStatus: 'Status',
    batchFilterStatusLabel: 'Status filter',
    batchFilterDiffLabel: 'Diff filter',
    batchFilterAll: 'All',
    batchFilterHasDiff: 'Has diff',
    batchFilterNoDiff: 'No diff',
    batchFilterFailed: 'Failed',
    batchFilterOnlyA: 'Only in A',
    batchFilterOnlyB: 'Only in B',
    batchStatusLabel: 'Status',
    batchNoResults: 'No matching results',
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
    overviewModeLabel: 'Overview',
    overviewModeAuto: 'Auto',
    overviewModeMinimap: 'Minimap',
    overviewModeHybrid: 'Hybrid',
    overviewModeChunks: 'Chunks',
    overviewModeAutoHint: 'Auto: {mode}',
    overviewCoverageLabel: 'Coverage {percent}%',
    overviewHighDensity: 'High density',
    overviewHighDensityHint: 'High coverage detected, switched to chunk mode.',
    chunkListTitle: 'Diff chunks',
    chunkCountLabel: '{count} chunks',
    chunkLabel: 'Chunk',
    chunkRangeLabel: 'Lines {start}-{end}',
    chunkFilterLabel: 'Filter',
    chunkFilterAll: 'All',
    chunkEmpty: 'No matching chunks',
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
    inspectMode: '剖析模式',
    editMode: '編輯模式',
    expandPanel: '放大視窗',
    restorePanel: '還原視窗',
    inspectTreeTitle: '樹狀導覽',
    inspectTreeEmpty: '沒有可顯示的節點',
    inspectSearchPlaceholder: '搜尋節點/屬性/文字...',
    inspectSearchCount: '{current}/{total}',
    inspectSearchNoMatch: '沒有符合項目',
    inspectSearchPrev: '上一筆',
    inspectSearchNext: '下一筆',

    // View Tabs
    sideBySide: '並排對比',
    inline: '內聯對比',
    treeView: '樹狀檢視',
    schemaView: 'Schema 檢視',

    // Diff Summary
    diffSummary: '差異摘要:',
    added: '新增',
    removed: '刪除',
    modified: '修改',
    unchanged: '未變',
    sideOnlyA: '僅 A',
    sideOnlyB: '僅 B',
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

    // Schema View
    schemaTable: '表',
    schemaField: '欄位',
    schemaFieldCount: '{count} 欄位',
    schemaNoChanges: '沒有結構差異',
    schemaNoTableMatch: '目前模板（{preset}）沒有匹配到表，請調整',
    schemaAttributeType: '型別',
    schemaAttributeSize: '大小',
    schemaAttributeDefault: '預設值',
    schemaInTable: '屬於 {table}',
    schemaPresetLabel: '模板',
    schemaPresetStruct: '結構/欄位（struct/entry）',
    schemaPresetXsd: 'XSD（complexType/element）',
    schemaPresetTable: '表/欄位（table/column）',
    schemaPresetCustom: '自訂',
    schemaCustomTitle: '自訂模板',
    schemaCustomTableTags: '表節點標籤',
    schemaCustomFieldTags: '欄位節點標籤',
    schemaCustomTableNameAttrs: '表名稱屬性',
    schemaCustomFieldNameAttrs: '欄位名稱屬性',
    schemaCustomIgnoreNodes: '忽略節點',
    schemaCustomIgnoreNamespaces: '忽略命名空間',
    schemaCustomCaseSensitive: '名稱大小寫區分',
    schemaCustomFieldSearchMode: '欄位搜尋範圍',
    schemaCustomFieldSearchChildren: '僅子層',
    schemaCustomFieldSearchDescendants: '包含深層',
    schemaCustomListHint: '可填多個，以逗號分隔',
    schemaCustomApply: '套用',
    schemaCustomReset: '還原',
    schemaCustomOpen: '自訂設定',
    schemaSummaryTitle: 'Schema 摘要',
    schemaFilterAll: '全部',
    schemaFilterTables: '表',
    schemaFilterFields: '欄位',
    schemaTableChanges: '表格差異',
    schemaFieldChanges: '欄位差異',
    schemaTableAddedLabel: '新增表',
    schemaTableRemovedLabel: '刪除表',
    schemaTableModifiedLabel: '修改表',
    schemaFieldAddedLabel: '新增欄位',
    schemaFieldAddedExistingLabel: '新增欄位（既有表）',
    schemaFieldAddedFromNewTableLabel: '新增欄位（新增表）',
    schemaFieldRemovedLabel: '刪除欄位',
    schemaFieldModifiedLabel: '修改欄位',

    enabled: '啟用',
    disabled: '關閉',

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
    close: '關閉',

    // Help & Empty State
    help: '幫助',
    helpTitle: '使用說明',
    helpSubtitle: '快速了解 XML 比對流程。',
    helpQuickStartTitle: '快速上手',
    helpQuickStep1: '貼上或上傳 XML A 與 XML B。',
    helpQuickStep2: '選擇檢視模式（並排／內聯／樹狀／Schema）。',
    helpQuickStep3: '用導覽跳轉或下載報告。',
    helpViewsTitle: '檢視模式',
    helpViewSide: '逐行並排比對，支援同步捲動。',
    helpViewInline: '合併視圖顯示新增與刪除。',
    helpViewTree: '樹狀結構變更更清楚。',
    helpViewSchema: '以表與欄位為主的結構差異檢視。',
    helpSchemaCustomTitle: 'Schema 自訂模板',
    helpSchemaCustomStep1: '切換到 Schema 檢視並選擇「自訂」模板。',
    helpSchemaCustomStep2: '點「自訂設定」調整表/欄位標籤與名稱屬性。',
    helpSchemaCustomStep3: '按「套用」重新計算結構差異。',
    helpSchemaCustomNote: '標籤或屬性可填多個，請用逗號分隔。',
    helpReportsTitle: '下載報告',
    helpReportsDesc: '依目前視圖輸出對應摘要。',
    helpTipsTitle: '使用建議',
    helpTipLargeFiles: '大檔模式會降低渲染以提升效能。',
    helpTipChunks: '用段落清單或縮略條快速跳轉。',
    helpShortcutsTitle: '常用快捷鍵',
    helpShortcutPrevNext: 'P / N：上一個／下一個差異。',
    helpShortcutChunkNav: '段落清單：↑/↓、Home/End 移動；Enter/Space 跳轉。',
    helpShortcutEscape: 'Esc：關閉說明抽屜。',
    helpLargeFileLimitTitle: '大檔模式限制',
    helpLargeFileLimitHighlight: '為了效能，語法高亮會停用。',
    helpLargeFileLimitCollapsed: '未變更內容可能折疊為差異視窗。',
    helpLargeFileLimitProgressive: '捲動時採分批渲染。',
    helpLargeFileLimitOverride: '可按「顯示完整渲染」關閉大檔模式。',
    emptyTitle: '歡迎使用 XML Diff Tool',
    emptySubtitle: '貼上 XML 或先用範例快速上手。',
    emptyStep1: '上傳或貼上 XML A 與 XML B。',
    emptyStep2: '選擇最適合的檢視模式。',
    emptyStep3: '檢視差異並輸出報告。',
    emptyUseSample: '使用範例 XML',
    emptyOpenHelp: '開啟說明',
    emptyDropHint: '拖拉 XML 檔案到此',
    emptyPrivacyNote: '所有處理皆在本機瀏覽器完成。',
    emptySampleHint: '約 30 秒示範，快速上手。',
    emptyPasteHint: '或直接貼上 XML 內容。',
    emptyStepLabel: '步驟',

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
    downloadSide: '並排摘要',
    downloadInline: '內聯摘要',
    downloadTree: '樹狀摘要',
    downloadSchema: 'Schema 摘要',

    // Filter hints
    modifiedNotAvailableInline: '「修改」篩選器不適用於內聯視圖（請使用新增/刪除）',

    // Filter actions
    resetFilters: '重置',

    // Stats unit
    statsLines: '行',
    statsNodes: '節點',
    statsFields: '欄位',

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
    backToBatch: '返回批量比較',
    batchSearchPlaceholder: '搜尋檔案...',
    batchSortLabel: '排序',
    batchSortAsc: '升冪',
    batchSortDesc: '降冪',
    batchSortName: '檔名',
    batchSortAdded: '新增',
    batchSortRemoved: '刪除',
    batchSortModified: '修改',
    batchSortStatus: '狀態',
    batchFilterStatusLabel: '狀態篩選',
    batchFilterDiffLabel: '差異篩選',
    batchFilterAll: '全部',
    batchFilterHasDiff: '有差異',
    batchFilterNoDiff: '無差異',
    batchFilterFailed: '失敗',
    batchFilterOnlyA: '僅在 A',
    batchFilterOnlyB: '僅在 B',
    batchStatusLabel: '狀態',
    batchNoResults: '沒有符合的結果',
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
    overviewModeLabel: '導覽模式',
    overviewModeAuto: '自動',
    overviewModeMinimap: '縮略條',
    overviewModeHybrid: '混合',
    overviewModeChunks: '段落',
    overviewModeAutoHint: '自動：{mode}',
    overviewCoverageLabel: '覆蓋率 {percent}%',
    overviewHighDensity: '高密度',
    overviewHighDensityHint: '差異覆蓋過高，已切換段落模式。',
    chunkListTitle: '差異段落',
    chunkCountLabel: '共 {count} 段',
    chunkLabel: '段落',
    chunkRangeLabel: '行 {start}-{end}',
    chunkFilterLabel: '段落篩選',
    chunkFilterAll: '全部',
    chunkEmpty: '沒有符合的段落',
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
    inspectMode: '解析模式',
    editMode: '编辑模式',
    expandPanel: '放大视窗',
    restorePanel: '还原视窗',
    inspectTreeTitle: '树状导航',
    inspectTreeEmpty: '没有可显示的节点',
    inspectSearchPlaceholder: '搜索节点/属性/文本...',
    inspectSearchCount: '{current}/{total}',
    inspectSearchNoMatch: '没有匹配项',
    inspectSearchPrev: '上一项',
    inspectSearchNext: '下一项',

    // View Tabs
    sideBySide: '并排对比',
    inline: '内联对比',
    treeView: '树形视图',
    schemaView: 'Schema 视图',

    // Diff Summary
    diffSummary: '差异摘要:',
    added: '新增',
    removed: '删除',
    modified: '修改',
    unchanged: '未变',
    sideOnlyA: '仅 A',
    sideOnlyB: '仅 B',
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

    // Schema View
    schemaTable: '表',
    schemaField: '字段',
    schemaFieldCount: '{count} 字段',
    schemaNoChanges: '没有结构差异',
    schemaNoTableMatch: '当前模板（{preset}）没有匹配到表，请调整',
    schemaAttributeType: '类型',
    schemaAttributeSize: '大小',
    schemaAttributeDefault: '默认值',
    schemaInTable: '属于 {table}',
    schemaPresetLabel: '模板',
    schemaPresetStruct: '结构/字段（struct/entry）',
    schemaPresetXsd: 'XSD（complexType/element）',
    schemaPresetTable: '表/字段（table/column）',
    schemaPresetCustom: '自定义',
    schemaCustomTitle: '自定义模板',
    schemaCustomTableTags: '表节点标签',
    schemaCustomFieldTags: '字段节点标签',
    schemaCustomTableNameAttrs: '表名称属性',
    schemaCustomFieldNameAttrs: '字段名称属性',
    schemaCustomIgnoreNodes: '忽略节点',
    schemaCustomIgnoreNamespaces: '忽略命名空间',
    schemaCustomCaseSensitive: '名称大小写区分',
    schemaCustomFieldSearchMode: '字段搜索范围',
    schemaCustomFieldSearchChildren: '仅子层',
    schemaCustomFieldSearchDescendants: '包含深层',
    schemaCustomListHint: '可填多个，用逗号分隔',
    schemaCustomApply: '应用',
    schemaCustomReset: '还原',
    schemaCustomOpen: '自定义设置',
    schemaSummaryTitle: 'Schema 摘要',
    schemaFilterAll: '全部',
    schemaFilterTables: '表',
    schemaFilterFields: '字段',
    schemaTableChanges: '表格差异',
    schemaFieldChanges: '字段差异',
    schemaTableAddedLabel: '新增表',
    schemaTableRemovedLabel: '删除表',
    schemaTableModifiedLabel: '修改表',
    schemaFieldAddedLabel: '新增字段',
    schemaFieldAddedExistingLabel: '新增字段（已有表）',
    schemaFieldAddedFromNewTableLabel: '新增字段（新增表）',
    schemaFieldRemovedLabel: '删除字段',
    schemaFieldModifiedLabel: '修改字段',

    enabled: '启用',
    disabled: '关闭',

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
    close: '关闭',

    // Help & Empty State
    help: '帮助',
    helpTitle: '使用说明',
    helpSubtitle: '快速了解 XML 对比流程。',
    helpQuickStartTitle: '快速上手',
    helpQuickStep1: '粘贴或上传 XML A 与 XML B。',
    helpQuickStep2: '选择视图模式（并排／内联／树状／Schema）。',
    helpQuickStep3: '用导览跳转或下载报告。',
    helpViewsTitle: '视图模式',
    helpViewSide: '逐行并排对比，支持同步滚动。',
    helpViewInline: '合并视图显示新增与删除。',
    helpViewTree: '树状结构变更更清楚。',
    helpViewSchema: '以表与字段为主的结构差异视图。',
    helpSchemaCustomTitle: 'Schema 自定义模板',
    helpSchemaCustomStep1: '切换到 Schema 视图并选择「自定义」模板。',
    helpSchemaCustomStep2: '点「自定义设置」调整表/字段标签与名称属性。',
    helpSchemaCustomStep3: '点「应用」重新计算结构差异。',
    helpSchemaCustomNote: '标签或属性可填多个，请用逗号分隔。',
    helpReportsTitle: '下载报告',
    helpReportsDesc: '按当前视图输出对应摘要。',
    helpTipsTitle: '使用建议',
    helpTipLargeFiles: '大文件模式会降低渲染以提升性能。',
    helpTipChunks: '用段落列表或缩略条快速跳转。',
    helpShortcutsTitle: '常用快捷键',
    helpShortcutPrevNext: 'P / N：上一个/下一个差异。',
    helpShortcutChunkNav: '段落列表：↑/↓、Home/End 移动；Enter/Space 跳转。',
    helpShortcutEscape: 'Esc：关闭说明抽屉。',
    helpLargeFileLimitTitle: '大文件模式限制',
    helpLargeFileLimitHighlight: '为性能，语法高亮会停用。',
    helpLargeFileLimitCollapsed: '未变更内容可能折叠为差异窗口。',
    helpLargeFileLimitProgressive: '滚动时采用分批渲染。',
    helpLargeFileLimitOverride: '可点「显示完整渲染」关闭大文件模式。',
    emptyTitle: '欢迎使用 XML Diff Tool',
    emptySubtitle: '粘贴 XML 或先用示例快速上手。',
    emptyStep1: '上传或粘贴 XML A 与 XML B。',
    emptyStep2: '选择最适合的视图模式。',
    emptyStep3: '查看差异并导出报告。',
    emptyUseSample: '使用示例 XML',
    emptyOpenHelp: '打开说明',
    emptyDropHint: '拖拽 XML 文件到此',
    emptyPrivacyNote: '所有处理均在本地浏览器完成。',
    emptySampleHint: '约 30 秒示范，快速上手。',
    emptyPasteHint: '或直接粘贴 XML 内容。',
    emptyStepLabel: '步骤',

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
    downloadSide: '并排摘要',
    downloadInline: '内联摘要',
    downloadTree: '树状摘要',
    downloadSchema: 'Schema 摘要',

    // Filter hints
    modifiedNotAvailableInline: '"修改"筛选器不适用于内联视图（请使用新增/删除）',

    // Filter actions
    resetFilters: '重置',

    // Stats unit
    statsLines: '行',
    statsNodes: '节点',
    statsFields: '字段',

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
    backToBatch: '返回批量比较',
    batchSearchPlaceholder: '搜索文件...',
    batchSortLabel: '排序',
    batchSortAsc: '升序',
    batchSortDesc: '降序',
    batchSortName: '文件名',
    batchSortAdded: '新增',
    batchSortRemoved: '删除',
    batchSortModified: '修改',
    batchSortStatus: '状态',
    batchFilterStatusLabel: '状态筛选',
    batchFilterDiffLabel: '差异筛选',
    batchFilterAll: '全部',
    batchFilterHasDiff: '有差异',
    batchFilterNoDiff: '无差异',
    batchFilterFailed: '失败',
    batchFilterOnlyA: '仅在 A',
    batchFilterOnlyB: '仅在 B',
    batchStatusLabel: '状态',
    batchNoResults: '没有匹配的结果',
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
    overviewModeLabel: '导覽模式',
    overviewModeAuto: '自动',
    overviewModeMinimap: '缩略条',
    overviewModeHybrid: '混合',
    overviewModeChunks: '段落',
    overviewModeAutoHint: '自动：{mode}',
    overviewCoverageLabel: '覆盖率 {percent}%',
    overviewHighDensity: '高密度',
    overviewHighDensityHint: '差异覆盖过高，已切换段落模式。',
    chunkListTitle: '差异段落',
    chunkCountLabel: '共 {count} 段',
    chunkLabel: '段落',
    chunkRangeLabel: '行 {start}-{end}',
    chunkFilterLabel: '段落筛选',
    chunkFilterAll: '全部',
    chunkEmpty: '没有符合的段落',
  },
};

export const languageNames: Record<Language, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
};

export const defaultLanguage: Language = 'en';

