import { App, PluginSettingTab, Setting } from 'obsidian';
import Dashboard from './main';

export interface BannerSettings {
	imageDataUrl: string | null;
	offsetY: number;
}

export interface QuickCaptureSettings {
	storagePath: string;
	namingPattern: string;
	templateFile: string;
}

export interface DiarySettings {
	storagePath: string;
	namingPattern: string;
	templateFile: string;
}

/** 倒计时卡片自定义事件：事件名称与目标日期 */
export interface CountdownSettings {
	/** 事件名称，如「高考」「新年」；文案显示「距离 {eventName} 还有」 */
	eventName: string;
	/** 目标日期，ISO yyyy-mm-dd；非法或留空时回退到「下一年 1 月 1 日」 */
	targetDate: string;
}

/** 首页「常用文档」卡片中的一条记录：点击直达库内文档 */
export interface FavoriteDoc {
	/** 库内相对路径，如 Projects/xxx.md */
	path: string;
	/** 显示名称；留空则显示文件名 */
	title: string;
}

/** 首页「天气」卡片：支持多城市（最多 3 个），按城市显示实时天气（wttr.in，免 key） */
export interface WeatherSettings {
	/** 城市名列表（支持中文，如 日照；最多 3 个，超出截断） */
	cities: string[];
}

/** 首页「番茄钟」卡片：专注 / 休息时长配置（分钟） */
export interface PomodoroSettings {
	/** 单个专注时长（分钟），默认 25 */
	workMinutes: number;
	/** 短休息时长（分钟），默认 5 */
	shortBreakMinutes: number;
	/** 长休息时长（分钟），默认 15 */
	longBreakMinutes: number;
	/** 每完成几个番茄后进入长休息，默认 4 */
	cycles: number;
	/** 一段结束时是否自动开始下一段（默认否） */
	autoStart: boolean;
	/** 一段结束时是否播放提示音（默认是） */
	sound: boolean;
	/** 今日已完成番茄数（跨天归零） */
	dailyCount: number;
	/** 计数对应的日期 yyyy-mm-dd，用于跨天归零判断 */
	dailyDate: string;
}

/** 首页「网站收藏」卡片中的一条记录：点击在浏览器打开 */
export interface FavoriteSite {
	/** 站点名称 */
	name: string;
	/** 完整 URL（含协议，如 https://example.com） */
	url: string;
	/** 分类名；缺省归「未分类」 */
	category?: string;
	/** 搜索关键词（逗号/空格分隔），用于卡片内搜索 */
	keywords?: string;
	/** 简易图标：emoji 字符；留空则显示站点 favicon */
	icon?: string;
}

export interface DashboardSettings {
	banner: BannerSettings;
	quickCapture: QuickCaptureSettings;
	diary: DiarySettings;
	todoSourceFolder: string;
	projectsFolder: string;
	theme: 'auto' | 'dark' | 'light';
	/** 界面语言：zh 中文 / en English */
	language?: 'zh' | 'en';
	dashboardTitle: string;
	/** 首页模块显隐与排序：每个模块一个开关 + 顺序权重 + 比例；重置见「恢复默认布局」 */
	homeModules?: HomeModuleConfig[];
	/** 首页布局数据版本；低于 HOME_LAYOUT_VERSION 时由 main.ts 迁移并重置默认比例 */
	homeLayoutVersion?: number;
	/** 倒计时卡片自定义事件（事件名称 + 目标日期） */
	countdown: CountdownSettings;
	/** 首页「番茄钟」卡片：专注 / 休息时长配置 */
	pomodoro: PomodoroSettings;
	/** 首页「常用文档」卡片：点击直达的库内文档列表 */
	favoriteDocs: FavoriteDoc[];
	/** 首页「天气」卡片：城市 */
	weather: WeatherSettings;
	/** 首页「网站收藏」卡片：站点列表 */
	favoriteSites: FavoriteSite[];
	/** 待办（Kanban 双向兼容）数据文件：Obsidian Kanban 插件的 .md 文件路径 */
	kanbanFile: string;
	/** 首页「网站收藏」卡片的数据文件（Markdown，双向同步、可手编） */
	favoriteSitesFile: string;
	/** 首页「常用文档」卡片的数据文件（Markdown，双向同步、可手编） */
	favoriteDocsFile: string;
}

