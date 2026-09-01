# Sample Data ｜ 示例数据

本目录为各模块准备的示例数据，用于快速体验。把文件复制进你的 Vault 后，在插件 **设置 → 数据存储位置** 确认对应路径（默认名即默认路径，同名复制即可直接用）。

This directory contains sample data for each module. Copy the files into your Vault, then check the matching paths under **Settings → Storage Paths** — same names work with the defaults out of the box.

| 文件 / File | 模块 / Module | 格式 / Format |
| --- | --- | --- |
| `Dashboard/待办事项.md` | 待办 · 今天要处理（Kanban 双向兼容） | `## 列` + `- [ ] / - [x]`，含 `✅ 完成日期` |
| `Dashboard/网站收藏.md` | 网站收藏 | `## 分类` + `- 名称 → 网址 #关键词` |
| `Dashboard/常用文档.md` | 常用文档 | `- [[库内路径\|显示名]]`（原生双链） |
| `Dashboard/Temp/2026-09-01 09-30 捕捉.md` | 灵感捕捉（自动生成示例） | 按命名规则生成的笔记 |

- 待办文件为 Obsidian Kanban 格式，Kanban 插件同样可读写。
- 天气 / 日历 无需数据文件（插件自动获取）。
- 常用文档里的 `[[双链]]` 指向示例笔记，按你的库调整即可。

- The to-do file is a standard Obsidian Kanban file — the Kanban plugin can read and write it too.
- Weather / Calendar need no data file (fetched automatically).
- The `[[links]]` in `常用文档.md` point to example notes — adjust them to your vault.
