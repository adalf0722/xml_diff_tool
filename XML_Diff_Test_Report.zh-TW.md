# XML Diff Tool 測試報告與識別邏輯手冊

本手冊旨在透過具體的測試案例，說明 **XML Diff Tool** 如何在不同視角下處理數據差異。這有助於使用者根據需求（如：代碼校對或數據邏輯檢查）選擇最合適的比對模式。

---

## 🧪 核心測試案例：巢狀結構物件替換

此案例模擬一個典型的員工資料異動：`Alice` 職位提升，而 `Bob` 離職並由新進員工 `Charlie` 取代。

### 原始資料 (Source XML - A)
```xml
<employees>
  <department name="Engineering">
    <person id="E01">
      <name>Alice</name>
      <role>Developer</role>
    </person>
    <person id="E02">
      <name>Bob</name>
      <role>Manager</role>
    </person>
  </department>
</employees>

```

### 新資料 (Target XML - B)

```xml
<employees>
  <department name="Engineering">
    <person id="E01">
      <name>Alice</name>
      <role>Senior Developer</role>
    </person>
    <person id="E03">
      <name>Charlie</name>
      <role>Intern</role>
    </person>
  </department>
</employees>

```

---

## 🔍 三種視角識別邏輯分析

根據測試結果，本工具針對相同的 XML 變動提供了三種不同的邏輯解讀：

### 1. 並排對比 (Side-by-Side View)

* **核心邏輯**：基於行號的文字對齊 (Line-based Text Diff)。
* **表現形式**：將異動區塊整體標記為 **黃色 (修改)**。
* **分析**：工具會對齊左右兩側的標籤位置。當結構位置相同（如列表第二項），它會傾向於將其視為「內容更新」，適合快速檢查代碼的文字微調。

### 2. 內聯對比 (Inline View)

* **核心邏輯**：統一行差異 (Unified Diff)。
* **表現形式**：採用 **紅色 (-)** 標示移除，**綠色 (+)** 標示新增。
* **分析**：此模式將差異視為「舊行刪除、新行插入」的連續過程，符合版本控制系統（如 Git）的閱讀習慣，能清楚呈現修改前後的文本流。

### 3. 樹狀檢視 (Tree View) 🌟

* **核心邏輯**：XML 節點語意比對 (Semantic/Node-based Diff)。
* **表現形式**：
* **黃色 (修改)**：標記單一屬性或值的變更（如 Alice 的職位）。
* **紅色 (刪除)**：標記該節點實體已被刪除（如 `id="E02"` 的 Bob）。
* **綠色 (新增)**：標記該節點實體為全新新增（如 `id="E03"` 的 Charlie）。


* **分析**：**這是最精準的資料比對方式**。具備語意感知，能區分「物件替換」與「文字修改」的差異。

---

## 🏆 終極測試：節點順序調換 (Reordering)

![test_result](public/test_result.jpg)

當 XML 內容完全一致，僅子節點（如 <author> 與 <price>）順序更換時：

* 樹狀檢視表現：顯示 「兩個 XML 文件完全相同」。
* 技術優勢：證明工具能解析 DOM 結構，忽略無關緊要的排版順序，確保數據邏輯的一致性。

--- 

## 📊 綜合評測總結

| 比對模式 | 判定邏輯 | 偵測深度 | 最佳使用場景 |
| --- | --- | --- | --- |
| **並排對比** | 文字對齊 | 表面文字 | 代碼排版檢查、快速參數核對 |
| **內聯對比** | 行式更新 | 文字流程 | 程式碼審閱 (Code Review) |
| **樹狀檢視** | 節點解析 | 邏輯結構 | **資料同步確認、API 結構核對** |

---
