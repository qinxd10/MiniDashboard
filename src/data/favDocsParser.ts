/* ============================================================
   常用文档 md 存储核心（纯函数，无 Obsidian 依赖，可 node:test 单测）。

   文档格式（用户可直接在 Obsidian 里编辑，与卡片双向同步）：
   # 常用文档

   - [[Projects/项目A|项目A]]
   - [[Daily/2026-08-24|今日日记]]
   - [[Inbox/随手记]]

   规则：
   - 每行 `- [[路径|显示名]]`，显示名可省略（缺省用文件名）；
   - 路径为库内相对路径（可省略 .md，解析时自动补全）；
   - 其他行（标题、注释、空行）原样保留，本模块只做「解析 + 行级改写」。
   ============================================================ */

import type { FavoriteDoc } from '../settings';

/** 解析结果：文档 + 所在原始行下标 */
export interface ParsedDoc {
	doc: FavoriteDoc;
	line: number;
}

/** 把一行解析成常用文档；不匹配返回 null */
function parseDocLine(line: string): FavoriteDoc | null {
	const m = /^\s*-\s*\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]\s*$/.exec(line.trim());
	if (!m) return null;
	let path = (m[1] ?? '').trim();
	if (!path) return null;
	if (!/\.md$/i.test(path)) path += '.md';
	const title = (m[2] ?? '').trim();
	return { path, title };
}

/** 解析常用文档文档内容，返回按文档顺序的列表（含行号） */
export function parseDocsMd(content: string): ParsedDoc[] {
	const lines = content.split(/\r?\n/);
	const out: ParsedDoc[] = [];
	lines.forEach((line, i) => {
		const doc = parseDocLine(line);
		if (doc) out.push({ doc, line: i });
	});
	return out;
}

/** 单行序列化：- [[路径|显示名]] */
function docToLine(doc: FavoriteDoc): string {
	const path = doc.path.replace(/\.md$/i, '');
	const title = (doc.title ?? '').trim();
	return title ? `- [[${path}|${title}]]` : `- [[${path}]]`;
}

/** 全量重建文档；用于旧数据首次迁移与兜底 */
export function serializeDocs(docs: FavoriteDoc[]): string {
	const parts = ['# 常用文档', ''];
	for (const d of docs) parts.push(docToLine(d));
	return parts.join('\n') + '\n';
}

function findPathLine(lines: string[], path: string): number {
	for (let i = 0; i < lines.length; i++) {
		const d = parseDocLine(lines[i] ?? '');
		if (d && d.path === path) return i;
	}
	return -1;
}

/** 追加 / 更新一个文档（按路径去重，已存在则原位替换） */
export function upsertDocLine(content: string, doc: FavoriteDoc): string | null {
	const lines = content.split(/\r?\n/);
	const existIdx = findPathLine(lines, doc.path);
	const line = docToLine(doc);
	if (existIdx >= 0) {
		lines[existIdx] = line;
		return lines.join('\n');
	}
	// 插入到最后一个文档行之后（保持列表连续），末尾补空行
	let last = -1;
	for (let i = 0; i < lines.length; i++) {
		if (parseDocLine(lines[i] ?? '')) last = i;
	}
	if (last >= 0) {
		lines.splice(last + 1, 0, line);
	} else {
		// 无任何文档行：追加到末尾
		const tail = lines[lines.length - 1]?.trim() === '' ? lines : [...lines, ''];
		tail.push(line);
		return tail.join('\n') + '\n';
	}
	return lines.join('\n');
}

/** 删除指定路径的文档行 */
export function removeDocLine(content: string, path: string): string | null {
	const lines = content.split(/\r?\n/);
	const idx = findPathLine(lines, path);
	if (idx < 0) return null;
	lines.splice(idx, 1);
	return lines.join('\n');
}

/** 上移/下移：交换与相邻文档行的位置（delta = ±1） */
export function moveDocLine(content: string, path: string, delta: number): string | null {
	const lines = content.split(/\r?\n/);
	const idx = findPathLine(lines, path);
	if (idx < 0) return null;
	// 找相邻文档行
	let target = -1;
	if (delta < 0) {
		for (let i = idx - 1; i >= 0; i--) {
			if (parseDocLine(lines[i] ?? '')) { target = i; break; }
		}
	} else {
		for (let i = idx + 1; i < lines.length; i++) {
			if (parseDocLine(lines[i] ?? '')) { target = i; break; }
		}
	}
	if (target < 0) return null;
	[lines[idx], lines[target]] = [lines[target], lines[idx]];
	return lines.join('\n');
}
