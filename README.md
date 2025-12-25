# XML Diff Tool

**English** | [Traditional Chinese](README.zh-TW.md) | [Simplified Chinese](README.zh-CN.md)

A pure frontend XML comparison tool that visually presents differences between two XML documents. All processing happens locally in the browser.

<div style="display: flex; gap: 12px; align-items: center;">
  <img src="public/side.webp" alt="Side by Side view" style="width: 32%; border-radius: 8px;" />
  <img src="public/inline.webp" alt="Inline view" style="width: 32%; border-radius: 8px;" />
  <img src="public/tree.webp" alt="Tree view" style="width: 32%; border-radius: 8px;" />
</div>

## Features

- Single File and Batch Compare modes
- Three view modes: Side by Side, Inline (Unified Diff), and Tree View
- Large file mode
  - Per-side preview for large inputs
  - Optional full rendering toggle
  - Reduced rendering and syntax highlighting for performance
  - Line diff computed in a Web Worker with safe fallback for huge inputs
- Diff filters, summary, and navigation
- Drag and drop upload, swap, and XML formatting
- Download diff reports (HTML/Text)
- Themes and multi-language UI

## Large File Notes

- Large inputs default to preview mode on that side.
- Use "Show full content" to expand a large input.

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Lucide React

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Deployment (GitHub Pages)

- GitHub Actions builds and deploys `dist` to Pages.
- In repo settings, set Pages Source to "GitHub Actions".
- Site URL: https://adalf0722.github.io/xml_diff_tool/

## Privacy

All XML processing is done locally in the browser. No data is uploaded to any server.

## License

MIT
