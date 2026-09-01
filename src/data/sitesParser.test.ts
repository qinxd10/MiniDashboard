import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	parseSitesMd, serializeSites, upsertSiteLine, removeSiteLine, moveSiteLine,
} from './sitesParser.ts';

const SAMPLE = `# 网站收藏

## 工作
- [🌐] 腾讯云 → https://cloud.tencent.com #云 #工作
- GitHub → https://github.com #开发

## 工具
- [🧰] 百度 → https://www.baidu.com

一些注释
`;

test('parseSitesMd：解析分类 / 名称 / URL / 关键词（emoji 图标已弃用，被忽略）', () => {
	const list = parseSitesMd(SAMPLE);
	assert.equal(list.length, 3);
	const [a, b, c] = list;
	assert.equal(a?.site.name, '腾讯云');
	assert.equal(a?.site.url, 'https://cloud.tencent.com');
	assert.equal(a?.site.icon, undefined);
	assert.equal(a?.site.category, '工作');
	assert.equal(a?.site.keywords, '云 工作');
	assert.equal(b?.site.name, 'GitHub');
	assert.equal(b?.site.category, '工作');
	assert.equal(b?.site.icon, undefined);
	assert.equal(c?.site.name, '百度');
	assert.equal(c?.site.category, '工具');
});

test('parseSitesMd：无分类站点归未分类，注释行忽略', () => {
	const out = parseSitesMd('# 网站收藏\n\n- 简书 → https://www.jianshu.com\n\n注：随便写\n- [[不是站点]]\n');
	assert.equal(out.length, 1);
	assert.equal(out[0]?.site.name, '简书');
	assert.equal(out[0]?.site.category, undefined);
});

test('serializeSites：按分类分组序列化（忽略 icon 字段）', () => {
	const out = serializeSites([
		{ name: 'A', url: 'https://a.com', category: '工作', icon: '⭐' },
		{ name: 'B', url: 'https://b.com', keywords: 'kw1 kw2' },
	]);
	assert.ok(out.includes('## 工作'));
	assert.ok(out.includes('- A → https://a.com'));
	assert.ok(!out.includes('⭐'));
	assert.ok(out.includes('- B → https://b.com #kw1 #kw2'));
	// 往返一致
	assert.equal(parseSitesMd(out).length, 2);
});

test('upsertSiteLine：新增到已有分类', () => {
	const next = upsertSiteLine(SAMPLE, { name: '掘金', url: 'https://juejin.cn', category: '工作' });
	assert.ok(next);
	const list = parseSitesMd(next);
	assert.equal(list.length, 4);
	const jj = list.find((p) => p.site.url === 'https://juejin.cn');
	assert.ok(jj);
	assert.equal(jj.site.category, '工作');
	// 原注释保留
	assert.ok(next.includes('一些注释'));
});

test('upsertSiteLine：新建分类', () => {
	const next = upsertSiteLine(SAMPLE, { name: 'B 站', url: 'https://bilibili.com', category: '娱乐' });
	assert.ok(next);
	const list = parseSitesMd(next);
	assert.equal(list.length, 4);
	const b = list.find((p) => p.site.url === 'https://bilibili.com');
	assert.equal(b?.site.category, '娱乐');
});

test('upsertSiteLine：同 URL 原位替换', () => {
	const next = upsertSiteLine(SAMPLE, { name: '腾讯云改名', url: 'https://cloud.tencent.com', category: '工作' });
	assert.ok(next);
	const list = parseSitesMd(next);
	assert.equal(list.length, 3);
	assert.ok(list.some((p) => p.site.name === '腾讯云改名'));
});

test('removeSiteLine：删除指定站点', () => {
	const next = removeSiteLine(SAMPLE, 'https://github.com');
	assert.ok(next);
	const list = parseSitesMd(next);
	assert.equal(list.length, 2);
	assert.ok(!list.some((p) => p.site.url === 'https://github.com'));
	assert.equal(removeSiteLine(SAMPLE, 'https://nope.com'), null);
});

test('moveSiteLine：分类内上移 / 下移', () => {
	const next = moveSiteLine(SAMPLE, 'https://github.com', -1);
	assert.ok(next);
	const list = parseSitesMd(next);
	assert.equal(list.length, 3);
	// GitHub 应排到腾讯云之前
	assert.equal(list[0]?.site.url, 'https://github.com');
	assert.equal(list[1]?.site.url, 'https://cloud.tencent.com');
	// 下移回来
	const back = moveSiteLine(next!, 'https://github.com', 1);
	const backList = parseSitesMd(back!);
	assert.equal(backList[0]?.site.url, 'https://cloud.tencent.com');
	// 分类内只有一个站点时不可移动
	const singleContent = '# 网站收藏\n\n## 孤类\n- X → https://x.com\n';
	assert.equal(moveSiteLine(singleContent, 'https://x.com', 1), null);
});

test('upsertSiteLine：编辑站点改分类 → 行移动到新分类段', () => {
	// 把 GitHub 从「工作」改到「开发」分类
	const next = upsertSiteLine(SAMPLE, { name: 'GitHub', url: 'https://github.com', category: '开发' });
	assert.ok(next);
	const list = parseSitesMd(next);
	assert.equal(list.length, 3);
	const gh = list.find((p) => p.site.url === 'https://github.com');
	assert.equal(gh?.site.category, '开发');
	// 原「工作」分类只剩腾讯云；新「开发」分类存在
	const cats = [...new Set(list.map((p) => p.site.category))];
	assert.ok(cats.includes('开发'));
	// 回读结构正确
	assert.ok(next.includes('## 开发'));
});

test('upsertSiteLine：编辑站点清空分类 → 移到未分类区', () => {
	const next = upsertSiteLine(SAMPLE, { name: '腾讯云', url: 'https://cloud.tencent.com', category: '' });
	assert.ok(next);
	const list = parseSitesMd(next);
	const tc = list.find((p) => p.site.url === 'https://cloud.tencent.com');
	assert.equal(tc?.site.category, undefined);
	// 未分类行应在第一个 ## 之前
	const tcLine = tc?.line ?? -1;
	const firstHead = next.split('\n').findIndex((ln) => /^##\s+/.test(ln.trim()));
	assert.ok(tcLine < firstHead);
});

test('parseSitesMd / serializeSites：空名称站点（无名称显示链接）', () => {
	const out = parseSitesMd('# 网站收藏\n\n- → https://x.com\n- 有名字 → https://y.com\n');
	assert.equal(out.length, 2);
	assert.equal(out[0]?.site.name, '');
	assert.equal(out[0]?.site.url, 'https://x.com');
	assert.equal(out[1]?.site.name, '有名字');
	// 序列化空名称：- → url
	const ser = serializeSites([{ name: '', url: 'https://x.com' }, { name: '甲', url: 'https://y.com' }]);
	assert.ok(ser.includes('- → https://x.com'));
	assert.ok(ser.includes('- 甲 → https://y.com'));
	// 往返一致
	assert.equal(parseSitesMd(ser).length, 2);
});
