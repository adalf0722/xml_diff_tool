# XML Diff Tool 测试报告与识别逻辑手册

本文旨在通过具体的测试案例，说明 **XML Diff Tool** 如何在不同视角下处理数据差异。这有助于使用者根据需求（如：代码校对或数据逻辑检查）选择最合适的比对模式。

---

## 核心测试案例：嵌套结构对象替换

此案例模拟一个典型的员工资料变动：`Alice` 职位提升，而 `Bob` 离职并由新进员工 `Charlie` 取代。

### 原始资料 (Source XML - A)
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

### 新资料 (Target XML - B)

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

## 三种视角识别逻辑分析

根据测试结果，本工具针对相同的 XML 变动提供了三种不同的逻辑解读：

### 1. 并排对比 (Side-by-Side View)

* **核心逻辑**：基于行号的文字对齐 (Line-based Text Diff)。
* **表现形式**：将差异区块整体标记为 **黄色（修改）**。
* **分析**：工具会对齐左右两侧的标签位置。当结构位置相同（如列表第二项）时，它会倾向于将其视为“内容更新”，适合快速检查代码的文字微调。

### 2. 行内对比 (Inline View)

* **核心逻辑**：统一行差异 (Unified Diff)。
* **表现形式**：采用 **红色 (-)** 标示删除，**绿色 (+)** 标示新增。
* **分析**：此模式将差异视为“旧行删除、新行插入”的连续过程，符合版本控制系统（如 Git）的阅读习惯，能清楚呈现修改前后的文本流。

### 3. 树状检视 (Tree View)

* **核心逻辑**：XML 节点语义比对 (Semantic/Node-based Diff)。
* **表现形式**：
* **黄色（修改）**：标记单一属性或值的变更（如 Alice 的职位）。
* **红色（删除）**：标记该节点实体已被删除（如 `id="E02"` 的 Bob）。
* **绿色（新增）**：标记该节点实体为全新新增（如 `id="E03"` 的 Charlie）。


* **分析**：**这是最精准的资料比对方式**。具备语义感知，能区分“对象替换”与“文字修改”的差异。

---

## 终极测试：节点顺序调换 (Reordering)

![test_result](public/test_result.jpg)

当 XML 内容完全一致，仅子节点（如 <author> 与 <price>）顺序更换时：

* 树状检视表现：显示“两个 XML 文档完全相同”。
* 技术优势：证明工具能解析 DOM 结构，忽略无关紧要的排列顺序，确保数据逻辑的一致性。

--- 

## 综合评测总结

| 比对模式 | 判定逻辑 | 侦测深度 | 最佳使用场景 |
| --- | --- | --- | --- |
| **并排对比** | 文字对齐 | 表面文字 | 代码排版检查、快速参数核对 |
| **行内对比** | 行式更新 | 文字流程 | 代码审阅 (Code Review) |
| **树状检视** | 节点解析 | 逻辑结构 | **资料同步确认、API 结构核对** |

---
