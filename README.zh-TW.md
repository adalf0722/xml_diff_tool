# XML Diff Tool

[English](README.md) | **繁體中文** | [簡體中文](README.zh-CN.md)

這是一個純前端的 XML 差異比對工具，可視覺化呈現兩份 XML 文件之間的差異。所有處理都在瀏覽器本機完成。

<div style="display: flex; gap: 12px; align-items: center;">
  <img src="public/side.webp" alt="Side by Side view" style="width: 32%; border-radius: 8px;" />
  <img src="public/inline.webp" alt="Inline view" style="width: 32%; border-radius: 8px;" />
  <img src="public/tree.webp" alt="Tree view" style="width: 32%; border-radius: 8px;" />
</div>

## 特色

- 單檔與批量比較模式
- 四種檢視：並排、內聯（Unified Diff）、樹狀、Schema
- 模式選擇列提供短標籤與推薦（並排＝左右對照、內聯＝合併行、樹狀＝結構、Schema＝表/欄位）
- Schema 檢視：表/欄位差異與模板（struct/entry、XSD、table/column），支援自訂模板
- 規範警告與嚴格模式：偵測標籤外字串與非法字元，點警告可直接跳到對應行/欄位（單檔解析也適用）
- 剖析模式：精準行號/欄位跳轉與片段摘要，大檔模式採階段滾動確保定位
- 大檔模式
  - 單側大檔自動預覽
  - 可切換完整渲染
  - 降低渲染與語法高亮以提升效能
  - 行級差異在 Web Worker 計算，避免卡頓
- 差異篩選、摘要與導覽
- 拖放上傳、交換、XML 格式化
- 模式對應報告（HTML/Text，並排/內聯/樹狀/Schema）
- 覆蓋率導覽模式與段落清單
- 主題與多語系介面

## 檢視模式建議

- 並排比對：精準逐行核對，支援同步捲動
- 內聯比對：精簡新增/刪除清單（不顯示「修改」）
- 樹狀檢視：結構與層級變更
- Schema 檢視：表/欄位定義與屬性變更

## 驗證與剖析

- 警告：偵測標籤外文字、非法符號與異常節點；「嚴格模式」可強制驗證。
- 跳轉高亮：點擊警告會展開剖析模式並捲動到對應行/欄位，同時高亮片段（支援差異與單檔）。
- 大檔：在大檔模式下採分階段滾動，確保定位精準。

## 常見誤會

- 並排/內聯需要同時有 XML A 與 XML B
- 內聯不會顯示「修改」，會拆成刪除＋新增
- Schema 只看結構，不是行級差異

## 大檔提示

- 大檔會在該側預覽模式顯示。
- 可點「顯示完整內容」展開完整內容。

## 技術棧

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Lucide React

## 開發

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 建置正式版本
npm run build
```

## 部署（GitHub Pages）

- GitHub Actions 會建置並部署 `dist` 到 Pages。
- 在 repo 設定中將 Pages Source 設為「GitHub Actions」。
- 網址：https://adalf0722.github.io/xml_diff_tool/

## 隱私

所有 XML 處理皆在瀏覽器本機完成，不會上傳任何資料到伺服器。

## License

MIT