/**
 * 首页布局数据版本。
 * 每当「默认比例」发生变更、且需要覆盖用户 data.json 中的旧值时递增。
 * v2：修正 projects（项目情况）为宽 2 高 1；heatmap（笔记统计）最低宽 3 高 1（即 3:1）。
 * v3：默认布局重排为 快捕/todo/进度 各 1×1、本周待办 1×2、项目情况 3×1、笔记统计 3×1、倒计时 1×1。
 */
export const HOME_LAYOUT_VERSION = 3;

/** 首页单个模块的显隐/排序/比例配置 */
export interface HomeModuleConfig {
	id: string;
	enabled: boolean;
	order: number;
	/** 宽度所占网格列数（1-4，4 = 页面最宽），默认 1 */
	cols?: number;
	/** 高度所占网格行比例（与 cols 共同决定卡片比例；如 2×1 为宽卡，1×2 为竖卡），默认 1 */
	rows?: number;
}

/** 首页模块 id → 双语显示名称（与 DashboardView 的模块注册表一致，供设置面板展示） */
export const HOME_MODULE_TITLES: Record<string, { zh: string; en: string }> = {
	'todo': { zh: '待办 · 今天要处理', en: 'To-do · Today' },
	'weather': { zh: '天气', en: 'Weather' },
	'calendar': { zh: '日历', en: 'Calendar' },
	'sites': { zh: '网站收藏', en: 'Bookmarks' },
	'favorites': { zh: '常用文档', en: 'Favorites' },
	'quick-capture': { zh: '灵感捕捉', en: 'Quick Capture' },
	'pomodoro': { zh: '番茄钟', en: 'Pomodoro' },
};

export const DEFAULT_SETTINGS: DashboardSettings = {
	banner: { imageDataUrl: null, offsetY: 0 },
	quickCapture: {
		storagePath: 'Dashboard/Temp',
		namingPattern: 'YYYY-MM-DD HH-mm 捕捉',
		templateFile: '',
	},
	diary: {
		storagePath: 'Daily',
		namingPattern: 'YYYY-MM-DD',
		templateFile: '',
	},
	todoSourceFolder: '',
	projectsFolder: 'Projects',
	theme: 'auto',
	language: 'zh',
	dashboardTitle: '',
	homeLayoutVersion: HOME_LAYOUT_VERSION,
	countdown: { eventName: '2027', targetDate: '2027-01-01' },
	pomodoro: {
		workMinutes: 25,
		shortBreakMinutes: 5,
		longBreakMinutes: 15,
		cycles: 4,
		autoStart: false,
		sound: true,
		dailyCount: 0,
		dailyDate: '',
	},
	favoriteDocs: [],
	weather: { cities: ['日照'] },
	favoriteSites: [],
	kanbanFile: 'Dashboard/待办事项.md',
	favoriteSitesFile: 'Dashboard/网站收藏.md',
	favoriteDocsFile: 'Dashboard/常用文档.md',
	// 默认布局（与产品截图一致，4 列网格）：
	// 待办 / 网站收藏 为高卡（1×2），日历 / 常用文档 / 快速捕捉 / 番茄钟 为矮卡（1×1）；
	// 天气默认隐藏（截图未含，需要时到「首页模块」打开）。
	homeModules: [
		{ id: 'todo', enabled: true, order: 0, cols: 1, rows: 2 },
		{ id: 'calendar', enabled: true, order: 1, cols: 1, rows: 1 },
		{ id: 'sites', enabled: true, order: 2, cols: 1, rows: 2 },
		{ id: 'favorites', enabled: true, order: 3, cols: 1, rows: 1 },
		{ id: 'quick-capture', enabled: true, order: 4, cols: 1, rows: 1 },
		{ id: 'pomodoro', enabled: true, order: 5, cols: 1, rows: 1 },
		{ id: 'weather', enabled: false, order: 6, cols: 1, rows: 1 },
	],
};

/** 首页模块默认布局（与 DEFAULT_SETTINGS.homeModules 保持一致，供「恢复默认布局」深拷贝） */
export const DEFAULT_HOME_MODULES: HomeModuleConfig[] = [
	{ id: 'todo', enabled: true, order: 0, cols: 1, rows: 2 },
	{ id: 'calendar', enabled: true, order: 1, cols: 1, rows: 1 },
	{ id: 'sites', enabled: true, order: 2, cols: 1, rows: 2 },
	{ id: 'favorites', enabled: true, order: 3, cols: 1, rows: 1 },
	{ id: 'quick-capture', enabled: true, order: 4, cols: 1, rows: 1 },
	{ id: 'pomodoro', enabled: true, order: 5, cols: 1, rows: 1 },
	{ id: 'weather', enabled: false, order: 6, cols: 1, rows: 1 },
];

