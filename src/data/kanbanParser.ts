/* ============================================================
   Obsidian Kanban 插件双向兼容核心（纯函数，无 Obsidian 依赖，可 node:test 单测）。

   数据格式（obsidian-kanban 插件在 Vault 内存储的真实格式）：
   ---
   kanban-plugin: board
   type: workspace-tasks
   ...
   ---

   ## 列标题

   - [ ] 任务内容 [ID:: loc_xxx] [状态:: 待办]
   - [x] 完成内容 [ID:: loc_yyy] [状态:: 已完成] ✅ 2026-08-21

   %% kanban:settings
   ```
   {...}
   ```
   %%

   本模块只做「解析 + 行级改写」，逐行处理、保留其余内容与顺序，
   确保 Obsidian Kanban 插件仍能正常读取修改后的文件。
   ============================================================ */

export interface KanbanTask {
	/** Kanban 插件生成的稳定 ID（[ID:: xxx]）；缺失时用行号兜底 */
	id: string;
	/** 展示用内容：已剔除 [ID::]/[状态::]/✅ 日期 等插件标记 */
	content: string;
	/** 是否已完成（- [x]） */
	done: boolean;
	/** 状态字段（[状态:: xxx]），缺失时按 done 推导 */
	status: string;
	/** 完成日期（✅ YYYY-MM-DD），无则 null */
	doneDate: string | null;
	/** 所在列标题（## 标题） */
	column: string;
	/** 在原始行数组中的下标，用于写回定位 */
	line: number;
}

export interface KanbanColumn {
	title: string;
	tasks: KanbanTask[];
}

export interface KanbanBoard {
	/** frontmatter 含 kanban-plugin 才视为 Kanban 文件 */
	isKanban: boolean;
	columns: KanbanColumn[];
	/** 全部任务（跨列平铺） */
	tasks: KanbanTask[];
	/** 原始行数组（写回时使用） */
	rawLines: string[];
}

/* ---- helpers ---- */

function stripFrontmatterLines(lines: string[]): { fm: Record<string, string>; bodyStart: number } {
	const fm: Record<string, string> = {};
	if (lines[0]?.trim() !== '---') return { fm, bodyStart: 0 };
	let i = 1;
	for (; i < lines.length; i++) {
		if (lines[i]?.trim() === '---') break;
		const m = /^([^:]+):\s*(.*)$/.exec(lines[i] ?? '');
		if (m) fm[(m[1] ?? '').trim()] = (m[2] ?? '').trim();
	}
	return { fm, bodyStart: i < lines.length ? i + 1 : lines.length };
}

/** 从任务行剩余文本中提取 [键:: 值] 与 ✅ 日期，返回内容剩余部分 */
function splitTaskRest(rest: string): { content: string; id: string; status: string; doneDate: string | null } {
	let content = rest;
	let id = '';
	let status = '';
	let doneDate: string | null = null;

	const idM = /\[ID::\s*([^\]]+)\]/.exec(content);
	if (idM) { id = (idM[1] ?? '').trim(); content = content.replace(idM[0], ' '); }
	const stM = /\[状态::\s*([^\]]+)\]/.exec(content);
	if (stM) { status = (stM[1] ?? '').trim(); content = content.replace(stM[0], ' '); }
	const ddM = /✅\s*(\d{4}-\d{2}-\d{2})/.exec(content);
	if (ddM) { doneDate = ddM[1] ?? null; content = content.replace(ddM[0], ' '); }
	// 清理遗留的「✅」孤立符号与多余空白
	content = content.replace(/✅/g, ' ').replace(/\s+/g, ' ').trim();
	return { content, id, status, doneDate };
}

/** 判断某行是否为任务行，返回 done / null */
function taskMark(line: string): 'done' | 'todo' | null {
	const m = /^\s*-\s*\[([ xX])\]\s*/.exec(line);
	if (!m) return null;
	return m[1] === ' ' ? 'todo' : 'done';
}

/* ---- parse ---- */

/** 解析 Kanban 文件内容；非 Kanban 文件（无 kanban-plugin frontmatter）返回 isKanban=false */
export function parseKanbanBoard(content: string): KanbanBoard {
	const rawLines = content.split(/\r?\n/);
	const { fm } = stripFrontmatterLines(rawLines);
	const isKanban = 'kanban-plugin' in fm;

	const columns: KanbanColumn[] = [];
	const tasks: KanbanTask[] = [];
	let current: KanbanColumn | null = null;

	rawLines.forEach((line, i) => {
		const h = /^##\s+(.+?)\s*$/.exec(line.trim());
		if (h) {
			current = { title: (h[1] ?? '').trim(), tasks: [] };
			columns.push(current);
			return;
		}
		const mark = taskMark(line);
		if (mark && current) {
			const rest = line.replace(/^\s*-\s*\[[ xX]\]\s*/, '');
			const { content: body, id, status, doneDate } = splitTaskRest(rest);
			const task: KanbanTask = {
				id: id || `line-${i}`,
				content: body || rest.trim(),
				done: mark === 'done',
				status: status || (mark === 'done' ? '已完成' : '待办'),
				doneDate,
				column: current.title,
				line: i,
			};
			current.tasks.push(task);
			tasks.push(task);
		}
	});

	return { isKanban, columns, tasks, rawLines };
}

/* ---- write ops（行级，返回新 content；失败返回 null） ---- */

/** 根据行下标把新行写回行数组，返回新 content */
function joinLines(lines: string[]): string {
	return lines.join('\n');
}

