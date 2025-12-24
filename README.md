# XML Diff Tool

**English** | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

A pure frontend XML comparison tool that visually presents differences between two XML documents.

## Features

- 🔍 **Three View Modes**
  - **Side by Side** - Display differences in parallel panels with synchronized scrolling
  - **Inline** - Unified display, similar to Git Diff (Unified Diff format)
  - **Tree View** - Display XML node differences in a tree structure

- 🎨 **Multiple Themes**
  - Default - Default dark theme
  - Linear - Minimalist focused style
  - GitHub - VS Code / GitHub style
  - Supabase - Professional dashboard style

- 🌐 **Multi-language Support**
  - English
  - Traditional Chinese (繁體中文)
  - Simplified Chinese (简体中文)

- 🛠️ **Useful Features**
  - Diff type filtering (Added/Removed/Modified)
  - Auto-reset filters on view switch
  - Manual reset button for quick filter restoration
  - Quick diff navigation (Previous/Next diff)
  - Dual-side synchronized highlighting (Side by Side and Tree View)
  - Download diff reports (HTML/Text formats)
  - Drag & drop XML file upload
  - XML formatting/beautification

## Diff Types

### Side by Side & Tree View

| Type | Color | Description |
|------|-------|-------------|
| Added | 🟢 Green | Nodes/lines that only exist in the new XML |
| Removed | 🔴 Red | Nodes/lines that only exist in the original XML |
| Modified | 🟡 Yellow | Exists in both but with different content |
| Unchanged | No highlight | Identical content |

### Inline (Unified Diff Format)

The inline view uses the industry-standard Unified Diff format, consistent with Git, GitHub, and other tools:

| Type | Display | Description |
|------|---------|-------------|
| Added | `+` Green line | Added line |
| Removed | `-` Red line | Removed line |
| Context | No prefix | Unchanged context line |

> **Note**:
> - In inline view, the **"Modified" filter is disabled** because Unified Diff format only has "Added" and "Removed" concepts
> - Inline view statistics are **line-level** (displayed as "Diff Summary: (lines)"), while other views are **node-level**
> - Navigation counter dynamically adjusts based on view type (line-level vs node-level)

## Diff Navigation

### Navigation Buttons
- **Previous Diff** - Jump to the previous diff location
- **Next Diff** - Jump to the next diff location
- Navigation auto-scrolls and flashes the target position
- Side by Side and Tree View highlight both left and right sides simultaneously

### Navigation Count
Different views have different diff counting methods:
- **Side by Side** - Based on line-level diffs, modifications count as 1 diff
- **Inline** - Based on line-level diffs, each +/- line counts as 1 diff
- **Tree View** - Based on node-level diffs

## Filters

### Filter Behavior
- Click filter badges (Added/Removed/Modified) to toggle display of that type
- Filters **auto-reset** to default state (all selected) when switching views
- A "Reset" button appears when filters are not in default state

### "Unchanged" Statistics
- "Unchanged" is display-only, not a clickable filter
- Since unchanged content has no highlighting, filtering is unnecessary

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS v4
- Lucide React Icons

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Privacy

All XML processing is done locally in the browser. No data is uploaded to any server.

## License

MIT