/* ---- helpers ---- */

export class DashboardSettingTab extends PluginSettingTab {
	plugin: Dashboard;

	constructor(app: App, plugin: Dashboard) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/** 按当前语言返回中 / 英文案 */
	private s(zh: string, en: string): string {
		return this.plugin.settings.language === 'en' ? en : zh;
	}

	/** 首页模块 id → 按当前语言的显示名称 */
	private modName(id: string): string {
		const m = HOME_MODULE_TITLES[id];
		return m ? (this.plugin.settings.language === 'en' ? m.en : m.zh) : id;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		/* ---- 数据存储位置（所有模块存储内容的 Markdown 文档 / 文件夹路径统一在此指定） ---- */
		new Setting(containerEl).setName(this.s('数据存储位置', 'Storage Paths')).setHeading();
		new Setting(containerEl).setDesc(this.s('以下为各模块存储内容的 Markdown 文档 / 文件夹路径，统一在此修改；修改即时保存，无需重启。', 'Paths for each module Markdown data file. Changes apply immediately, no restart needed.'));

		const addPath = (
			name: string,
			desc: string,
			placeholder: string,
			get: () => string,
			onChange: (v: string) => Promise<void>,
		): void => {
			new Setting(containerEl)
				.setName(name)
				.setDesc(desc)
				.addText((t) => t
					.setPlaceholder(placeholder)
					.setValue(get())
					.onChange((v) => void onChange(v.trim())),
				);
		};

		// 待办（Kanban 双向兼容）
		addPath(this.s('待办 · Kanban 数据文件', 'To-do · Kanban file'), this.s('待办卡片读写的 Obsidian Kanban 插件数据文件', 'Kanban data file read and written by the to-do card'), 'Dashboard/待办事项.md',
			() => this.plugin.settings.kanbanFile,
			async (v) => {
				this.plugin.settings.kanbanFile = v || 'Dashboard/待办事项.md';
				await this.plugin.saveSettings();
				this.plugin.refreshHome();
			});

		// 网站收藏
		addPath(this.s('网站收藏 · 数据文件', 'Bookmarks · data file'), this.s('「网站收藏」卡片读写的 Markdown 文件（## 分类 + - 名称 → URL），可直接编辑，与卡片双向同步', 'Markdown file for the bookmarks card (## category + - name → URL). Editable directly, two-way synced with the card'), 'Dashboard/网站收藏.md',
			() => this.plugin.settings.favoriteSitesFile,
			async (v) => {
				this.plugin.settings.favoriteSitesFile = v || 'Dashboard/网站收藏.md';
				await this.plugin.saveSettings();
				this.plugin.refreshHome();
			});

		// 常用文档
		addPath(this.s('常用文档 · 数据文件', 'Favorites · data file'), this.s('「常用文档」卡片读写的 Markdown 文件（- [[路径|显示名]]），可直接编辑，与卡片双向同步', 'Markdown file for the favorites card (- [[path|title]]). Editable directly, two-way synced with the card'), 'Dashboard/常用文档.md',
			() => this.plugin.settings.favoriteDocsFile,
			async (v) => {
				this.plugin.settings.favoriteDocsFile = v || 'Dashboard/常用文档.md';
				await this.plugin.saveSettings();
				this.plugin.refreshHome();
			});

		// 灵感捕捉（快速捕捉）
		addPath(this.s('灵感捕捉 · 存储路径', 'Quick capture · storage path'), this.s('「灵感捕捉」新建笔记的存放文件夹', 'Folder where quick-capture notes are created'), 'Dashboard/Temp',
			() => this.plugin.settings.quickCapture.storagePath,
			async (v) => {
				this.plugin.settings.quickCapture.storagePath = v || 'Dashboard/Temp';
				await this.plugin.saveSettings();
			});

		/* ---- 首页模块（显示 / 隐藏、排序、大小，全部在此管理，不在首页直接调整） ---- */
		new Setting(containerEl).setName(this.s('首页模块', 'Home Modules')).setHeading();
		new Setting(containerEl).setDesc(this.s('在此管理首页卡片：显示 / 隐藏、调整顺序与大小。修改即时保存并刷新首页。', 'Manage home cards: show / hide, order and size. Changes apply immediately and refresh the home page.'));

		const hmWrap = containerEl.createDiv();
		const renderHmList = (): void => {
			hmWrap.empty();
			const hms = [...(this.plugin.settings.homeModules ?? [])].sort((a, b) => a.order - b.order);
			hms.forEach((m, idx) => {
				const row = new Setting(hmWrap).setName(this.modName(m.id));
				row.addToggle((t) => t
					.setTooltip(this.s('显示 / 隐藏此卡片', 'Show / hide this card'))
					.setValue(m.enabled)
					.onChange(async (v) => {
						m.enabled = v;
						await this.plugin.saveSettings();
						this.plugin.refreshHome();
					}),
				);
				row.addButton((b) => b.setButtonText('↑').setTooltip(this.s('上移（调整位置）', 'Move up')).onClick(async () => {
					if (idx === 0) return;
					const prev = hms[idx - 1]!;
					[m.order, prev.order] = [prev.order, m.order];
					await this.plugin.saveSettings();
					this.plugin.refreshHome();
					renderHmList();
				}));
				row.addButton((b) => b.setButtonText('↓').setTooltip(this.s('下移（调整位置）', 'Move down')).onClick(async () => {
					if (idx >= hms.length - 1) return;
					const next = hms[idx + 1]!;
					[m.order, next.order] = [next.order, m.order];
					await this.plugin.saveSettings();
					this.plugin.refreshHome();
					renderHmList();
				}));
				row.addDropdown((d) => {
					for (let c = 1; c <= 4; c++) d.addOption(String(c), this.s('宽 ' + c, 'W ' + c));
					d.setValue(String(m.cols ?? 1));
					d.onChange(async (v) => {
						m.cols = parseInt(v) || 1;
						await this.plugin.saveSettings();
						this.plugin.refreshHome();
					});
				});
				row.addDropdown((d) => {
					for (let r = 1; r <= 4; r++) d.addOption(String(r), this.s('高 ' + r, 'H ' + r));
					d.setValue(String(m.rows ?? 1));
					d.onChange(async (v) => {
						m.rows = parseInt(v) || 1;
						await this.plugin.saveSettings();
						this.plugin.refreshHome();
					});
				});
			});
			new Setting(hmWrap)
				.setName(this.s('恢复默认布局', 'Reset to Default'))
				.setDesc(this.s('将首页卡片的显示 / 隐藏、顺序与大小全部重置为默认', 'Reset all home cards to the default show / hide, order and size'))
				.addButton((b) => b.setButtonText(this.s('恢复默认', 'Reset')).onClick(async () => {
					await this.plugin.resetHomeLayout();
					this.plugin.refreshHome();
					renderHmList();
				}));
		};
		renderHmList();

		/* ---- 快速捕捉 ---- */
		new Setting(containerEl).setName(this.s('快速捕捉', 'Quick Capture')).setHeading();

		new Setting(containerEl)
			.setName(this.s('文件命名规则', 'File Naming Pattern'))
			.setDesc(this.s('支持变量：YYYY 年、MM 月(2位)、MMM 月缩写(如 8月)、DD 日；ddd 周日、dddd 星期日；HH 24时、hh 12时、mm 分、ss/SS 秒、A 上午/下午', 'Variables: YYYY year, MM month (2-digit), MMM month, DD day, ddd weekday, HH 24h, hh 12h, mm minute, ss/SS second, A AM/PM'))
			.addText((t) => t
				.setPlaceholder('YYYY-MM-DD HH-mm 捕捉')
				.setValue(this.plugin.settings.quickCapture.namingPattern)
				.onChange(async (v) => { this.plugin.settings.quickCapture.namingPattern = v; await this.plugin.saveSettings(); }),
			);

		new Setting(containerEl)
			.setName(this.s('模板文件', 'Template File'))
			.setDesc(this.s('输入模板路径，不使用模板则为空', 'Template path; leave empty to use none'))
			.addText((t) => t
				.setPlaceholder('Templates/速记.md')
				.setValue(this.plugin.settings.quickCapture.templateFile)
				.onChange(async (v) => {
					this.plugin.settings.quickCapture.templateFile = v.trim();
					await this.plugin.saveSettings();
				}),
			);

		/* ---- 待办（Kanban 双向兼容） ---- */
		new Setting(containerEl).setName(this.s('待办 · 今天要处理', 'To-do · Today')).setHeading();

		new Setting(containerEl)
			.setName(this.s('说明', 'Note'))
			.setDesc(this.s('数据文件路径请在顶部「数据存储位置」统一配置；此处保留命名与展示相关设置。', 'Configure the data file path in Storage Paths at the top; only display-related settings are here.'));

		/* ---- 番茄钟 ---- */
		new Setting(containerEl).setName(this.s('番茄钟', 'Pomodoro')).setHeading();
		new Setting(containerEl).setDesc(this.s('专注 / 休息时长（分钟）。修改即时生效，无需重启。', 'Focus / break durations in minutes. Changes apply immediately, no restart needed.'));

		const addNumSetting = (name: string, desc: string, min: number, max: number, get: () => number, onChange: (v: number) => void): void => {
			new Setting(containerEl)
				.setName(name)
				.setDesc(desc)
				.addText((t) => t
					.setPlaceholder(String(get()))
					.setValue(String(get()))
					.onChange((v) => {
						let n = parseInt(v, 10);
						if (!Number.isFinite(n)) n = min;
						n = Math.max(min, Math.min(max, n));
						onChange(n);
					}),
				);
		};

		addNumSetting(
			this.s('专注时长', 'Focus duration'),
			this.s('单个番茄的专注时长（1–180 分钟）', 'Length of one focus session (1–180 min)'),
			1, 180,
			() => this.plugin.settings.pomodoro.workMinutes,
			async (v) => { this.plugin.settings.pomodoro.workMinutes = v; await this.plugin.saveSettings(); this.plugin.refreshHome(); },
		);
		addNumSetting(
			this.s('短休息', 'Short break'),
			this.s('每个番茄之间的短休息（1–60 分钟）', 'Short break between pomodoros (1–60 min)'),
			1, 60,
			() => this.plugin.settings.pomodoro.shortBreakMinutes,
			async (v) => { this.plugin.settings.pomodoro.shortBreakMinutes = v; await this.plugin.saveSettings(); },
		);
		addNumSetting(
			this.s('长休息', 'Long break'),
			this.s('连续完成若干番茄后的长休息（1–90 分钟）', 'Long break after several pomodoros (1–90 min)'),
			1, 90,
			() => this.plugin.settings.pomodoro.longBreakMinutes,
			async (v) => { this.plugin.settings.pomodoro.longBreakMinutes = v; await this.plugin.saveSettings(); },
		);
		addNumSetting(
			this.s('长休息间隔', 'Long break interval'),
			this.s('每完成几个番茄进入一次长休息（1–12）', 'Long break after every N pomodoros (1–12)'),
			1, 12,
			() => this.plugin.settings.pomodoro.cycles,
			async (v) => { this.plugin.settings.pomodoro.cycles = v; await this.plugin.saveSettings(); },
		);

		new Setting(containerEl)
			.setName(this.s('自动开始下一段', 'Auto-start next session'))
			.setDesc(this.s('一段结束后自动开始下一段（休息 / 专注）', 'Automatically start the next session (break / focus) when one ends'))
			.addToggle((t) => t
				.setValue(this.plugin.settings.pomodoro.autoStart)
				.onChange(async (v) => { this.plugin.settings.pomodoro.autoStart = v; await this.plugin.saveSettings(); }),
			);

		new Setting(containerEl)
			.setName(this.s('结束提示音', 'End sound'))
			.setDesc(this.s('一段结束时播放提示音', 'Play a sound when a session ends'))
			.addToggle((t) => t
				.setValue(this.plugin.settings.pomodoro.sound)
				.onChange(async (v) => { this.plugin.settings.pomodoro.sound = v; await this.plugin.saveSettings(); }),
			);

		const pomoResetRow = new Setting(containerEl)
			.setName(this.s('今日番茄数', 'Pomodoros today'))
			.setDesc(this.s('今日已完成的番茄计数', 'Pomodoros completed today'));
		pomoResetRow.addButton((b) => b.setButtonText(this.s('清零', 'Reset')).onClick(async () => {
			this.plugin.settings.pomodoro.dailyCount = 0;
			this.plugin.settings.pomodoro.dailyDate = '';
			await this.plugin.saveSettings();
			this.plugin.refreshHome();
		}));

		/* ---- 天气 ---- */
		new Setting(containerEl).setName(this.s('天气', 'Weather')).setHeading();

		const weatherCities = this.plugin.settings.weather?.cities?.length ? this.plugin.settings.weather.cities : ['日照'];
		[0, 1, 2].forEach((idx) => {
			new Setting(containerEl)
				.setName(idx === 0 ? this.s('城市 1', 'City 1') : this.s(`城市 ${idx + 1}`, `City ${idx + 1}`))
				.setDesc(idx === 0 ? this.s('显示实时天气的城市（最多 3 个，wttr.in 支持中文城市名，如 日照）。留空则不显示该城市', 'City to show live weather (max 3, wttr.in supports Chinese city names). Leave empty to hide') : this.s('第二个/第三个城市可选，留空则不显示', 'Optional 2nd / 3rd city; leave empty to hide'))
				.addText((t) => t
					.setPlaceholder(idx === 0 ? '日照' : this.s('（可选）', '(optional)'))
					.setValue(weatherCities[idx] ?? '')
					.onChange(async (v) => {
						const cur = [...weatherCities];
						if (v.trim()) cur[idx] = v.trim();
						else delete cur[idx];
						this.plugin.settings.weather = { cities: cur.filter(Boolean).slice(0, 3) };
						await this.plugin.saveSettings();
						this.plugin.refreshHome();
					}),
				);
		});

		/* ---- 外观 ---- */
		new Setting(containerEl).setName(this.s('外观', 'Appearance')).setHeading();

		new Setting(containerEl)
			.setName(this.s('主题', 'Theme'))
			.setDesc(this.s('跟随 Obsidian 外观，或手动指定深色/浅色。手动选择会同时切换 Obsidian 整体外观，仪表盘自动跟随', 'Follow Obsidian appearance, or force dark / light. Manual choice also switches Obsidian theme; dashboard follows automatically'))
			.addDropdown((dropdown) => {
				dropdown.addOption('auto', this.s('跟随 Obsidian', 'Follow Obsidian'));

				dropdown.addOption('dark', this.s('深色', 'Dark'));
				dropdown.addOption('light', this.s('浅色', 'Light'));
				dropdown.setValue(this.plugin.settings.theme);
				dropdown.onChange(async (v) => {
					const mode = v as 'auto' | 'dark' | 'light';
					if (mode !== 'auto') {
						// 手动选择深色/浅色时，直接切换 Obsidian 整体外观，仪表盘通过 'auto' 跟随。
						this.plugin.setObsidianTheme(mode);
						this.plugin.settings.theme = 'auto';
						dropdown.setValue('auto');
					} else {
						this.plugin.settings.theme = 'auto';
					}
					await this.plugin.saveSettings();
					this.applyTheme();
				});
			});

		new Setting(containerEl)
			.setName(this.s('插件标题', 'Dashboard Title'))
			.setDesc(this.s('自定义仪表盘主标题（即“MY DASHBOARD”那一行）。留空则使用默认标题 “MY DASHBOARD”，修改后立即生效，无需重载', 'Custom title of the dashboard (the “MY DASHBOARD” line). Leave empty to use the default; applies immediately'))
			.addText((t) => t
				.setPlaceholder('MY DASHBOARD')
				.setValue(this.plugin.settings.dashboardTitle)
				.onChange(async (v) => { this.plugin.settings.dashboardTitle = v; await this.plugin.saveSettings(); this.plugin.refreshDashboardTitle(); }),
			);

		new Setting(containerEl)
			.setName(this.s('语言', 'Language'))
			.setDesc(this.s('界面语言：中文 / English（切换后设置面板立即刷新）', 'UI language: 中文 / English (settings refresh immediately)'))
			.addDropdown((dropdown) => {
				dropdown.addOption('zh', '中文');
				dropdown.addOption('en', 'English');
				dropdown.setValue(this.plugin.settings.language ?? 'zh');
				dropdown.onChange(async (v) => {
					this.plugin.settings.language = (v as 'zh' | 'en') || 'zh';
					await this.plugin.saveSettings();
					this.display();
				});
			});
	}

	private applyTheme(): void {
		const t = this.plugin.settings.theme;
		const effective = t === 'auto'
			? (document.body.classList.contains('theme-light') ? 'light' : 'dark')
			: t;
		this.app.workspace.getLeavesOfType('dashboard-view').forEach((leaf) => {
			leaf.view?.containerEl.querySelector('.dashboard-plugin')?.setAttribute('data-theme', effective);
		});
		document.querySelectorAll('.dashboard-plugin').forEach((el) => el.setAttribute('data-theme', effective));
		this.plugin.refreshThemeButtons();
	}
}
