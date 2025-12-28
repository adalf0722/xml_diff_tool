# 覆蓋率門檻 + 自動切換 UI 計畫

## 目標
- 高覆蓋率時不再依賴縮略條，改用差異段落導覽，確保可用性。
- 低/中覆蓋率時維持縮略條帶來的空間感與快速跳轉。

## 核心概念
- 覆蓋率 (coverage) 作為模式切換信號。
- 視覺導覽分成三種模式：Minimap / Hybrid / Chunks。

## 覆蓋率計算
- Side/Inline: coverage = diffLines / totalLines
- Tree: coverage = diffNodes / totalNodes
- 輔助指標: diff chunks 數量 (例如 > 200 也視為高密度)

## 切換規則 (預設)
- coverage < 0.40 => Minimap
- 0.40 <= coverage <= 0.80 => Hybrid
- coverage > 0.80 => Chunks

## UI 模式定義
- Minimap: 顯示縮略條 (細線/熱度) + 點擊跳轉。
- Hybrid: 縮略條 + 差異段落列表 (簡化版)。
- Chunks: 以段落列表為主，縮略條可隱藏或降級為極簡提示。

## 差異段落列表 (Chunks)
- 顯示項目: 段落編號、起訖範圍、差異類型比例/摘要。
- 操作: 點擊跳轉、篩選 added/removed/modified。
- 狀態: 顯示當前段落 (active) 與覆蓋率提示。

## 互動流程
- Diff 完成后計算 coverage => 選擇預設模式。
- 提供模式切換按鈕 (記住使用者偏好)。
- 高密度時顯示提示: 「差異覆蓋過高，已切換段落模式」。

## 任務拆解
- [ ] 增加 coverage 計算 (Side/Inline/Tree 共用)。
- [ ] 定義 overviewMode 狀態與門檻。
- [ ] 建立 DiffChunkList 元件 (段落列表 + 跳轉)。
- [ ] Minimap/Hybrid/Chunks UI 切換。
- [ ] 覆蓋率提示文案 + 模式切換提示。
- [ ] 記住使用者偏好 (localStorage)。

## 驗收指標
- coverage > 80% 時預設進入段落模式。
- 任何模式下皆可快速跳到差異。
- 模式切換不影響既有導覽與效能。

## 風險與備註
- Chunk 分段策略需避免過碎。
- 高密度下縮略條可能仍需降級或隱藏。
