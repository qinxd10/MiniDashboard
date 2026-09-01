import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	parseKanbanBoard,
	toggleKanbanTask,
	addKanbanTask,
	removeKanbanTask,
	editKanbanTask,
	newKanbanId,
} from './kanbanParser.ts';
import type { KanbanTask } from './kanbanParser.ts';

const SAMPLE = `---
kanban-plugin: board
type: workspace-tasks
title: 待办事项
updated: 2026-08-21T17:37
---

## 待办事项

- [ ] 任务A [ID:: loc_aaa111] [状态:: 待办]
- [ ] 任务B [ID:: loc_bbb222] [状态:: 待办]
- [x] 任务C [ID:: loc_ccc333] [状态:: 已完成] ✅ 2026-08-21

%% kanban:settings
\`\`\`
{"kanban-plugin":"board","show-checkboxes":true}
\`\`\`
%%
`;

/** 从解析结果取任务对象（按谓词） */
function findTask(content: string, sel: (t: KanbanTask) => boolean): KanbanTask {
	const t = parseKanbanBoard(content).tasks.find(sel);
	assert.ok(t, 'task not found');
	return t;
}

test('解析 Kanban 文件：识别列与任务', () => {
	const b = parseKanbanBoard(SAMPLE);
	assert.equal(b.isKanban, true);
	assert.equal(b.columns.length, 1);
	assert.equal(b.columns[0].title, '待办事项');
	assert.equal(b.tasks.length, 3);
});

test('解析：任务字段（id/status/done/doneDate/column）', () => {
	const b = parseKanbanBoard(SAMPLE);
	const a = b.tasks[0];
	assert.equal(a.id, 'loc_aaa111');
	assert.equal(a.status, '待办');
	assert.equal(a.done, false);
	assert.equal(a.doneDate, null);
	assert.equal(a.column, '待办事项');
	assert.equal(a.content, '任务A');
	const c = b.tasks[2];
	assert.equal(c.id, 'loc_ccc333');
	assert.equal(c.done, true);
	assert.equal(c.doneDate, '2026-08-21');
	assert.equal(c.content, '任务C');
});

test('非 Kanban 文件 isKanban=false（列仍正常解析）', () => {
	const b = parseKanbanBoard('---\ntags: [x]\n---\n\n## 列\n\n- [ ] 普通\n');
	assert.equal(b.isKanban, false);
	assert.equal(b.columns.length, 1);
	assert.equal(b.tasks.length, 1);
});

test('内容里的双链与文件链接保留在 content 中', () => {
	const content = '## 列\n\n- [ ] [[应急短信平台]] [ID:: loc_x1] [状态:: 待办]\n- [x] [日照培训](02%20x/y.md) [ID:: loc_x2] [状态:: 已完成] ✅ 2026-08-01\n';
	const b = parseKanbanBoard(content);
	assert.equal(b.tasks[0].content, '[[应急短信平台]]');
	assert.equal(b.tasks[1].content, '[日照培训](02%20x/y.md)');
});

test('toggle：完成一条任务（按任务对象定位）', () => {
	const task = findTask(SAMPLE, (t) => t.id === 'loc_aaa111');
	const out = toggleKanbanTask(SAMPLE, task, true, '2026-08-23');
	assert.ok(out);
	const b = parseKanbanBoard(out);
	const t = b.tasks.find((x) => x.id === 'loc_aaa111');
	assert.ok(t);
	assert.equal(t.done, true);
	assert.equal(t.status, '已完成');
	assert.equal(t.doneDate, '2026-08-23');
	assert.equal(b.tasks.find((x) => x.id === 'loc_bbb222').done, false);
});

test('toggle：取消完成，移除 ✅ 与日期', () => {
	const task = findTask(SAMPLE, (t) => t.id === 'loc_ccc333');
	const out = toggleKanbanTask(SAMPLE, task, false, '2026-08-23');
	assert.ok(out);
	const b = parseKanbanBoard(out);
	const t = b.tasks.find((x) => x.id === 'loc_ccc333');
	assert.equal(t.done, false);
	assert.equal(t.status, '待办');
	assert.equal(t.doneDate, null);
	assert.ok(!/✅/.test(b.rawLines[t.line]));
});

test('toggle：任务不存在返回 null', () => {
	assert.equal(toggleKanbanTask(SAMPLE, { line: 999, content: '不存在', done: false }, true, '2026-08-23'), null);
});

test('add：插到已有列内最前（prepend），不带多余标记', () => {
	const out = addKanbanTask(SAMPLE, '待办事项', '新任务');
	assert.ok(out);
	const b = parseKanbanBoard(out);
	assert.equal(b.tasks.length, 4);
	assert.equal(b.tasks[0].content, '新任务');
	assert.equal(b.tasks[0].done, false);
	assert.equal(b.tasks[0].column, '待办事项');
	assert.ok(!b.tasks[0].content.includes('[ID::'));
});

