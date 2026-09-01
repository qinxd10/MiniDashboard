# MiniDashboard — A Minimal Personal Dashboard for Obsidian

> Turn your Obsidian home into a minimal dashboard for **to-dos, weather, calendar, bookmarks, favorite docs, quick capture and a Pomodoro timer**. All data lives in your own local Markdown files — **offline-first, your data stays yours**.

[中文文档](README_CN.md) · English

![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-purple) ![minAppVersion](https://img.shields.io/badge/minApp-1.8.0-blue) ![License](https://img.shields.io/badge/License-ISC-green)

---

## Highlights

- **⚡ Minimal** — Only 7 essential cards, nothing redundant. The bundle is **~130 KB** with **zero runtime dependencies** — no framework, hand-written DOM/SVG.
- **🔗 Markdown-native** — No database — your data *is* Markdown. Bookmarks, favorite docs and the to-do kanban **two-way sync** with their `.md` files; edit the note, the card updates and vice versa.
- **🌐 Bilingual UI** — Switch the whole UI between 中文 and English in one click (Settings → Appearance → Language).
- **🧩 Reorderable modules** — Reorder every card via Settings → Home Modules (move up / down).
- **📐 Resizable modules** — Set each card's **width (1–4 cols) and height (1–4 rows)** to design your own layout.
- **🔒 Local-first** — No accounts, no cloud. Only weather needs network access (wttr.in, key-free).
- **📱 Desktop + Mobile** — Works on desktop **and** Obsidian Mobile, with long-press menus on touch devices.
- **🌗 Light & Dark** — Follows Obsidian appearance, or force dark / light in one click.

---

## Features

| Module | Description |
| --- | --- |
| **To-do · Today** | Quick add, open/done grouping, click to toggle, **double-click to edit**; **fully compatible with the Obsidian Kanban plugin** — reads/writes your existing kanban file, so Kanban keeps working |
| **Weather** | Live clock + **up to 3 cities** (wttr.in, key-free), 10-min cache, manual refresh |
| **Calendar** | Monthly view with **Chinese lunar dates**, today highlighted, prev/next month |
| **Bookmarks** | Grouped by **category**, icons (emoji/favicon), keyword search, add/edit/delete; stored in Markdown with **two-way sync** |
| **Favorites** | Pin frequently used notes to the home page; `- [[path\|title]]` in Markdown with **two-way sync** |
| **Quick Capture** | Type and press enter to create a new note in your Vault; supports templates and naming patterns |
| **Pomodoro** | Focus timer with **work / short / long break** phases, a progress ring, start-pause-reset-skip, a **daily pomodoro counter** and an end-of-session chime (Web Audio) |

---

## Screenshots

<p align="center">
  <img src="assets/screenshot-home.png" alt="Home" width="900"/>
  <br/>
  <sub>Home page</sub>
</p>

---

## Installation

### Manual install (for personal use)

1. Copy the `dashboard` folder into `<your-vault>/.obsidian/plugins/`;
2. Open **Obsidian Settings → Community plugins (Third-party plugins)** and turn **off Restricted mode** (safe mode); if Obsidian asks to restart, do it once first;
3. Find **MiniDashboard** in the installed plugins list and click to **enable** it;
4. **Restart Obsidian** (or run **Reload app without saving** in the command palette);
5. After restarting, look for the **Dashboard icon button in the left sidebar** and click it to open the dashboard.

A ready-to-try data set is included in [`sample-data/`](sample-data/) — copy those files into your vault and every card shows up populated.

---

## Data Format

**All data is plain Markdown in your Vault** — two-way synced, hand-editable, version-controllable.

| Data | Default file | Markdown format |
| --- | --- | --- |
| To-do (Kanban-compatible) | `Dashboard/待办事项.md` (configurable) | `- [ ] / - [x]` task lines under `## Column`, with `[ID::] [状态::]` markers and `✅ done date` |
| Bookmarks | `Dashboard/网站收藏.md` (configurable) | `## Category` groups + `- [icon] name → url #keywords` |
| Favorites | `Dashboard/常用文档.md` (configurable) | `- [[vault-path\|title]]` (native Obsidian links) |
| Quick Capture | configurable folder (default `Dashboard/Temp`) | New note created per naming pattern |
| Weather / Calendar | plugin `data.json` | Plugin configuration data (not a note) |

What the underlying Markdown files look like — hand-editable at any time:

| To-do (Kanban file) | Bookmarks file |
| :---: | :---: |
| <img src="assets/kanban-demo.png" alt="To-do kanban markdown" width="430"/> | <img src="assets/bookmarks-demo.png" alt="Bookmarks markdown" width="430"/> |

All file paths are configurable under **Settings → Storage Paths** and apply immediately.

---

## Customize Layout

The **visibility, order, and size (1–4 cols wide / 1–4 rows tall)** of every home card are managed in **Settings → Home Modules**. Changes apply immediately; "Reset to Default" restores the original layout.

---

## Project Layout

```
.
├─ main.js            # build output (shipped with the plugin)
├─ manifest.json      # plugin manifest
├─ styles.css         # all styles (light/dark adaptive, --ad-* CSS vars)
├─ versions.json      # compatibility version table (community spec)
├─ src/               # TypeScript source
│  ├─ main.ts             # plugin entry: view registration, settings migration, theme
│  ├─ settings.ts         # settings panel + home-module layout management
│  ├─ icons.ts            # hand-written SVG icons
│  ├─ data/               # pure-function data layer (Kanban / Bookmarks / Favorites parsers + tests)
│  └─ views/              # view layer (DashboardView + 3 modals + touch long-press menu)
├─ package.json / tsconfig.json / esbuild.config.mjs
└─ LICENSE
```

---

## License

[ISC](LICENSE) · © 2026 xw

---

> ⚙️ **Principle: your data stays yours.** The plugin sends nothing to any server (except weather requests to wttr.in).