/** 解析单行任务的最小定位信息（内容 + 完成状态），用于写回定位校验 */
function taskLocator(line: string): { content: string; done: boolean } | null {
	const mark = taskMark(line);
	if (!mark) return null;
	const rest = line.replace(/^\s*-\s*\[[ xX]\]\s*/, '');
	const { content } = splitTaskRest(rest);
	return { content, done: mark === 'done' };
}

/**
 * 定位任务所在行：优先按 task.line 定位并校验内容一致，失败则按「内容 + 完成状态」全文件匹配。
 * 不依赖 [ID::] —— 兼容 Kanban 插件未启用「ID 标记」的纯 `- [ ]` 文件（最广泛兼容）。
 */
function locateTaskLine(lines: string[], task: { line: number; content: string; done: boolean }): number {
	if (task.line >= 0 && task.line < lines.length) {
		const t = taskLocator(lines[task.line] ?? '');
		if (t && t.content === task.content && t.done === task.done) return task.line;
	}
	for (let i = 0; i < lines.length; i++) {
		const t = taskLocator(lines[i] ?? '');
		if (t && t.content === task.content && t.done === task.done) return i;
	}
	return -1;
}

/** 切换任务完成状态：- [ ] ↔ - [x]、[状态::] 更新（有则改）、完成追加/移除 ✅ 日期 */
export function toggleKanbanTask(content: string, task: { line: number; content: string; done: boolean }, done: boolean, today: string): string | null {
	const lines = content.split(/\r?\n/);
	const idx = locateTaskLine(lines, task);
	if (idx < 0) return null;
	let nl = lines[idx] ?? '';
	nl = nl.replace(/^\s*-\s*\[[ xX]\]/, done ? '- [x]' : '- [ ]');
	if (/\[状态::\s*[^\]]+\]/.test(nl)) {
		nl = nl.replace(/\[状态::\s*[^\]]+\]/, `[状态:: ${done ? '已完成' : '待办'}]`);
	}
	if (done) {
		if (!/✅/.test(nl)) nl = `${nl} ✅ ${today}`;
		else nl = nl.replace(/✅\s*\d{4}-\d{2}-\d{2}/, `✅ ${today}`);
	} else {
		nl = nl.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/g, '').replace(/\s*✅/g, '');
	}
	lines[idx] = nl;
	return joinLines(lines);
}

/** 在指定列插入一条新任务（new-card-insertion-method 默认 prepend：插到列内最前）。
 *  保持与 Kanban 插件默认一致：仅 `- [ ] 内容`，不附加 [ID::]/[状态::]，避免污染未启用 ID 的文件。 */
export function addKanbanTask(content: string, columnTitle: string, text: string): string | null {
	const lines = content.split(/\r?\n/);
	const newLine = `- [ ] ${text.trim()}`;
	let headingIdx = -1;
	for (let i = 0; i < lines.length; i++) {
		const h = /^##\s+(.+?)\s*$/.exec((lines[i] ?? '').trim());
		if (h && (h[1] ?? '').trim() === columnTitle) { headingIdx = i; break; }
	}
	if (headingIdx === -1) return null;

	// 跳过标题后的空行，定位第一个非空行
	let i = headingIdx + 1;
	while (i < lines.length && (lines[i] ?? '').trim() === '') i++;
	// 第一个非空行是任务行 → 插到它前面；否则插到区间末尾（补空行分隔）
	if (i < lines.length && /^\s*-\s/.test(lines[i] ?? '')) {
		lines.splice(i, 0, newLine);
	} else {
		if ((lines[i - 1] ?? '').trim() !== '') lines.splice(i, 0, '');
		lines.splice(i, 0, newLine);
	}
	return joinLines(lines);
}

/** 删除任务行（按任务对象定位，不依赖 [ID::]） */
export function removeKanbanTask(content: string, task: { line: number; content: string; done: boolean }): string | null {
	const lines = content.split(/\r?\n/);
	const idx = locateTaskLine(lines, task);
	if (idx < 0) return null;
	lines.splice(idx, 1);
	return joinLines(lines);
}

/** 编辑任务内容：仅替换正文，保留 [ID::]/[状态::]/✅ 日期 标记，不改变完成状态 */
export function editKanbanTask(content: string, task: { line: number; content: string; done: boolean }, newText: string): string | null {
	const lines = content.split(/\r?\n/);
	const text = newText.trim();
	if (!text) return null;
	const idx = locateTaskLine(lines, task);
	if (idx < 0) return null;
	const line = lines[idx] ?? '';
	const mark = taskMark(line);
	if (!mark) return null;
	const idM = /\[ID::\s*[^\]]+\]/.exec(line);
	const stM = /\[状态::\s*[^\]]+\]/.exec(line);
	const ddM = /✅\s*\d{4}-\d{2}-\d{2}/.exec(line);
	const tail = [idM ? idM[0] : '', stM ? stM[0] : '', ddM ? ddM[0] : ''].filter(Boolean).join(' ');
	lines[idx] = `${mark === 'done' ? '- [x]' : '- [ ]'} ${text}${tail ? ' ' + tail : ''}`.trim();
	return joinLines(lines);
}

/** 生成与 Kanban 插件风格一致的稳定 ID：loc_ + 20 位 base36 */
export function newKanbanId(): string {
	const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
	let s = '';
	for (let i = 0; i < 20; i++) s += chars[Math.floor(Math.random() * chars.length)];
	return 'loc_' + s;
}