test('add：列不存在返回 null', () => {
	assert.equal(addKanbanTask(SAMPLE, '不存在的列', 'x'), null);
});

test('add：列下没有任务时也能插入（补空行）', () => {
	const content = '## 待办\n\n## 进行中\n\n- [ ] 已有 [ID:: loc_a] [状态:: 待办]\n';
	const out = addKanbanTask(content, '待办', '首条');
	assert.ok(out);
	const b = parseKanbanBoard(out);
	assert.equal(b.tasks.length, 2);
	assert.equal(b.tasks[0].content, '首条');
	assert.equal(b.tasks[0].column, '待办');
});

test('remove：删除指定任务行（按任务对象）', () => {
	const task = findTask(SAMPLE, (t) => t.id === 'loc_bbb222');
	const out = removeKanbanTask(SAMPLE, task);
	assert.ok(out);
	const b = parseKanbanBoard(out);
	assert.equal(b.tasks.length, 2);
	assert.ok(!b.tasks.some((x) => x.id === 'loc_bbb222'));
	assert.equal(removeKanbanTask(SAMPLE, { line: 999, content: 'x', done: false }), null);
});

test('edit：仅改正文，保留 ID/状态/✅', () => {
	const task = findTask(SAMPLE, (t) => t.id === 'loc_ccc333');
	const out = editKanbanTask(SAMPLE, task, '改后的完成项');
	assert.ok(out);
	const b = parseKanbanBoard(out);
	const t = b.tasks.find((x) => x.id === 'loc_ccc333');
	assert.equal(t.content, '改后的完成项');
	assert.equal(t.done, true);
	assert.equal(t.status, '已完成');
	assert.equal(t.doneDate, '2026-08-21');
	assert.equal(b.tasks.find((x) => x.id === 'loc_aaa111').content, '任务A');
	assert.equal(editKanbanTask(SAMPLE, { line: 999, content: 'x', done: false }, 'y'), null);
	assert.equal(editKanbanTask(SAMPLE, findTask(SAMPLE, (t) => t.id === 'loc_aaa111'), '   '), null);
});

/* ---- 无 [ID::] 文件（Kanban 插件未启用 ID 标记，即用户真实格式） ---- */

const NOID = `## 待办事项

- [ ] 甲
- [ ] 乙
- [x] 丙 ✅ 2026-08-21
`;

test('无 ID：toggle 完成加 ✅、取消移除 ✅', () => {
	const task = findTask(NOID, (t) => t.content === '甲');
	const out = toggleKanbanTask(NOID, task, true, '2026-08-24');
	assert.ok(out);
	const b = parseKanbanBoard(out);
	const done = b.tasks.find((t) => t.content === '甲');
	assert.equal(done.done, true);
	assert.equal(done.doneDate, '2026-08-24');
	assert.ok(b.rawLines[done.line].includes('✅ 2026-08-24'));

	const taskB = findTask(NOID, (t) => t.content === '丙');
	const out2 = toggleKanbanTask(NOID, taskB, false, '2026-08-24');
	assert.ok(out2);
	const b2 = parseKanbanBoard(out2);
	const undone = b2.tasks.find((t) => t.content === '丙');
	assert.equal(undone.done, false);
	assert.equal(undone.doneDate, null);
	assert.ok(!/✅/.test(b2.rawLines[undone.line]));
});

test('无 ID：编辑仅改正文，已完成项保留 ✅ 日期', () => {
	const task = findTask(NOID, (t) => t.content === '丙');
	const out = editKanbanTask(NOID, task, '丙·改');
	assert.ok(out);
	const b = parseKanbanBoard(out);
	const t = b.tasks.find((x) => x.content === '丙·改');
	assert.ok(t);
	assert.equal(t.done, true);
	assert.equal(t.doneDate, '2026-08-21');
	assert.ok(b.rawLines[t.line].includes('✅ 2026-08-21'));
});

test('无 ID：删除按内容定位', () => {
	const task = findTask(NOID, (t) => t.content === '乙');
	const out = removeKanbanTask(NOID, task);
	assert.ok(out);
	const b = parseKanbanBoard(out);
	assert.equal(b.tasks.length, 2);
	assert.ok(!b.tasks.some((t) => t.content === '乙'));
});

test('无 ID：add 生成简洁任务行', () => {
	const out = addKanbanTask(NOID, '待办事项', '丁');
	assert.ok(out);
	const b = parseKanbanBoard(out);
	assert.equal(b.tasks.length, 4);
	assert.equal(b.tasks[0].content, '丁');
	assert.ok(!b.tasks[0].content.includes('[ID::'));
});

test('newKanbanId 符合 Kanban 风格 loc_ + 字母数字', () => {
	const id = newKanbanId();
	assert.ok(/^loc_[0-9a-z]{20}$/.test(id));
	assert.notEqual(id, newKanbanId());
});
