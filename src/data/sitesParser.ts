/* ============================================================
   网站收藏 md 存储核心（纯函数，无 Obsidian 依赖，可 node:test 单测）。

   文档格式（用户可直接在 Obsidian 里编辑，与卡片双向同步）：
   # 网站收藏

   ## 工作
   - [🌐] 腾讯云 → https://cloud.tencent.com #云 #工作
   - GitHub → https://github.com #开发

   ## 工具
   - [🧰] 百度 → https://www.baidu.com

   规则：
   - `## 分类名` 定义分组；未分组（# 之前）的站点归「未分类」；
   - 站点行 `- [icon] 名称 → URL [#kw ...]`，icon 可选（方括号包裹的 emoji），
     名称与 URL 用 ` → ` 分隔，行尾 `#标签` 作为搜索关键词；
   - 本模块只做「解析 + 行级改写」，逐行处理、保留注释/空行/其他内容与顺序。
   ============================================================ */

import type { FavoriteSite } from '../settings';

/** 解析结果：站点 + 其所在原始行下标（写回定位用） */
export interface ParsedSite {
	site: FavoriteSite;
	line: number;
}

/** 把一行站点文本拆成 名称 / URL / 关键词；不匹配返回 null。
 *  名称可空（`- → URL`）：无显式名称的站点在卡片里显示链接。
 *  兼容旧的 `- [emoji] 名称 → URL` 行：行首 `[xxx]` 被忽略（已弃用 emoji 图标）。 */
