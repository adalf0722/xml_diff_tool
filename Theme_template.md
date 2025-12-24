# 🎨 Theme Capsule Pack（for XML Diff Tool）

> 使用方式建議：
>
> * 每個 Theme 是一個 `theme.ts` / `theme.json`
> * 支援 runtime 切換（CSS Variables or Tailwind config）
> * 預設載入 `linear-dark`

---

## 🔹 Theme 01 — Linear Dark（Default）

```md
# Theme Capsule: Linear Dark

## Design Philosophy
Extreme focus. Minimal distraction. Built for long diff sessions.
Everything serves readability and diff clarity.

## Color Palette
- Background: #0B0E14
- Surface: #111827
- Surface Alt: #0F172A
- Border Subtle: rgba(255,255,255,0.06)

- Text Primary: #E5E7EB
- Text Secondary: #9CA3AF
- Text Muted: #6B7280

- Diff Added BG: rgba(16,185,129,0.18)
- Diff Added Text: #34D399
- Diff Removed BG: rgba(239,68,68,0.18)
- Diff Removed Text: #F87171
- Diff Modified BG: rgba(234,179,8,0.20)
- Diff Modified Text: #FACC15

- Accent Primary: #8B5CF6
- Accent Glow: rgba(139,92,246,0.35)
- Focus Ring: rgba(139,92,246,0.45)

## Typography
- UI Font: Inter
- Code Font: JetBrains Mono
- Font Size Base: 13px
- Line Height (Code): 1.65
- Font Weight:
  - Normal: 400
  - Medium: 500
  - Semibold: 600

## Spacing System
- Base Unit: 4px
- XS: 4px
- SM: 8px
- MD: 12px
- LG: 16px
- XL: 24px
- Panel Padding: 16px
- Editor Gutter Width: 48px

## Borders & Radius
- Radius XS: 4px
- Radius SM: 6px
- Radius MD: 8px
- Border Width: 1px

## Motion & Animation
- Transition Fast: 120ms ease-out
- Transition Normal: 180ms ease-out
- Hover: subtle brightness + glow
- Focus: 1px glow border (no scale)
- No bounce, no overshoot

## UI Rules
- No shadows, use borders only
- No gradients except glow accents
- Never animate layout shifts
- Highlight diff > highlight UI
```

---

## 🔹 Theme 02 — GitHub / VS Code Diff

```md
# Theme Capsule: GitHub Diff Dark

## Design Philosophy
Zero learning curve.
Looks and behaves exactly like tools engineers already trust.

## Color Palette
- Background: #0D1117
- Surface: #161B22
- Border: #30363D

- Text Primary: #C9D1D9
- Text Secondary: #8B949E

- Diff Added BG: rgba(46,160,67,0.20)
- Diff Added Text: #3FB950
- Diff Removed BG: rgba(248,81,73,0.20)
- Diff Removed Text: #F85149
- Diff Modified BG: rgba(187,128,9,0.25)
- Diff Modified Text: #D29922

- Selection BG: #1F6FEB
- Focus Ring: #1F6FEB

## Typography
- UI Font: -apple-system, BlinkMacSystemFont
- Code Font: SF Mono / Menlo / Consolas
- Font Size Base: 13px
- Line Height: 1.6

## Spacing System
- Base Unit: 4px
- Gutter Padding: 12px
- Line Height Padding: 2px

## Borders & Radius
- Radius: 6px
- Border Width: 1px solid #30363D

## Motion & Animation
- Minimal
- Only hover color changes
- No glow, no easing tricks

## UI Rules
- Follow GitHub diff conventions strictly
- Always show line numbers
- Gutter icons only on hover
```

---

## 🔹 Theme 03 — Supabase Console（Backend / DBA Friendly）

```md
# Theme Capsule: Supabase Console Dark

## Design Philosophy
Professional backend dashboard.
Data-first, system-oriented, trustworthy.

## Color Palette
- Background: #020617
- Surface: #020617
- Panel: #020617
- Border: #1E293B

- Text Primary: #E5E7EB
- Text Secondary: #94A3B8

- Accent Primary: #22C55E
- Accent Secondary: #10B981

- Diff Added BG: rgba(34,197,94,0.18)
- Diff Removed BG: rgba(239,68,68,0.18)
- Diff Modified BG: rgba(59,130,246,0.18)

- Focus Ring: rgba(34,197,94,0.45)

## Typography
- UI Font: Inter
- Code Font: JetBrains Mono
- Font Size Base: 13px
- Line Height: 1.65

## Spacing System
- Base Unit: 4px
- Dashboard Padding: 20px
- Card Gap: 16px

## Borders & Radius
- Radius: 8px
- Border Subtle: 1px solid rgba(148,163,184,0.15)

## Motion & Animation
- Calm fades
- 150–200ms
- No glow, no flash

## UI Rules
- Strong section hierarchy
- Prefer cards over floating panels
- Metrics and summaries are first-class citizens
```

---

## 🧠 切換建議（超重要）

```ts
themes = {
  "linear-dark": "default",
  "github-diff": "compatibility",
  "supabase-console": "dashboard"
}
```

* **第一次打開 → Linear Dark**
* **老派工程師 / Code Review → GitHub Diff**
* **Infra / DBA / 管理視角 → Supabase**

---
