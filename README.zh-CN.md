# XML Diff Tool

[English](README.md) | [繁體中文](README.zh-TW.md) | **简体中文**

这是一个纯前端的 XML 差异比对工具，可视化呈现两份 XML 文件之间的差异。所有处理都在浏览器本机完成。

<div style="display: flex; gap: 12px; align-items: center;">
  <img src="public/side.webp" alt="Side by Side view" style="width: 32%; border-radius: 8px;" />
  <img src="public/inline.webp" alt="Inline view" style="width: 32%; border-radius: 8px;" />
  <img src="public/tree.webp" alt="Tree view" style="width: 32%; border-radius: 8px;" />
</div>

## 特色

- 单文件与批量对比模式
- 四种视图：并排、内联（Unified Diff）、树状、Schema
- Schema 视图：表/字段差异与模板（struct/entry、XSD、table/column），支持自定义模板
- 大文件模式
  - 单侧大文件自动预览
  - 可切换完整渲染
  - 降低渲染与语法高亮以提升性能
  - 行级差异在 Web Worker 计算，避免卡顿
- 差异筛选、摘要与导航
- 拖放上传、交换、XML 格式化
- 模式对应报告（HTML/Text，并排/内联/树状/Schema）
- 覆盖率导航模式与段落清单
- 主题与多语言界面

## 视图模式建议

- 并排对比：精准逐行核对，支持同步滚动
- 内联对比：精简新增/删除清单（不显示“修改”）
- 树状视图：结构与层级变更
- Schema 视图：表/字段定义与属性变更

## 常见误会

- 并排/内联需要同时有 XML A 与 XML B
- 内联不会显示“修改”，会拆成删除 + 新增
- Schema 只看结构，不是行级差异

## 大文件提示

- 大文件会在该侧预览模式显示。
- 可点“显示完整内容”展开完整内容。

## 技术栈

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Lucide React

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 部署（GitHub Pages）

- GitHub Actions 会构建并部署 `dist` 到 Pages。
- 在 repo 设置中将 Pages Source 设为“GitHub Actions”。
- 网址：https://adalf0722.github.io/xml_diff_tool/

## 隐私

所有 XML 处理均在浏览器本机完成，不会上载任何数据到服务器。

## License

MIT