function parseSiteLine(line: string): FavoriteSite | null {
	const m = /^\s*-\s*(?:\[[^\]]+\]\s*)?(.*?)\s*→\s*(\S+)(?:\s+(.*))?$/.exec(line.trim());
	if (!m) return null;
	const name = (m[1] ?? '').trim();
	const url = (m[2] ?? '').trim();
	if (!url) return null;
	const tail = (m[3] ?? '').trim();
	const tags = [...tail.matchAll(/#([^\s#]+)/g)].map((x) => (x[1] ?? '').trim()).filter(Boolean);
	const site: FavoriteSite = { name, url };
	if (tags.length) site.keywords = tags.join(' ');
	return site;
}

/** 解析网站收藏文档内容，返回按文档顺序的站点列表（含行号） */
export function parseSitesMd(content: string): ParsedSite[] {
	const lines = content.split(/\r?\n/);
	const out: ParsedSite[] = [];
	let cat = '';
	lines.forEach((line, i) => {
		const h = /^##\s+(.+?)\s*$/.exec(line.trim());
		if (h) { cat = (h[1] ?? '').trim(); return; }
		const site = parseSiteLine(line);
		if (site) {
			if (cat) site.category = cat;
			out.push({ site, line: i });
		}
	});
	return out;
}

/** 单行序列化：- 名称 → URL #kw（名称可空，空则不写名称段；已弃用 emoji 图标） */
function siteToLine(s: FavoriteSite): string {
	const parts: string[] = [];
	if (s.name && s.name.trim()) parts.push(s.name.trim());
	parts.push('→', s.url);
	if (s.keywords && s.keywords.trim()) {
		parts.push(s.keywords.trim().split(/\s+/).filter(Boolean).map((k) => `#${k}`).join(' '));
	}
	return '- ' + parts.join(' ');
}

/** 全量重建文档（按分类分组，保留首次出现顺序）；用于旧数据首次迁移与兜底 */
export function serializeSites(sites: FavoriteSite[]): string {
	const cats = new Map<string, FavoriteSite[]>();
	for (const s of sites) {
		const c = (s.category && s.category.trim()) ? s.category.trim() : '';
		if (!cats.has(c)) cats.set(c, []);
		cats.get(c)!.push(s);
	}
	const parts: string[] = ['# 网站收藏', ''];
	for (const [cat, list] of cats) {
		if (cat) parts.push(`## ${cat}`, '');
		for (const s of list) parts.push(siteToLine(s));
		parts.push('');
	}
	return parts.join('\n').replace(/\n+$/, '\n');
}

/** 定位某 URL 站点所在行号（返回 -1 表示不存在） */
function findUrlLine(lines: string[], url: string): number {
	for (let i = 0; i < lines.length; i++) {
		const s = parseSiteLine(lines[i] ?? '');
		if (s && s.url === url) return i;
	}
	return -1;
}

/** 某行所在分类（向上找最近 ## 标题；文档开头未分组返回 ''） */
function categoryOfLine(lines: string[], idx: number): string {
	for (let i = idx - 1; i >= 0; i--) {
		const h = /^##\s+(.+?)\s*$/.exec((lines[i] ?? '').trim());
		if (h) return (h[1] ?? '').trim();
	}
	return '';
}

/** 把一行站点插到指定分类段末尾；分类不存在则新建段；cat='' 表示未分类（插到首个 ## 之前） */
function insertIntoCategory(lines: string[], cat: string, line: string): string[] {
	if (cat) {
		let headIdx = -1;
		for (let i = 0; i < lines.length; i++) {
			const h = /^##\s+(.+?)\s*$/.exec((lines[i] ?? '').trim());
			if (h && (h[1] ?? '').trim() === cat) { headIdx = i; break; }
		}
		if (headIdx >= 0) {
			let end = lines.length;
			for (let i = headIdx + 1; i < lines.length; i++) {
				if (/^##\s+/.test((lines[i] ?? '').trim())) { end = i; break; }
			}
			let ins = end;
			while (ins - 1 > headIdx && (lines[ins - 1] ?? '').trim() === '') ins--;
			lines.splice(ins, 0, line);
			return lines;
		}
		// 新建分类段：追加到文档末尾
		if (lines[lines.length - 1]?.trim() !== '') lines.push('');
		lines.push(`## ${cat}`, '', line, '');
		return lines;
	}
	// 未分类：插到第一个 ## 之前（若全文无分类则追加到末尾）
	let firstHead = -1;
	for (let i = 0; i < lines.length; i++) {
		if (/^##\s+/.test((lines[i] ?? '').trim())) { firstHead = i; break; }
	}
	if (firstHead < 0) {
		if (lines[lines.length - 1]?.trim() !== '') lines.push('');
		lines.push(line, '');
	} else {
		lines.splice(firstHead, 0, line);
	}
	return lines;
}

/** 追加 / 更新一个站点：同分类原位替换；跨分类或新增时按分类插入（分类不存在则新建段） */
export function upsertSiteLine(content: string, site: FavoriteSite): string | null {
	const lines = content.split(/\r?\n/);
	const cat = (site.category && site.category.trim()) ? site.category.trim() : '';
	const line = siteToLine(site);
	const existIdx = findUrlLine(lines, site.url);
	if (existIdx >= 0) {
		if (categoryOfLine(lines, existIdx) === cat) {
			// 分类未变：原位替换（保留行位置）
			lines[existIdx] = line;
		} else {
			// 跨分类编辑：删除旧行，插入到新分类段
			lines.splice(existIdx, 1);
			insertIntoCategory(lines, cat, line);
		}
		return lines.join('\n');
	}
	insertIntoCategory(lines, cat, line);
	return lines.join('\n');
}

/** 删除指定 URL 的站点行 */
export function removeSiteLine(content: string, url: string): string | null {
	const lines = content.split(/\r?\n/);
	const idx = findUrlLine(lines, url);
	if (idx < 0) return null;
	lines.splice(idx, 1);
	return lines.join('\n');
}

/** 分类内移动：把某 URL 站点在「同分类相邻站点」间上移/下移（delta = ±1） */
export function moveSiteLine(content: string, url: string, delta: number): string | null {
	const lines = content.split(/\r?\n/);
	const idx = findUrlLine(lines, url);
	if (idx < 0) return null;
	// 收集该站点所属分类内所有站点行下标（按文档顺序）
	const cat = (() => {
		for (let i = idx - 1; i >= 0; i--) {
			const h = /^##\s+(.+?)\s*$/.exec((lines[i] ?? '').trim());
			if (h) return (h[1] ?? '').trim();
		}
		return '';
	})();
	const members: number[] = [];
	for (let i = 0; i < lines.length; i++) {
		const isHeading = /^##\s+/.test((lines[i] ?? '').trim());
		const curCat = (() => {
			for (let j = i - 1; j >= 0; j--) {
				const h = /^##\s+(.+?)\s*$/.exec((lines[j] ?? '').trim());
				if (h) return (h[1] ?? '').trim();
			}
			return '';
		})();
		if (!isHeading && curCat === cat && parseSiteLine(lines[i] ?? '')) members.push(i);
	}
	const pos = members.indexOf(idx);
	if (pos < 0) return null;
	const target = pos + delta;
	if (target < 0 || target >= members.length) return null;
	const a = members[pos]!, b = members[target]!;
	[lines[a], lines[b]] = [lines[b], lines[a]];
	return lines.join('\n');
}
