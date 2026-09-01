import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	parseDocsMd, serializeDocs, upsertDocLine, removeDocLine, moveDocLine,
} from './favDocsParser.ts';

const SAMPLE = `# 常用文档

- [[Projects/项目A|项目A]]
- [[Daily/2026-08-24|今日日记]]
- [[Inbox/随手记]]

备注：随便写
`;

test('parseDocsMd：解析链接与显示名，路径自动补 .md', () => {
	const list = parseDocsMd(SAMPLE);
	assert.equal(list.length, 3);
	const [a, b, c] = list;
	assert.equal(a?.doc.path, 'Projects/项目A.md');
	assert.equal(a?.doc.title, '项目A');
	assert.equal(b?.doc.path, 'Daily/2026-08-24.md');
	assert.equal(c?.doc.path, 'Inbox/随手记.md');
	assert.equal(c?.doc.title, '');
});

test('parseDocsMd：非文档行忽略', () => {
	const out = parseDocsMd('# 常用文档\n\n- [[A.md|甲]]\n- 普通列表\n> 引用\n');
	assert.equal(out.length, 1);
	assert.equal(out[0]?.doc.path, 'A.md');
});

test('serializeDocs：往返一致', () => {
	const out = serializeDocs([
		{ path: 'A.md', title: '甲' },
		{ path: 'B.md', title: '' },
	]);
	assert.ok(out.includes('- [[A|甲]]'));
	assert.ok(out.includes('- [[B]]'));
	assert.equal(parseDocsMd(out).length, 2);
});

test('upsertDocLine：追加新文档到列表末尾', () => {
	const next = upsertDocLine(SAMPLE, { path: 'Notes/新笔记.md', title: '新笔记' });
	assert.ok(next);
	const list = parseDocsMd(next);
	assert.equal(list.length, 4);
	assert.equal(list[3]?.doc.path, 'Notes/新笔记.md');
	assert.ok(next.includes('备注：随便写'));
});

test('upsertDocLine：同路径原位替换', () => {
	const next = upsertDocLine(SAMPLE, { path: 'Projects/项目A.md', title: '项目A改名' });
	assert.ok(next);
	const list = parseDocsMd(next);
	assert.equal(list.length, 3);
	assert.ok(list.some((p) => p.doc.title === '项目A改名'));
});

test('upsertDocLine：空文档追加到末尾', () => {
	const next = upsertDocLine('# 常用文档\n\n只有标题\n', { path: 'X.md', title: '' });
	assert.ok(next);
	assert.ok(next.includes('- [[X]]'));
});

test('removeDocLine：删除指定路径', () => {
	const next = removeDocLine(SAMPLE, 'Daily/2026-08-24.md');
	assert.ok(next);
	const list = parseDocsMd(next);
	assert.equal(list.length, 2);
	assert.ok(!list.some((p) => p.doc.path === 'Daily/2026-08-24.md'));
	assert.equal(removeDocLine(SAMPLE, 'Nope.md'), null);
});

test('moveDocLine：上移 / 下移', () => {
	const next = moveDocLine(SAMPLE, 'Daily/2026-08-24.md', -1);
	assert.ok(next);
	const list = parseDocsMd(next);
	assert.equal(list[0]?.doc.path, 'Daily/2026-08-24.md');
	assert.equal(list[1]?.doc.path, 'Projects/项目A.md');
	const back = moveDocLine(next!, 'Daily/2026-08-24.md', 1);
	const backList = parseDocsMd(back!);
	assert.equal(backList[1]?.doc.path, 'Daily/2026-08-24.md');
	// 首/尾不可越界
	assert.equal(moveDocLine(SAMPLE, 'Projects/项目A.md', -1), null);
	assert.equal(moveDocLine(SAMPLE, 'Inbox/随手记.md', 1), null);
});
