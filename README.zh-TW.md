# XML Diff Tool

[English](README.md) | **繁體中文** | [简体中文](README.zh-CN.md)

這是一個純前端的 XML 差異比對工具，可視覺化呈現兩份 XML 文件之間的差異，所有處理都在瀏覽器本機完成。

## 特色

- 單檔比對與批次比對模式
- 三種視圖：並排、行內（Unified Diff）、樹狀
- 大檔模式
  - 單側大檔自動進入預覽
  - 可切換為完整渲染
  - 降低渲染與語法高亮成本
  - 行級差異於 Web Worker 計算，避免卡頓或記憶體壓力
- 差異篩選、摘要與導覽
- 拖放上傳、交換內容、XML 格式化
- 下載差異報告（HTML/Text）
- 多主題與多語系介面

## 大檔提示

- 大檔會在該側自動進入預覽模式。
- 可點「展開完整內容」查看完整內容。

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
- 請在 repo 設定中將 Pages Source 設為「GitHub Actions」。
- 網址：https://adalf0722.github.io/xml_diff_tool/

## 隱私

所有 XML 處理都在本機瀏覽器完成，不會上傳任何資料到伺服器。

## License

MIT
