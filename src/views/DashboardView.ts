import { ItemView, Menu, TFile, WorkspaceLeaf, requestUrl } from 'obsidian';
import { MOCK_DATA, DashboardData } from '../data/mockData';
import { DEFAULT_SETTINGS } from '../settings';
import type { FavoriteDoc, FavoriteSite } from '../settings';
import { FavoriteDocsModal } from './FavoriteDocsModal';
import { KanbanEditModal } from './KanbanEditModal';
import { SiteEditModal } from './SiteEditModal';
import type { SiteFormData } from './SiteEditModal';
import { attachTouchMenu } from './touchMenu';
import {
	parseKanbanBoard, toggleKanbanTask, addKanbanTask, removeKanbanTask, editKanbanTask,
} from '../data/kanbanParser';
import type { KanbanTask } from '../data/kanbanParser';
import { parseSitesMd, serializeSites, upsertSiteLine, removeSiteLine, moveSiteLine } from '../data/sitesParser';
import { parseDocsMd, serializeDocs, upsertDocLine, removeDocLine, moveDocLine } from '../data/favDocsParser';
import { fmtDate, todayStr, nowFmt } from '../data/dateUtils';

import type Dashboard from '../main';
import {
	ICON_home, injectSvg,
} from '../icons';

export const VIEW_TYPE = 'dashboard-view';

/** 首页模块描述符：id 对应 settings.homeModules，render 为对应渲染函数 */
interface HomeModule {
	id: string;
	title: string;
	cardCls: string;
	/** 是否参与数据刷新（refreshHomeCards）。false = 仅在初次渲染时绘制（如快速捕捉输入框、热力图、倒计时），避免刷新时清空输入或重复创建 */
	live?: boolean;
	render: (board: HTMLElement) => Promise<void> | void;
}

/** 天气卡片渲染数据（来自 wttr.in j1 JSON 的加工结果） */
interface WeatherData {
	temp: string;
	desc: string;
	icon: string;
	hi: string;
	lo: string;
	humidity: string;
	updated: string;
}

/** wttr.in 天气码 → 图标 + 中文描述（YR.NO weather codes） */
const WEATHER_CODE: Record<string, { icon: string; zh: string }> = {
	'113': { icon: '☀', zh: '晴' },
	'116': { icon: '☁', zh: '多云' },
	'119': { icon: '☁', zh: '阴' },
	'122': { icon: '☁', zh: '阴' },
	'143': { icon: '≡', zh: '雾' },
	'248': { icon: '≡', zh: '雾' },
	'260': { icon: '≡', zh: '雾' },
	'176': { icon: '☂', zh: '阵雨' },
	'263': { icon: '☂', zh: '小雨' },
	'266': { icon: '☂', zh: '小雨' },
	'293': { icon: '☂', zh: '阵雨' },
	'296': { icon: '☂', zh: '小雨' },
	'299': { icon: '☂', zh: '中雨' },
	'302': { icon: '☂', zh: '中雨' },
	'305': { icon: '☂', zh: '大雨' },
	'308': { icon: '☂', zh: '大雨' },
	'353': { icon: '☂', zh: '阵雨' },
	'356': { icon: '☂', zh: '中雨' },
	'359': { icon: '☂', zh: '大雨' },
	'386': { icon: '⚡', zh: '雷阵雨' },
	'389': { icon: '⚡', zh: '雷阵雨' },
	'200': { icon: '⚡', zh: '雷阵雨' },
	'227': { icon: '❆', zh: '小雪' },
	'230': { icon: '❆', zh: '中雪' },
	'320': { icon: '❆', zh: '阵雪' },
	'323': { icon: '❆', zh: '小雪' },
	'326': { icon: '❆', zh: '小雪' },
	'329': { icon: '❆', zh: '中雪' },
	'332': { icon: '❆', zh: '中雪' },
	'335': { icon: '❆', zh: '大雪' },
	'338': { icon: '❆', zh: '大雪' },
	'368': { icon: '❆', zh: '阵雪' },
	'371': { icon: '❆', zh: '大雪' },
	'392': { icon: '⚡', zh: '雷雪' },
	'395': { icon: '❆', zh: '大雪' },
	'179': { icon: '❆', zh: '雨夹雪' },
	'182': { icon: '❆', zh: '雨夹雪' },
	'185': { icon: '❆', zh: '雨夹雪' },
	'281': { icon: '≡', zh: '冻雨' },
	'284': { icon: '≡', zh: '冻雨' },
	'311': { icon: '☂', zh: '冻雨' },
	'314': { icon: '☂', zh: '冻雨' },
	'350': { icon: '❆', zh: '冰雹' },
	'374': { icon: '❆', zh: '冰雹' },
	'377': { icon: '❆', zh: '冰雹' },
};

/** 天气描述 → 英文（英文界面使用） */
const WEATHER_EN: Record<string, string> = {
	'晴': 'Sunny', '多云': 'Cloudy', '阴': 'Overcast', '雾': 'Fog',
	'阵雨': 'Showers', '小雨': 'Light rain', '中雨': 'Moderate rain', '大雨': 'Heavy rain',
	'雷阵雨': 'Thunderstorm', '雷雪': 'Thunder snow', '雨夹雪': 'Sleet', '冻雨': 'Freezing rain',
	'冰雹': 'Hail', '小雪': 'Light snow', '中雪': 'Moderate snow', '大雪': 'Heavy snow', '阵雪': 'Snow showers',
};

/** 卡片比例的最大格数（宽/高均为 1..4，4 = 页面最宽） */
const MAX_SPAN = 4;

/** 部分卡片的最低宽度（单位=格），限制缩放/比例菜单，避免关键卡片被压得过窄 */
const MIN_COLS: Record<string, number> = {
	'projects': 2, // 项目情况：最低宽度 2 格
	'heatmap': 2,  // 笔记统计：最低宽度 2 格（2×1 走窄版间距 + 自适应窗口）
};

/** 热力图格子尺寸（px，固定不变）与列间距的允许区间 —— 只调间距、不改格子尺寸 */
const HM_CELL = 15;
const HM_GAP_MIN = 3;
const HM_GAP_MAX = 14;
/** 星期列（22px）+ grid 列间距（4px），即 cells 相对 heat 容器的左侧偏移 */
const HM_DOW_W = 26;
/** 窄卡时至少保留的周数，避免退化成几根竖条 */
const HM_MIN_WEEKS = 10;

/** 部分卡片的最低宽高比（宽:高），限制缩放/比例菜单与响应式夹紧，避免关键卡片被压成过窄过高的竖条 */
const MIN_RATIO: Record<string, number> = {
	'projects': 2, // 项目情况：最低 2:1
	'heatmap': 3,  // 笔记统计：最低 3:1
};

/** 进度圆环动画参数（可按需微调）：时长 + 缓动曲线 */
const RING_ANIM = {
	/** 单次动画时长（毫秒） */
	duration: 900,
	/** 缓动曲线：easeOutCubic —— 起步快、收尾缓，符合进度填充的直觉 */
	easing: (t: number): number => 1 - Math.pow(1 - t, 3),
};

/** 把任意输入夹到合法的格数区间，非法值回退为 1 */
function clampSpan(v: unknown): number {
	const n = typeof v === 'number' ? Math.round(v) : parseInt(String(v ?? ''), 10);
	if (!Number.isFinite(n) || n < 1) return 1;
	return Math.min(MAX_SPAN, n);
}


function calcHeatmapStats(data, year, today) {
  var _a2;
  let total = 0;
  let active = 0;
  const prefix = `${year}-`;
  const todayStr4 = fmtDate(today);
  for (const [date, count] of data) {
    if (!date.startsWith(prefix) || date > todayStr4) continue;
    total += count;
    if (count > 0) active++;
  }
  let streak = 0;
  const d = new Date(today);
  while (d.getFullYear() === year) {
    const key = fmtDate(d);
    if (((_a2 = data.get(key)) != null ? _a2 : 0) > 0) streak++;
    else break;
    d.setDate(d.getDate() - 1);
  }
  return { total, active, streak };
}

function getLunarDate(d) {
  var _a2, _b, _c, _d, _e, _f;
  try {
    const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
      timeZone: "Asia/Shanghai",
      month: "long",
      day: "numeric"
    }).formatToParts(d);
    const monthStr = (_b = (_a2 = parts.find((p) => p.type === "month")) == null ? void 0 : _a2.value) != null ? _b : "";
    const dayStr = (_d = (_c = parts.find((p) => p.type === "day")) == null ? void 0 : _c.value) != null ? _d : "";
    if (/[一-鿿]/.test(monthStr)) {
      const dayNum = parseInt(dayStr);
      if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 30) {
        const LUNAR_DAYS = [
          "初一",
          "初二",
          "初三",
          "初四",
          "初五",
          "初六",
          "初七",
          "初八",
          "初九",
          "初十",
          "十一",
          "十二",
          "十三",
          "十四",
          "十五",
          "十六",
          "十七",
          "十八",
          "十九",
          "二十",
          "廿一",
          "廿二",
          "廿三",
          "廿四",
          "廿五",
          "廿六",
          "廿七",
          "廿八",
          "廿九",
          "三十"
        ];
        return monthStr + ((_e = LUNAR_DAYS[dayNum - 1]) != null ? _e : dayStr);
      }
      return monthStr + dayStr.replace("日", "");
    }
    const m = parseInt(monthStr) || 1;
    const day = parseInt(dayStr) || 1;
    const MONTHS = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"];
    const DAYS = ["初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十", "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];
    return MONTHS[m - 1] + ((_f = DAYS[day - 1]) != null ? _f : "");
  } catch (e) {
    return "";
  }
}

export class DashboardView extends ItemView {
	plugin: Dashboard;
	boardEl: HTMLElement | null = null;
	noiseId: number | null = null;
	pulseEls: { total: HTMLElement; today: HTMLElement; streak: HTMLElement } | null = null;
	dateEl: HTMLElement | null = null;
	adTitleEl: HTMLElement | null = null;
	weekdayEl: HTMLElement | null = null;
	lunarEl: HTMLElement | null = null;
	dashboardEl: HTMLElement | null = null;
	adThemeBtn: HTMLElement | null = null;
	adRowHObs?: ResizeObserver;
	adBoardWired = false;
	adLastColCount = 0;
	calYear = 0;
	calMonth = 0;
	weatherCache: { city: string; at: number; data: WeatherData | null } | null = null;
	wxTimer: number | null = null;
	kanbanRefreshTimer: number | null = null;
	sitesRefreshTimer: number | null = null;
	docsRefreshTimer: number | null = null;
	/** 番茄钟：倒计时 tick 定时器（setInterval 句柄） */
	pomoTimer: number | null = null;
	/** 番茄钟运行时状态（内存态，不落盘；时长/计数等配置见 settings.pomodoro） */
	pomo = {
		/** 当前阶段：work 专注 / short 短休 / long 长休 */
		mode: 'work' as 'work' | 'short' | 'long',
		/** 是否正在倒计时 */
		running: false,
		/** 本次阶段结束的绝对时间戳（ms） */
		endAt: 0,
		/** 本次阶段总时长（ms），用于绘制进度环 */
		duration: 0,
		/** 当前阶段剩余时间（ms）；暂停时保持，运行时由 endAt 推算 */
		remaining: 0,
	};
	/** 网站收藏：被折叠的分组名（会话内保持，点击分类标题展开/折叠） */
	sitesCollapsed: Set<string> = new Set();
	homeModules: HomeModule[] = [
		{ id: 'todo', title: '待办 · 今天要处理', cardCls: 'ad-card ad-b-todo', live: false, render: (b) => void this.renderKanbanTodo(b) },
		{ id: 'weather', title: '天气', cardCls: 'ad-card ad-b-weather', live: false, render: (b) => void this.renderWeather(b) },
		{ id: 'calendar', title: '日历', cardCls: 'ad-card ad-b-calendar', live: false, render: (b) => this.renderCalendar(b) },
		{ id: 'sites', title: '网站收藏', cardCls: 'ad-card ad-b-sites', live: false, render: (b) => void this.renderSites(b) },
		{ id: 'favorites', title: '常用文档', cardCls: 'ad-card ad-b-fav', live: false, render: (b) => this.renderFavorites(b) },
		{ id: 'quick-capture', title: '灵感捕捉', cardCls: 'ad-card ad-b-capture', live: false, render: (b) => this.renderQuickCapture(b) },
		{ id: 'pomodoro', title: '番茄钟', cardCls: 'ad-card ad-b-pomodoro', live: false, render: (b) => this.renderPomodoro(b) },
	];
	currentPage: 'home' | 'project' | 'opportunity' = 'home';

	constructor(leaf: WorkspaceLeaf, plugin: Dashboard) {
		super(leaf);
		this.plugin = plugin;
	}
	async onOpen() {
		this.containerEl.empty();
		this.dashboardEl = this.containerEl.createDiv({ cls: 'dashboard-plugin' });
		this.applyTheme();
		this.registerEvent(this.app.workspace.on('css-change', () => this.applyTheme()));
		try {
			const d = MOCK_DATA;
			this.renderNoise(this.dashboardEl);
			void this.renderPulse(this.dashboardEl, d);
			this.renderHeader(this.dashboardEl, d);
			this.renderActions(this.dashboardEl);
			this.renderBoard(this.dashboardEl, d);
			const refreshAll = () => { void this.updatePulse(); this.scheduleKanbanRefresh(); };
			this.registerEvent(this.app.vault.on('create', refreshAll));
			this.registerEvent(this.app.vault.on('delete', refreshAll));
			this.registerEvent(this.app.vault.on('rename', refreshAll));
			this.registerEvent(this.app.vault.on('modify', (file) => {
				if (!(file instanceof TFile)) return;
				if (file.path === this.plugin.settings.kanbanFile) { this.scheduleKanbanRefresh(); return; }
				if (file.path === this.plugin.settings.favoriteSitesFile) { this.scheduleSitesRefresh(); return; }
				if (file.path === this.plugin.settings.favoriteDocsFile) { this.scheduleDocsRefresh(); return; }
				void this.updatePulse();
			}));
		} catch (err) {
			try {
				const e = err instanceof Error ? err : new Error(String(err));
				this.dashboardEl?.empty();
				this.dashboardEl?.createEl('pre', { cls: 'ad-error', text: 'Dashboard render error: ' + (e.message || '') });
			} catch { /* ignore */ }
			console.error('[Dashboard] render error', err);
		}
	}

	async onClose() {
		if (this.noiseId) { window.cancelAnimationFrame(this.noiseId); this.noiseId = null; }
		if (this.adRowHObs) { this.adRowHObs.disconnect(); this.adRowHObs = undefined; }
		if (this.wxTimer !== null) { window.clearInterval(this.wxTimer); this.wxTimer = null; }
		if (this.kanbanRefreshTimer !== null) { window.clearTimeout(this.kanbanRefreshTimer); this.kanbanRefreshTimer = null; }
		if (this.sitesRefreshTimer !== null) { window.clearTimeout(this.sitesRefreshTimer); this.sitesRefreshTimer = null; }
		if (this.docsRefreshTimer !== null) { window.clearTimeout(this.docsRefreshTimer); this.docsRefreshTimer = null; }
		if (this.pomoTimer !== null) { window.clearInterval(this.pomoTimer); this.pomoTimer = null; }
		this.dashboardEl?.empty();
	}
  /** 按当前语言返回中 / 英文案（主界面文案双语） */
  t(zh: string, en: string): string {
    return this.plugin.settings.language === 'en' ? en : zh;
  }
  effectiveTheme() {
    const t = this.plugin.settings.theme;
    if (t === "auto") return document.body.classList.contains("theme-light") ? "light" : "dark";
    return t;
  }

  applyTheme() {
    var _a2;
    const root = (_a2 = this.dashboardEl) != null ? _a2 : this.containerEl.querySelector(".dashboard-plugin");
    if (root) root.setAttribute("data-theme", this.effectiveTheme());
    this.refreshThemeButton();
  }
  /** Keep the header toggle's icon/tooltip in sync with the effective theme. */

  refreshThemeButton() {
    const btn = this.adThemeBtn;
    if (!btn) return;
    const eff = this.effectiveTheme();
    btn.textContent = eff === "dark" ? "☀" : "\u{1F319}";
    btn.title = (eff === "dark" ? "切换到浅色" : "切换到深色") + "（同时切换 Obsidian 外观）";
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Dashboard";
  }

  getIcon() {
    return "layout-dashboard";
  }

  renderNoise(root) {
    const canvas = root.createEl("canvas", { cls: "ad-noise" });
    canvas.setCssProps({
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "0",
      pointerEvents: "none",
      imageRendering: "pixelated",
      display: "block"
    });
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;
    let frame = 0;
    const draw = () => {
      if (frame % 2 === 0) {
        const img = ctx.createImageData(size, size);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const v = Math.random() * 255;
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
          d[i + 3] = 18;
        }
        ctx.putImageData(img, 0, 0);
      }
      frame++;
      this.noiseId = window.requestAnimationFrame(draw);
    };
    this.noiseId = window.requestAnimationFrame(draw);
  }
  /* ============================================================
     Pulse
     ============================================================ */

  getVaultNoteCounts() {
    var _a2;
    const counts = /* @__PURE__ */ new Map();
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const d = new Date(file.stat.ctime);
      const key = fmtDate(d);
      counts.set(key, ((_a2 = counts.get(key)) != null ? _a2 : 0) + 1);
    }
    return counts;
  }

  async renderPulse(root, d) {
    var _a2;
    const bar = root.createDiv({ cls: "ad-pulse" });
    bar.createSpan({ cls: "ad-pulse__tag", text: "[ VAULT PULSE ]" });
    const today = /* @__PURE__ */ new Date();
    const todayKey = todayStr();
    const noteCounts = this.getVaultNoteCounts();
    const hs = calcHeatmapStats(noteCounts, today.getFullYear(), today);
    const todayCount = (_a2 = noteCounts.get(todayKey)) != null ? _a2 : 0;
    const totalEl = bar.createSpan({ text: `${hs.total} NOTES` });
    bar.createSpan({ cls: "ad-pulse__sep", text: "·" });
    const todayEl = bar.createSpan();
    todayEl.textContent = `Δ TODAY +${todayCount}`;
    bar.createSpan({ cls: "ad-pulse__sep", text: "·" });
    const streakEl = bar.createSpan({ text: `${hs.streak}D STREAK` });
    const caret = bar.createSpan({ cls: "ad-pulse__caret" });
    let caretOn = true;
    this.registerInterval(window.setInterval(() => {
      caretOn = !caretOn;
      caret.style.opacity = caretOn ? "1" : "0";
    }, 525));
    this.pulseEls = { total: totalEl, today: todayEl, streak: streakEl };
  }

  async updatePulse() {
    var _a2;
    if (!this.pulseEls) return;
    const today = /* @__PURE__ */ new Date();
    const todayKey = todayStr();
    const noteCounts = this.getVaultNoteCounts();
    const hs = calcHeatmapStats(noteCounts, today.getFullYear(), today);
    const todayCount = (_a2 = noteCounts.get(todayKey)) != null ? _a2 : 0;
    this.pulseEls.total.textContent = `${hs.total} NOTES`;
    this.pulseEls.today.textContent = `Δ TODAY +${todayCount}`;
    this.pulseEls.streak.textContent = `${hs.streak}D STREAK`;
  }
  /** Live-update only the dashboard title text (cheap; no full re-render). */

  renderHeader(root, d) {
    var _a2, _b;
    const h = root.createEl("header", { cls: "ad-header" });
    const left = h.createDiv({ cls: "ad-header__left" });
    left.createEl("p", { cls: "ad-eyebrow", text: d.header.eyebrow });
    this.adTitleEl = left.createEl("h1", { cls: "ad-title", text: this.plugin.settings.dashboardTitle || d.header.title });
    left.createEl("p", { cls: "ad-subtitle", text: "Obsidian · Personal Dashboard · v" + ((_b = (_a2 = this.plugin.manifest) == null ? void 0 : _a2.version) != null ? _b : d.header.subtitle.replace(/^.*v/, "v")) });
    const right = h.createDiv({ cls: "ad-header__right" });
    const now = /* @__PURE__ */ new Date();
    const isEn = this.plugin.settings.language === 'en';
    const dateStr = now.toLocaleDateString(isEn ? "en-US" : "zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: isEn ? "short" : "2-digit", day: "numeric" });
    const timeStr = now.toLocaleTimeString(isEn ? "en-US" : "zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" });
    this.dateEl = right.createDiv({ cls: "ad-header__date", text: `${dateStr} ${timeStr}` });
    const meta = right.createDiv({ cls: "ad-header__meta" });
    this.weekdayEl = meta.createSpan({ text: (/* @__PURE__ */ new Date()).toLocaleDateString(isEn ? "en-US" : "zh-CN", { timeZone: "Asia/Shanghai", weekday: "long" }) });
    meta.createSpan({ cls: "ad-dot" });
    const initialLunar = getLunarDate(/* @__PURE__ */ new Date());
    // 英文模式不显示中国农历
    this.lunarEl = this.plugin.settings.language === 'en' ? null : meta.createSpan({ text: initialLunar ? "农历 " + initialLunar : d.lunar });
    const btns = right.createDiv({ cls: "ad-header__btns" });
    const themeBtn = btns.createEl("button", { cls: "ad-header__theme" });
    this.adThemeBtn = themeBtn;
    this.refreshThemeButton();
    themeBtn.addEventListener("click", () => {
      void (async () => {
        const next = this.effectiveTheme() === "light" ? "dark" : "light";
        this.plugin.setObsidianTheme(next);
        this.plugin.settings.theme = "auto";
        await this.plugin.saveSettings();
        this.plugin.refreshThemeButtons();
        this.applyTheme();
      })();
    });
    const settings = btns.createEl("button", { cls: "ad-header__settings" });
    settings.textContent = this.t("⚙ 设置", "⚙ Settings");
    settings.addEventListener("click", () => {
      var _a3, _b2;
      const app = this.app as unknown as { setting?: { open(): void; openTabById(id: string): void } };
      (_a3 = app.setting) == null ? void 0 : _a3.open();
      (_b2 = app.setting) == null ? void 0 : _b2.openTabById(this.plugin.manifest.id);
    });
    this.registerInterval(window.setInterval(() => {
      const n = /* @__PURE__ */ new Date();
      if (this.dateEl) {
        const ds = n.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
        const ts = n.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" });
        this.dateEl.textContent = `${ds} ${ts}`;
      }
      if (this.weekdayEl) {
        this.weekdayEl.textContent = n.toLocaleDateString(this.plugin.settings.language === 'en' ? "en-US" : "zh-CN", { timeZone: "Asia/Shanghai", weekday: "long" });
      }
      if (this.lunarEl) {
        const lunar = getLunarDate(n);
        if (lunar) this.lunarEl.textContent = "农历 " + lunar;
      }
    }, 3e4));
  }
  /* ============================================================
     Actions toolbar
     ============================================================ */

  refreshTitle() {
    if (!this.adTitleEl) return;
    this.adTitleEl.textContent = this.plugin.settings.dashboardTitle || MOCK_DATA.header.title;
  }
  /* ============================================================
     Header
     ============================================================ */

  renderActions(root) {
    const nav = root.createEl("nav", { cls: "ad-toolbar" });
    const navItems = [
      { glyph: "⌂", label: this.t("主页", "Home"), action: "home", svg: ICON_home }
    ];
    const makeBtn = (it, extraCls = "") => {
      const btn = nav.createEl("button", { cls: "ad-toolbar__btn" + (extraCls ? " " + extraCls : "") });
      const glyphEl = btn.createSpan({ cls: "ad-glyph" });
      if (it.svg) injectSvg(glyphEl, it.svg);
      else glyphEl.textContent = it.glyph;
      btn.createSpan({ text: it.label });
      btn.addEventListener("click", () => {
        btn.addClass("is-active");
        try {
          if (it.action === "home") void this.showDashboard();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.showToast(this.t("打开失败：", "Failed to open: ") + msg, "error");
          console.error('[Dashboard] toolbar action "' + it.action + '" failed', e);
        }
        window.setTimeout(() => btn.removeClass("is-active"), 350);
      });
      return btn;
    };
    const navGroup = nav.createDiv({ cls: "ad-toolbar__group" });
    navItems.forEach((it) => navGroup.appendChild(makeBtn(it)));
  }
  /* ============================================================
     Parse-issue banner (shown directly under the banner image)
     ============================================================ */

  async openFileByPath(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(true);
      await leaf.openFile(f);
    } else {
      this.showToast(this.t("文件不存在：", "File not found: ") + path, "error");
    }
  }
  /* ============================================================
     Empty-state helper + first-run guide (no sample-data auto-create)
     ============================================================ */

  renderEmpty(container, opts) {
    const e = container.createDiv({ cls: "ad-empty" });
    if (opts.icon) e.createDiv({ cls: "ad-empty__icon", text: opts.icon });
    e.createDiv({ cls: "ad-empty__title", text: opts.title });
    if (opts.hint) e.createDiv({ cls: "ad-empty__hint", text: opts.hint });
    if (opts.actionLabel && opts.onAction) {
      const btn = e.createEl("button", { cls: "ad-empty__btn", text: opts.actionLabel });
      btn.addEventListener("click", () => opts.onAction());
    }
  }

  renderBoard(root, d) {
    const board = root.createDiv({ cls: "ad-board" });
    this.boardEl = board;
    void this.renderEnabledModules(board);
    this.attachBoardInteractions();
  }
  /* ---- Quick Capture ---- */

  rebuildHome() {
    if (this.currentPage !== "home" || !this.boardEl) return;
    this.boardEl.empty();
    void this.renderEnabledModules(this.boardEl);
  }
  /** 设置页修改看板开关/名称/阶段配置后，立即刷新导航与看板页（无需重启） */

  renderQuickCapture(board) {
    const card = this.getOrCreateCard(board, "ad-card ad-b-capture");
    this.cardHead(card, "◆", this.t("快速捕捉", "Quick Capture"));
    const qc = card.createDiv({ cls: "ad-qc" });
    const area = qc.createEl("textarea", {
      cls: "ad-qc__area",
      attr: { rows: "3", placeholder: this.t("记录一闪而过的想法…", "Capture a fleeting thought…") }
    });
    const row = qc.createDiv({ cls: "ad-qc__row" });
    const cta = row.createEl("button", { cls: "ad-qc__cta", text: this.t("捕捉", "Capture") });
    const submit = async () => {
      const content = area.value.trim();
      if (!content) {
        area.focus();
        return;
      }
      cta.addClass("flash");
      try {
        await this.createCaptureNote(content);
        area.value = "";
        this.showToast(this.t("✨ 想法已捕捉！", "Captured!"));
      } catch (err) {
        console.error("[Dashboard] 快速捕捉失败", err);
        this.showToast(this.t("⚠️ 捕捉失败，请检查「存储路径」设置", "Capture failed, check Storage Paths"), "error");
      } finally {
        window.setTimeout(() => cta.removeClass("flash"), 400);
      }
    };
    cta.addEventListener("click", () => void submit());
  }
  /* ---- 番茄钟（Pomodoro） ---- */
  /** 环形进度环半径（与 SVG viewBox 内 circle r 保持一致） */
  static POMO_R = 52;
  /** 读取今日番茄计数，跨天自动归零并落盘 */
  pomoDailyCount() {
    const p = this.plugin.settings.pomodoro;
    const today = todayStr();
    if (p.dailyDate !== today) {
      p.dailyCount = 0;
      p.dailyDate = today;
      void this.plugin.saveSettings();
    }
    return p.dailyCount || 0;
  }
  /** 当前阶段的总时长（ms），取自设置 */
  pomoDurationMs() {
    const p = this.plugin.settings.pomodoro;
    const minutes = this.pomo.mode === "work" ? p.workMinutes : this.pomo.mode === "short" ? p.shortBreakMinutes : p.longBreakMinutes;
    return (minutes || 25) * 60 * 1000;
  }
  /** 剩余毫秒 → mm:ss */
  pomoFmt(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }
  /** 当前阶段的中英文标签 */
  pomoModeLabel() {
    if (this.pomo.mode === "short") return this.t("短休息", "Short Break");
    if (this.pomo.mode === "long") return this.t("长休息", "Long Break");
    return this.t("专注中", "Focus");
  }
  /** 启动每秒 tick（幂等：已在运行则忽略） */
  pomoEnsureTimer() {
    if (this.pomoTimer !== null) return;
    this.pomoTimer = window.setInterval(() => this.pomoTick(), 1000);
  }
  /** 停止 tick */
  pomoStopTimer() {
    if (this.pomoTimer !== null) {
      window.clearInterval(this.pomoTimer);
      this.pomoTimer = null;
    }
  }
  /** 每秒跳动：更新时间与进度环；到点则完成当前阶段 */
  pomoTick() {
    if (!this.pomo.running) return;
    const remain = this.pomo.endAt - Date.now();
    if (remain <= 0) {
      this.pomoComplete();
      return;
    }
    this.pomo.remaining = remain;
    this.pomoUpdateUI();
  }
  /** 把当前计时状态同步到卡片 DOM（时间 / 模式 / 进度环 / 按钮文本） */
  pomoUpdateUI() {
    const root = this.boardEl;
    if (!root) return;
    const C = 2 * Math.PI * DashboardView.POMO_R;
    const body = root.querySelector(".ad-pomo");
    if (body) {
      body.classList.toggle("ad-pomo--work", this.pomo.mode === "work");
      body.classList.toggle("ad-pomo--short", this.pomo.mode === "short");
      body.classList.toggle("ad-pomo--long", this.pomo.mode === "long");
    }
    const time = root.querySelector(".ad-pomo__time");
    if (time) time.textContent = this.pomoFmt(this.pomo.remaining);
    const mode = root.querySelector(".ad-pomo__mode");
    if (mode) mode.textContent = this.pomoModeLabel();
    const stage = root.querySelector(".ad-pomo__stage");
    if (stage) {
      stage.textContent = this.pomo.mode === "work"
        ? this.t("第 " + (this.pomoDailyCount() + 1) + " 个番茄", "Pomodoro #" + (this.pomoDailyCount() + 1))
        : this.t("本轮已完成 " + this.pomoDailyCount() + " 个", this.pomoDailyCount() + " done this round");
    }
    const fg = root.querySelector(".ad-pomo__ring-fg");
    if (fg instanceof SVGCircleElement) {
      const ratio = this.pomo.duration > 0 ? this.pomo.remaining / this.pomo.duration : 1;
      fg.style.strokeDasharray = String(C);
      fg.style.strokeDashoffset = String(C * ratio);
    }
    const btn = root.querySelector(".ad-pomo__btn-start");
    if (btn) btn.textContent = this.pomo.running ? this.t("暂停", "Pause") : this.t("开始", "Start");
  }
  /** 开始 / 继续倒计时 */
  pomoStart() {
    if (this.pomo.remaining <= 0) this.pomoReset();
    this.pomo.running = true;
    this.pomo.endAt = Date.now() + this.pomo.remaining;
    this.pomoEnsureTimer();
    this.pomoUpdateUI();
  }
  /** 暂停倒计时 */
  pomoPause() {
    this.pomo.running = false;
    this.pomo.remaining = Math.max(0, this.pomo.endAt - Date.now());
    this.pomoStopTimer();
    this.pomoUpdateUI();
  }
  /** 重置：回到当前阶段完整时长并停止 */
  pomoReset() {
    this.pomo.running = false;
    this.pomoStopTimer();
    this.pomo.duration = this.pomoDurationMs();
    this.pomo.remaining = this.pomo.duration;
    this.pomo.endAt = Date.now() + this.pomo.duration;
    this.pomoUpdateUI();
  }
  /** 当前阶段结束（自然到点或点击跳过）：专注 → 计数并进入休息；休息 → 回到专注 */
  pomoComplete() {
    const p = this.plugin.settings.pomodoro;
    if (this.pomo.mode === "work") {
      if (p.dailyDate !== todayStr()) {
        p.dailyCount = 0;
        p.dailyDate = todayStr();
      }
      p.dailyCount = (p.dailyCount || 0) + 1;
      p.dailyDate = todayStr();
      void this.plugin.saveSettings();
      this.pomo.mode = p.dailyCount % (p.cycles || 4) === 0 ? "long" : "short";
      this.showToast(this.t("🍅 专注完成！休息一下", "🍅 Focus done! Take a break"));
    } else {
      this.pomo.mode = "work";
      this.showToast(this.t("☕ 休息结束，开始专注", "☕ Break over, back to focus"));
    }
    this.pomo.duration = this.pomoDurationMs();
    this.pomo.remaining = this.pomo.duration;
    this.pomo.running = p.autoStart;
    this.pomo.endAt = Date.now() + this.pomo.remaining;
    if (p.sound) this.pomoBeep();
    if (this.pomo.running) this.pomoEnsureTimer();
    else this.pomoStopTimer();
    // 重建卡片：模式 / 计数 / 指示器都变了
    if (this.boardEl) this.renderPomodoro(this.boardEl);
  }
  /** 结束提示音：Web Audio 两声短音（无需资源文件） */
  pomoBeep() {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const now = ctx.currentTime;
      const beep = (t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      };
      beep(now);
      beep(now + 0.45);
    } catch (err) {
      /* 无音频设备或上下文被拦截时静默 */
    }
  }
  /** 番茄钟卡片渲染：环形进度 + 剩余时间 + 控制按钮 + 今日计数 */
  renderPomodoro(board) {
    const card = this.getOrCreateCard(board, "ad-card ad-b-pomodoro");
    const daily = this.pomoDailyCount();
    const hint = card.createSpan({ cls: "ad-card__hint ad-pomo__count" });
    this.cardHead(card, "◉", this.t("番茄钟", "Pomodoro"), void 0, hint);
    hint.textContent = this.t("今日 ", "Today ") + daily + " 🍅";
    // 首次渲染（或视图重开后）初始化计时状态
    if (!this.pomo.duration) {
      this.pomo.duration = this.pomoDurationMs();
      this.pomo.remaining = this.pomo.duration;
      this.pomo.endAt = Date.now() + this.pomo.duration;
    }
    const body = card.createDiv({ cls: "ad-pomo" });
    // 环形进度
    const ringWrap = body.createDiv({ cls: "ad-pomo__ringwrap" });
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.setAttribute("class", "ad-pomo__ring");
    const bg = document.createElementNS(NS, "circle");
    bg.setAttribute("class", "ad-pomo__ring-bg");
    bg.setAttribute("cx", "60");
    bg.setAttribute("cy", "60");
    bg.setAttribute("r", String(DashboardView.POMO_R));
    const fg = document.createElementNS(NS, "circle");
    fg.setAttribute("class", "ad-pomo__ring-fg");
    fg.setAttribute("cx", "60");
    fg.setAttribute("cy", "60");
    fg.setAttribute("r", String(DashboardView.POMO_R));
    svg.appendChild(bg);
    svg.appendChild(fg);
    ringWrap.appendChild(svg);
    const center = ringWrap.createDiv({ cls: "ad-pomo__center" });
    center.createDiv({ cls: "ad-pomo__time", text: this.pomoFmt(this.pomo.remaining) });
    center.createDiv({ cls: "ad-pomo__mode" });
    // 控制按钮
    const ctrl = body.createDiv({ cls: "ad-pomo__ctrl" });
    const start = ctrl.createEl("button", { cls: "ad-pomo__btn ad-pomo__btn-start" });
    const reset = ctrl.createEl("button", { cls: "ad-pomo__btn", text: this.t("重置", "Reset") });
    const skip = ctrl.createEl("button", { cls: "ad-pomo__btn", text: this.t("跳过", "Skip") });
    start.addEventListener("click", () => {
      if (this.pomo.running) this.pomoPause();
      else this.pomoStart();
    });
    reset.addEventListener("click", () => this.pomoReset());
    skip.addEventListener("click", () => this.pomoComplete());
    // 底部：今日番茄指示器 + 阶段提示
    const foot = body.createDiv({ cls: "ad-pomo__foot" });
    const dots = foot.createDiv({ cls: "ad-pomo__dots" });
    for (let i = 0; i < (this.plugin.settings.pomodoro.cycles || 4); i++) {
      dots.createSpan({ cls: "ad-pomo__dot" + (i < daily ? " is-done" : "") });
    }
    foot.createDiv({ cls: "ad-pomo__stage" });
    // 同步 UI 并保持 tick
    this.pomoUpdateUI();
    if (this.pomo.running) this.pomoEnsureTimer();
  }
  /* ---- Toast ---- */

  showToast(message, kind = "success") {
    const toast = document.body.createDiv({ cls: "ad-toast" + (kind === "error" ? " ad-toast--error" : "") });
    toast.createSpan({ text: message });
    window.setTimeout(() => {
      toast.addClass("ad-toast--out");
      window.setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
  /* ---- Create note in vault ---- */
  /** Ensure a folder exists, creating parent folders recursively if needed. */

  async ensureFolder(path) {
    if (!path || path === "/") return;
    if (this.app.vault.getAbstractFileByPath(path)) return;
    const parts = path.split("/").filter(Boolean);
    let cur = "";
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(cur)) {
        await this.app.vault.createFolder(cur);
      }
    }
  }

  async createCaptureNote(content) {
    const qc = this.plugin.settings.quickCapture;
    const now = /* @__PURE__ */ new Date();
    const folderPath = qc.storagePath;
    await this.ensureFolder(folderPath);
    const filename = this.applyNamingPattern(qc.namingPattern, now);
    const filepath = `${folderPath}/${filename}.md`;
    let fileContent = content;
    if (qc.templateFile) {
      const tplPath = this.resolveTemplatePath(qc.templateFile);
      const tplFile = this.app.vault.getAbstractFileByPath(tplPath);
      if (tplFile instanceof TFile) {
        const tpl = await this.app.vault.read(tplFile);
        fileContent = this.applyTemplate(tpl, content, filename, now);
      }
    }
    await this.app.vault.create(filepath, fileContent);
  }
  /* ---- Create diary note ---- */

  applyTemplate(template, content, title, d) {
    const pad = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    let result = template.replace(/\{\{date\}\}/g, date).replace(/\{\{time\}\}/g, time).replace(/\{\{title\}\}/g, title);
    if (result.includes("{{content}}")) {
      result = result.replace(/\{\{content\}\}/g, content);
    } else {
      result += "\n\n" + content;
    }
    return result;
  }

  resolveTemplatePath(file) {
    const f = file.trim();
    if (!f) return "";
    return f.endsWith(".md") ? f : `${f}.md`;
  }

  applyNamingPattern(pattern, d) {
    const pad = (n) => String(n).padStart(2, "0");
    const isEn = this.plugin.settings.language === 'en';
    const WK_SHORT = isEn ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const WK_FULL = isEn ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] : ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const meridiem = d.getHours() < 12 ? (isEn ? "AM" : "上午") : (isEn ? "PM" : "下午");
    const h12 = d.getHours() % 12 || 12;
    const map = {
      YYYY: String(d.getFullYear()),
      MMM: isEn ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] : `${d.getMonth() + 1}月`,
      MM: pad(d.getMonth() + 1),
      dddd: WK_FULL[d.getDay()],
      ddd: WK_SHORT[d.getDay()],
      DD: pad(d.getDate()),
      HH: pad(d.getHours()),
      hh: pad(h12),
      mm: pad(d.getMinutes()),
      ss: pad(d.getSeconds()),
      SS: pad(d.getSeconds()),
      A: meridiem
    };
    const name = pattern.replace(/(dddd|ddd|YYYY|MMM|MM|DD|HH|hh|mm|ss|SS|A)/g, (m) => {
      var _a2;
      return (_a2 = map[m]) != null ? _a2 : m;
    });
    return name.replace(/[*"/<>:|?\\]/g, "-");
  }
  /* ============================================================
     Task actions
     ============================================================ */
  /** Toggle task status in source file's Chinese frontmatter */

  async showDashboard() {
    if (!this.boardEl) return;
    this.boardEl.empty();
    this.boardEl.removeClass("po-board");
    this.boardEl.removeClass("op-board");
    this.boardEl.addClass("ad-board");
    this.currentPage = "home";
    await this.renderEnabledModules(this.boardEl);
  }
  /** Delete task file from vault */

  static cardSel(cls) {
    return "." + cls.trim().split(/\s+/).join(".");
  }
  /** Reuse an existing card element (keeps its grid placement → no disappearance flash)
   *  by emptying its contents, or create it if missing. */

  getOrCreateCard(board, cls) {
    const existing = board.querySelector(DashboardView.cardSel(cls));
    let card;
    if (existing) {
      existing.empty();
      card = existing;
    } else {
      card = board.createDiv({ cls });
    }
    return card;
  }
  async renderEnabledModules(board, opts?) {
    var _a2;
    const configs = (_a2 = this.plugin.settings.homeModules) != null ? _a2 : [];
    const enabled = configs.filter((m) => m.enabled && this.homeModules.some((x) => x.id === m.id)).sort((a, b) => a.order - b.order);
    const enabledTokens = enabled.map((m) => {
      const mod = this.homeModules.find((x) => x.id === m.id);
      return mod ? mod.cardCls.split(" ")[1] : "";
    }).filter((t) => t !== "");
    board.querySelectorAll(".ad-card").forEach((el) => {
      const matched = enabledTokens.some((tok) => el.classList.contains(tok));
      if (!matched) el.remove();
    });
    const shells = [];
    for (const cfg of enabled) {
      const mod = this.homeModules.find((x) => x.id === cfg.id);
      if (!mod) continue;
      const sel = DashboardView.cardSel(mod.cardCls);
      let el = board.querySelector(sel);
      if (!el) el = board.createDiv({ cls: mod.cardCls });
      el.setAttribute("data-mod", mod.id);
      this.applyCardSpan(el, cfg.cols, cfg.rows);
      shells.push(el);
    }
    let prev = null;
    for (const el of shells) {
      const expected = prev ? prev.nextElementSibling : board.firstElementChild;
      if (expected !== el) board.insertBefore(el, expected);
      prev = el;
    }
    for (const cfg of enabled) {
      const mod = this.homeModules.find((x) => x.id === cfg.id);
      if (!mod) continue;
      if ((opts == null ? void 0 : opts.onlyLive) && mod.live === false) continue;
      if (this.currentPage !== "home" || !this.boardEl) return;
      await mod.render(board);
      const cardEl = board.querySelector(DashboardView.cardSel(mod.cardCls));
      if (cardEl) {
        cardEl.setAttribute("data-mod", mod.id);
        this.applyCardSpan(cardEl, cfg.cols, cfg.rows);
      }
    }
    this.updateRowH();
  }
  /** 把「宽 cols 格 × 高 rows 格」写进卡片的 CSS 变量（grid-column span 由此驱动）。
   *  统一经过 resolveSpan 夹紧：按当前实际列数裁剪宽度（避免撑出隐式列）、
   *  按模块最低宽度（MIN_COLS）与最低宽高比（MIN_RATIO）夹紧，保证项目情况/笔记统计
   *  等关键卡片既不被压得过窄、也不会被拉成「过窄过高的竖条」。 */

  applyCardSpan(el, cols, rows) {
    var _a2;
    const modId = (_a2 = el.getAttribute("data-mod")) != null ? _a2 : "";
    const { cols: c, rows: r } = this.resolveSpan(modId, clampSpan(cols), clampSpan(rows));
    el.style.setProperty("--cols", String(c));
    el.style.setProperty("--rows", String(r));
  }
  /** 把一个（可能非法的）宽高格数解析成合法组合，渲染 / 拖拽 / 比例菜单 / 响应式夹紧共用，保证规则一致：
   *  - 夹到 1..MAX_SPAN；
   *  - 按当前实际列数裁剪宽度（2 列/1 列响应式下避免撑出隐式列）；
   *  - 按模块最低宽度（MIN_COLS）夹紧；
   *  - 按模块最低宽高比（MIN_RATIO）夹紧：宽/高 ≥ 最低比例 ⇒ 高 ≤ 宽/最低比例。 */

  resolveSpan(modId, cols, rows) {
    const board = this.boardEl;
    let colCount = board ? parseInt(board.style.getPropertyValue("--ad-cols"), 10) : 0;
    if (!(colCount > 0)) {
      colCount = board
        ? this.computeColCount(board.getBoundingClientRect().width, parseFloat(getComputedStyle(board).columnGap) || 12)
        : MAX_SPAN;
    }
    colCount = Math.max(1, Math.min(MAX_SPAN, colCount));
    let c = this.clampMinCols(modId, Math.min(colCount, clampSpan(cols)), colCount);
    let r = clampSpan(rows);
    const ratio = MIN_RATIO[modId];
    if (ratio) {
      const maxRows = Math.max(1, Math.floor(c / ratio));
      if (r > maxRows) r = maxRows;
    }
    return { cols: c, rows: r };
  }
  /** 把宽度按「模块最低宽度」与「当前实际列数」双重夹紧：响应式到更窄列数时只填充满，不强行跨列 */

  clampMinCols(modId, cols, colCount) {
    var _a2;
    const min = (_a2 = MIN_COLS[modId]) != null ? _a2 : 1;
    const c = colCount >= min ? Math.max(min, cols) : cols;
    return Math.max(1, Math.min(colCount, c));
  }
  /** 设置页修改显隐/排序后，立即重建首页（清空并重渲染全部启用模块） */

  attachBoardInteractions() {
    if (this.adBoardWired || !this.boardEl) return;
    this.adBoardWired = true;
    this.updateRowH();
    if (typeof ResizeObserver !== "undefined") {
      this.adRowHObs = new ResizeObserver(() => this.updateRowH());
      this.adRowHObs.observe(this.boardEl);
    }
    requestAnimationFrame(() => this.updateRowH());
  }
  /** 响应式布局中枢：按板面（= Obsidian 窗格）实际宽度算出列数并写入 --ad-cols，
   *  同时把 Grid 行高 --ad-row-h 锁成「单列宽」（1×1 卡正方、多列卡与 1×1 同高、比例不变）。
   *  列数走 4→3→2→1 梯度，保证每列宽度 ≥ MIN_CARD_W（可读下限），列宽仍是 1fr 随窗口等比缩放。
   *  列数变化时重夹紧全部卡片（防 2 列卡在仅剩 1 列时撑出隐式列被挤压）。 */

  updateRowH() {
    const board = this.boardEl;
    if (!board) return;
    const cs = getComputedStyle(board);
    const gap = parseFloat(cs.columnGap) || 12;
    const width = board.getBoundingClientRect().width;
    if (width <= 0) return;
    const colCount = this.computeColCount(width, gap);
    board.style.setProperty("--ad-cols", String(colCount));
    const unit = Math.max(132, (width - gap * (colCount - 1)) / colCount);
    board.style.setProperty("--ad-row-h", `${Math.round(unit)}px`);
    if (colCount !== this.adLastColCount) {
      this.adLastColCount = colCount;
      this.reapplySpans();
    }
  }
  /** 按板面实际宽度推算列数：宽→窄 4→3→2→1，每列宽度恒 ≥ MIN_CARD_W。
   *  这是「卡片不被挤压」的唯一保证——绝不能交给 CSS auto-fill（它会在宽屏生成 5~7 列，
   *  每列只有 MIN_CARD_W 那么宽，卡片内容被挤压竖排，且与 MAX_SPAN=4 的 span 模型冲突）。
   *  @param width 板面内容宽度 @param gap 列间距 */

  computeColCount(width, gap) {
    const MIN_CARD_W = 260;
    const fit = Math.floor((width + gap) / (MIN_CARD_W + gap));
    return Math.max(1, Math.min(MAX_SPAN, fit));
  }
  /** 按当前列数与各模块最低约束，用保存的 settings 比例重新夹紧所有卡片（响应式列数变化时调用） */

  reapplySpans() {
    var _a2;
    const board = this.boardEl;
    if (!board) return;
    const hm = (_a2 = this.plugin.settings.homeModules) != null ? _a2 : [];
    board.querySelectorAll(".ad-card").forEach((card) => {
      var _a3;
      const el = card as HTMLElement;
      const modId = (_a3 = el.getAttribute("data-mod")) != null ? _a3 : "";
      const m = hm.find((x) => x.id === modId);
      if (!m) return;
      const { cols, rows } = this.resolveSpan(modId, clampSpan(m.cols), clampSpan(m.rows));
      el.style.setProperty("--cols", String(cols));
      el.style.setProperty("--rows", String(rows));
    });
  }

  async renderFavorites(board) {
    const card = this.getOrCreateCard(board, "ad-card ad-b-fav");
    this.cardHead(card, "★", this.t("常用文档", "Favorites"));
    const wrap = card.createDiv({ cls: "ad-fav" });
    const list = wrap.createDiv({ cls: "ad-fav__list" });
    const docs = await this.readDocsFile();
    if (docs.length === 0) {
      const empty = list.createDiv({ cls: "ad-fav__empty" });
      empty.createSpan({ text: this.t("还没有常用文档", "No favorites yet") });
      const addBtn2 = empty.createEl("button", { cls: "ad-fav__add", text: this.t("+ 添加", "+ Add") });
      addBtn2.addEventListener("click", (e) => {
        e.stopPropagation();
        void this.openFavPicker();
      });
      return;
    }
    for (const [i, doc] of docs.entries()) {
      const row = list.createDiv({ cls: "ad-fav__row" });
      row.setAttribute("data-path", doc.path);
      row.createSpan({ cls: "ad-fav__icon", text: "◆" });
      row.createSpan({ cls: "ad-fav__title", text: this.favDisplayName(doc) });
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        void this.openFileByPath(doc.path);
      });
      row.addEventListener("contextmenu", (e) => this.openFavMenu(e, i));
      attachTouchMenu(row, (e) => this.openFavMenu(e, i));
    }
    const addBar = wrap.createDiv({ cls: "ad-fav__addbar" });
    const addBtn = addBar.createEl("button", { cls: "ad-fav__add", text: this.t("+ 添加", "+ Add") });
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.openFavPicker();
    });
  }
  /** 常用文档的显示名：优先自定义 title，否则用文件名（去 .md） */

  favDisplayName(doc) {
    var _a2;
    if (doc.title && doc.title.trim()) return doc.title;
    return ((_a2 = doc.path.split("/").pop()) != null ? _a2 : doc.path).replace(/\.md$/, "");
  }
  /** 打开「选择文档」模态框，把勾选的文档并入常用文档并刷新卡片 */

  async openFavPicker() {
    const existing = (await this.readDocsFile()).map((d) => d.path);
    new FavoriteDocsModal(this.app, existing, async (docs) => {
      if (!docs.length) return;
      let added = 0;
      await this.writeDocsMd((content) => {
        let cur = content;
        const seen = new Set(parseDocsMd(cur).map((p) => p.doc.path));
        for (const doc of docs) {
          if (seen.has(doc.path)) continue;
          const next = upsertDocLine(cur, doc);
          if (next) { cur = next; seen.add(doc.path); added++; }
        }
        return cur;
      });
      if (added) this.showToast(this.t("已添加 ", "Added ") + added + this.t(" 个常用文档", " favorites"));
    }).open();
  }
  /** 重建「常用文档」卡片内容（getOrCreateCard 会清空并重填同一卡壳，保留比例/位置） */

  refreshFavoritesCard() {
    if (this.currentPage !== "home" || !this.boardEl) return;
    void this.renderFavorites(this.boardEl);
  }
  /** 常用文档右键菜单：打开 / 上移 / 下移 / 移除 */

  openFavMenu(e, index) {
    e.preventDefault();
    e.stopPropagation();
    const menu = new Menu();
    menu.addItem((item) => item.setTitle(this.t("打开", "Open")).setIcon("file-text").onClick(() => void this.openFavAt(index)));
    menu.addItem((item) => item.setTitle(this.t("上移", "Move up")).onClick(() => void this.moveFav(index, -1)));
    menu.addItem((item) => item.setTitle(this.t("下移", "Move down")).onClick(() => void this.moveFav(index, 1)));
    menu.addItem((item) => item.setTitle(this.t("移除", "Remove")).setIcon("trash").onClick(() => void this.removeFav(index)));
    menu.showAtMouseEvent(e);
  }
  /** 打开常用文档列表中的第 index 条 */
  async openFavAt(index) {
    const docs = await this.readDocsFile();
    const doc = docs[index];
    if (doc) void this.openFileByPath(doc.path);
  }
  /** 上移/下移常用文档并刷新 */

  async moveFav(index, delta) {
    const docs = await this.readDocsFile();
    const doc = docs[index];
    if (!doc) return;
    await this.writeDocsMd((content) => moveDocLine(content, doc.path, delta));
  }
  /** 移除一条常用文档并刷新 */

  async removeFav(index) {
    const docs = await this.readDocsFile();
    const doc = docs[index];
    if (!doc) return;
    await this.writeDocsMd((content) => removeDocLine(content, doc.path));
  }
  /* ============================================================
     待办 · 今天要处理（Obsidian Kanban 双向兼容）
     ============================================================ */
  /** 网站收藏 md：读取并解析；文件缺失时创建（旧 data.json 数据首次迁移） */
  async readSitesFile() {
    const path = this.plugin.settings.favoriteSitesFile;
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) {
      const legacy = this.plugin.settings.favoriteSites ?? [];
      const content = legacy.length
        ? serializeSites(legacy)
        : '# 网站收藏\n\n还没有收藏站点，可在卡片点 ＋ 添加，或直接在此编辑（## 分类 + - 名称 → URL）。\n';
      await this.ensureMdFile(path, content);
      return legacy;
    }
    const content = await this.app.vault.read(f);
    return parseSitesMd(content).map((p) => p.site);
  }
  /** 常用文档 md：读取并解析；文件缺失时创建（旧 data.json 数据首次迁移） */
  async readDocsFile() {
    const path = this.plugin.settings.favoriteDocsFile;
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) {
      const legacy = this.plugin.settings.favoriteDocs ?? [];
      const content = legacy.length
        ? serializeDocs(legacy)
        : '# 常用文档\n\n还没有常用文档，可在卡片点 ＋ 添加，或直接在此编辑（- [[路径|显示名]]）。\n';
      await this.ensureMdFile(path, content);
      return legacy;
    }
    const content = await this.app.vault.read(f);
    return parseDocsMd(content).map((p) => p.doc);
  }
  /** 网站收藏 md：行级改写后写回（不破坏手写内容）；modify 事件会自动刷新卡片 */
  async writeSiteMd(apply: (content: string) => string | null): Promise<void> {
    const path = this.plugin.settings.favoriteSitesFile;
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) return;
    const content = await this.app.vault.read(f);
    const next = apply(content);
    if (next == null || next === content) return;
    await this.app.vault.modify(f, next);
  }
  /** 常用文档 md：行级改写后写回 */
  async writeDocsMd(apply: (content: string) => string | null): Promise<void> {
    const path = this.plugin.settings.favoriteDocsFile;
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) return;
    const content = await this.app.vault.read(f);
    const next = apply(content);
    if (next == null || next === content) return;
    await this.app.vault.modify(f, next);
  }
  /** 确保 md 数据文件存在（含父目录），用于首次创建 */
  async ensureMdFile(path: string, content: string): Promise<TFile | null> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    const dir = path.split('/').slice(0, -1).join('/');
    if (dir) await this.ensureFolder(dir);
    return this.app.vault.create(path, content);
  }
  /** 网站收藏 md 变化后的去抖刷新 */
  scheduleSitesRefresh() {
    if (this.sitesRefreshTimer !== null) window.clearTimeout(this.sitesRefreshTimer);
    this.sitesRefreshTimer = window.setTimeout(() => {
      this.sitesRefreshTimer = null;
      this.refreshSitesCard();
    }, 200);
  }
  /** 常用文档 md 变化后的去抖刷新 */
  scheduleDocsRefresh() {
    if (this.docsRefreshTimer !== null) window.clearTimeout(this.docsRefreshTimer);
    this.docsRefreshTimer = window.setTimeout(() => {
      this.docsRefreshTimer = null;
      this.refreshFavoritesCard();
    }, 200);
  }
  /** 读取 Kanban 数据文件并解析；文件缺失时返回空 board 与 file=null */

  async readKanbanBoard() {
    const path = this.plugin.settings.kanbanFile;
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) return { board: parseKanbanBoard(""), file: null };
    const content = await this.app.vault.read(f);
    return { board: parseKanbanBoard(content), file: f };
  }
  /** Kanban 文件变化后的去抖刷新（合并连续写回触发的多次 modify 事件） */

  scheduleKanbanRefresh() {
    if (this.kanbanRefreshTimer !== null) window.clearTimeout(this.kanbanRefreshTimer);
    this.kanbanRefreshTimer = window.setTimeout(() => {
      this.kanbanRefreshTimer = null;
      this.refreshKanbanCard();
    }, 200);
  }
  /** 重建「待办」卡片（仅首页） */

  refreshKanbanCard() {
    if (this.currentPage !== "home" || !this.boardEl) return;
    void this.renderKanbanTodo(this.boardEl);
  }
  /** 待办卡渲染：快速添加 + 待办列表 + 已完成折叠区 */

  async renderKanbanTodo(board) {
    const card = this.getOrCreateCard(board, "ad-card ad-b-todo");
    const summary = card.createSpan({ cls: "ad-card__hint" });
    this.cardHead(card, "◎", this.t("待办 · 今天要处理", "To-do · Today"), void 0, summary);
    const addRow = card.createDiv({ cls: "ad-kb__addrow" });
    const input = addRow.createEl("input", { cls: "ad-kb__input", attr: { placeholder: this.t("快速添加待办，回车确认…", "Quick add, Enter to confirm…") } });
    const addBtn = addRow.createEl("button", { cls: "ad-kb__addbtn", text: this.t("添加", "Add") });
    const submit = () => {
      const text = input.value.trim();
      if (!text) return;
      void this.kanbanAdd(text);
      input.value = "";
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    addBtn.addEventListener("click", () => submit());
    const { board: kb, file } = await this.readKanbanBoard();
    if (!file) {
      card.createDiv({ cls: "ad-kb__empty", text: this.t("未找到 Kanban 文件「", 'Kanban file "') + this.plugin.settings.kanbanFile + this.t("」，请在设置中配置", '" not found, configure in settings') });
      return;
    }
    const all = kb.tasks;
    const pending = all.filter((t) => !t.done);
    const done = all.filter((t) => t.done);
    summary.textContent = pending.length ? pending.length + this.t(" 项待办", " pending") : this.t("今日已清空", "All cleared today");
    const body = card.createDiv({ cls: "ad-kb__body" });
    const list = body.createDiv({ cls: "ad-kb" });
    if (pending.length === 0) {
      list.createDiv({ cls: "ad-kb__empty", text: this.t("今日待办已全部完成", "All done for today") });
    } else {
      for (const t of pending) this.renderKanbanRow(list, t);
    }
    if (done.length) {
      const doneBlock = body.createDiv({ cls: "ad-kb__done" });
      const doneHead = doneBlock.createDiv({ cls: "ad-kb__donehead" });
      const caret = doneHead.createSpan({ cls: "ad-kb__caret", text: "▸" });
      doneHead.createSpan({ text: `已完成 ${done.length}` });
      const doneList = doneBlock.createDiv({ cls: "ad-kb__donelist is-collapsed" });
      for (const t of done) this.renderKanbanRow(doneList, t);
      doneHead.addEventListener("click", () => {
        doneList.classList.toggle("is-collapsed");
        caret.textContent = doneList.classList.contains("is-collapsed") ? "▸" : "▾";
      });
    }
  }
  /** 单行待办：勾选圆点 + 内容（双击快速编辑） */

  renderKanbanRow(list, task) {
    const row = list.createDiv({ cls: "ad-kb__row" + (task.done ? " is-done" : "") });
    const check = row.createSpan({ cls: "ad-kb__check" });
    check.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.toggleKanban(task, !task.done);
    });
    row.createSpan({ cls: "ad-kb__text", text: task.content });
    row.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this.openKanbanEditor(task);
    });
    row.addEventListener("contextmenu", (e) => this.openKanbanMenu(e, task));
    attachTouchMenu(row, (e) => this.openKanbanMenu(e, task));
  }
  /** 双击快速编辑：弹出输入框修改内容，写回 Kanban 文件 */

  openKanbanEditor(task) {
    new KanbanEditModal(this.app, task.content, (text) => {
      void this.kanbanEdit(task, text);
    }).open();
  }
  /** 编辑待办内容（写回 Kanban 文件，触发自动刷新） */

  async kanbanEdit(task, text) {
    const { board, file } = await this.readKanbanBoard();
    if (!file) return;
    const next = editKanbanTask(board.rawLines.join("\n"), task, text);
    if (next !== null) await this.app.vault.modify(file, next);
  }
  /** 切换任务完成状态（写回 Kanban 文件，触发自动刷新） */

  async toggleKanban(task, done) {
    const { board, file } = await this.readKanbanBoard();
    if (!file) return;
    const next = toggleKanbanTask(board.rawLines.join("\n"), task, done, todayStr());
    if (next !== null) await this.app.vault.modify(file, next);
  }
  /** 快速添加：写入 Kanban 文件第一个列 */

  async kanbanAdd(text) {
    var _a2;
    const { board, file } = await this.readKanbanBoard();
    if (!file) {
      this.showToast(this.t("未找到 Kanban 文件，请在设置中配置", "Kanban file not found, configure in settings"), "error");
      return;
    }
    const target = (_a2 = board.columns[0]) == null ? void 0 : _a2.title;
    if (!target) {
      this.showToast(this.t("Kanban 文件缺少列（## 标题）", "Kanban file has no column (## heading)"), "error");
      return;
    }
    const next = addKanbanTask(board.rawLines.join("\n"), target, text);
    if (next === null) {
      this.showToast(this.t("添加失败", "Add failed"), "error");
      return;
    }
    await this.app.vault.modify(file, next);
  }
  /** 删除任务（写回 Kanban 文件） */

  async kanbanRemove(task) {
    const { board, file } = await this.readKanbanBoard();
    if (!file) return;
    const next = removeKanbanTask(board.rawLines.join("\n"), task);
    if (next !== null) await this.app.vault.modify(file, next);
  }
  /**
   * 移动端适配：触摸设备上「长按 500ms」触发右键菜单（桌面端保留原生 contextmenu）。
   * 实现见 src/views/touchMenu.ts（共享工具）。
   */
  /** 待办行右键菜单：完成/待办切换、删除 */

  openKanbanMenu(e, task) {
    e.preventDefault();
    e.stopPropagation();
    const menu = new Menu();
    menu.addItem((item) => item.setTitle(task.done ? this.t("标记为待办", "Mark as to-do") : this.t("标记为完成", "Mark as done")).setIcon(task.done ? "circle" : "check-circle").onClick(() => void this.toggleKanban(task, !task.done)));
    menu.addItem((item) => item.setTitle(this.t("删除", "Delete")).setIcon("trash").onClick(() => void this.kanbanRemove(task)));
    menu.showAtMouseEvent(e);
  }
  /* ============================================================
     天气（wttr.in，免 key）
     ============================================================ */
  /** 拉取指定城市天气，带 10 分钟缓存 */

  async fetchWeather(city) {
    var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    if (this.weatherCache && this.weatherCache.city === city && Date.now() - this.weatherCache.at < 10 * 60 * 1e3) {
      return this.weatherCache.data;
    }
    try {
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=zh`;
      const res = await requestUrl({ url, method: "GET", headers: { Accept: "application/json" } });
      if (res.status !== 200) return null;
      const j = res.json;
      const cur = (_a2 = j == null ? void 0 : j.current_condition) == null ? void 0 : _a2[0];
      const today = (_b = j == null ? void 0 : j.weather) == null ? void 0 : _b[0];
      if (!cur) return null;
      const code = String((_c = cur["weatherCode"]) != null ? _c : "");
      const descArr = cur["weatherDesc"];
      const meta = (_f = WEATHER_CODE[code]) != null ? _f : { icon: "☁", zh: String((_e = (_d = descArr == null ? void 0 : descArr[0]) == null ? void 0 : _d.value) != null ? _e : "天气") };
      const data = {
        temp: String((_g = cur["temp_C"]) != null ? _g : ""),
        desc: this.plugin.settings.language === 'en' ? (WEATHER_EN[meta.zh] ?? meta.zh) : meta.zh,
        icon: meta.icon,
        hi: String((_h = today == null ? void 0 : today["maxtempC"]) != null ? _h : ""),
        lo: String((_i = today == null ? void 0 : today["mintempC"]) != null ? _i : ""),
        humidity: String((_j = cur["humidity"]) != null ? _j : ""),
        updated: nowFmt().slice(11)
      };
      this.weatherCache = { city, at: Date.now(), data };
      return data;
    } catch (err) {
      console.error("[Dashboard] weather fetch failed", err);
      return null;
    }
  }
  /** 天气卡渲染：当前时间实时显示 + 多城市（最多 3 个）天气块 */

  async renderWeather(board) {
    var _a2, _b;
    const card = this.getOrCreateCard(board, "ad-card ad-b-weather");
    const cities = ((_b = (_a2 = this.plugin.settings.weather) == null ? void 0 : _a2.cities) != null ? _b : []).filter(Boolean).slice(0, 3);
    const list = cities.length ? cities : ["日照"];
    this.cardHead(card, "☀", this.t("天气", "Weather"));
    const body = card.createDiv({ cls: "ad-wx" });
    const clock = body.createDiv({ cls: "ad-wx__clock" });
    const renderClock = () => {
      const n = /* @__PURE__ */ new Date();
      const p = (x) => String(x).padStart(2, "0");
      clock.textContent = `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
    };
    renderClock();
    if (this.wxTimer !== null) window.clearInterval(this.wxTimer);
    this.wxTimer = window.setInterval(renderClock, 1e3);
    for (const city of list) {
      const block = body.createDiv({ cls: "ad-wx__city" });
      const head = block.createDiv({ cls: "ad-wx__cityhead" });
      head.createSpan({ cls: "ad-wx__cityname", text: city });
      const refreshBtn = head.createSpan({ cls: "ad-wx__refresh", text: "↻" });
      refreshBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.weatherCache = null;
        this.refreshWeatherCard();
      });
      const content = block.createDiv({ cls: "ad-wx__content" });
      content.createDiv({ cls: "ad-wx__loading", text: this.t("获取中…", "Loading…") });
      const data = await this.fetchWeather(city);
      content.empty();
      if (!data) {
        content.createDiv({ cls: "ad-wx__err", text: this.t("获取失败（网络/城市名）", "Failed (network / city name)") });
        continue;
      }
      const main = content.createDiv({ cls: "ad-wx__main" });
      main.createSpan({ cls: "ad-wx__icon", text: data.icon });
      main.createSpan({ cls: "ad-wx__temp", text: `${data.temp}°` });
      main.createSpan({ cls: "ad-wx__desc", text: data.desc });
      const sub = content.createDiv({ cls: "ad-wx__sub" });
      if (data.lo || data.hi) sub.createSpan({ text: `低 ${data.lo}° / 高 ${data.hi}°` });
      if (data.humidity) sub.createSpan({ text: `湿度 ${data.humidity}%` });
      sub.createSpan({ cls: "ad-wx__time", text: this.t("更新 ", "Updated ") + data.updated });
    }
  }
  /** 重建天气卡（仅首页） */

  refreshWeatherCard() {
    if (this.currentPage !== "home" || !this.boardEl) return;
    void this.renderWeather(this.boardEl);
  }
  /* ============================================================
     日历（月历视图，复用农历函数）
     ============================================================ */
  /** 日历卡渲染 */

  renderCalendar(board) {
    const card = this.getOrCreateCard(board, "ad-card ad-b-calendar");
    const now = /* @__PURE__ */ new Date();
    if (this.calYear === 0) {
      this.calYear = now.getFullYear();
      this.calMonth = now.getMonth();
    }
    this.cardHead(card, "◈", this.t("日历", "Calendar"));
    this.renderCalendarBody(card);
  }
  /** 重建月历主体（切换月份时仅重建网格，保留卡壳与标题） */

  renderCalendarBody(card) {
    card.querySelectorAll(".ad-cal").forEach((el) => el.remove());
    const body = card.createDiv({ cls: "ad-cal" });
    const head = body.createDiv({ cls: "ad-cal__head" });
    const prev = head.createEl("button", { cls: "ad-cal__nav", text: "‹" });
    const label = head.createSpan({ cls: "ad-cal__label", text: this.plugin.settings.language === 'en' ? (this.calMonth + 1) + " / " + this.calYear : this.calYear + " 年 " + (this.calMonth + 1) + " 月" });
    const next = head.createEl("button", { cls: "ad-cal__nav", text: "›" });
    prev.addEventListener("click", () => {
      this.shiftCalendarMonth(-1);
      this.renderCalendarBody(card);
    });
    next.addEventListener("click", () => {
      this.shiftCalendarMonth(1);
      this.renderCalendarBody(card);
    });
    const grid = body.createDiv({ cls: "ad-cal__grid" });
    (this.plugin.settings.language === 'en' ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] : ["日", "一", "二", "三", "四", "五", "六"]).forEach((d) => grid.createDiv({ cls: "ad-cal__dow", text: d }));
    const y = this.calYear, m = this.calMonth;
    const startDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = /* @__PURE__ */ new Date();
    for (let i = 0; i < startDow; i++) grid.createDiv({ cls: "ad-cal__cell is-blank" });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m, d);
      const isToday = y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
      const cell = grid.createDiv({ cls: "ad-cal__cell" + (isToday ? " is-today" : "") });
      cell.createDiv({ cls: "ad-cal__day", text: String(d) });
      if (this.plugin.settings.language !== 'en') cell.createDiv({ cls: "ad-cal__lunar", text: getLunarDate(dt) });
    }
  }

  shiftCalendarMonth(delta) {
    let m = this.calMonth + delta;
    let y = this.calYear;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    this.calMonth = m;
    this.calYear = y;
  }
  /* ============================================================
     网站收藏（点击在浏览器打开）
     ============================================================ */
  /** 网站收藏卡渲染：搜索框 + 按分类分组展示 + 添加（弹窗） */

  async renderSites(board) {
    const card = this.getOrCreateCard(board, "ad-card ad-b-sites");
    this.cardHead(card, "◈", this.t("网站收藏", "Bookmarks"));
    const body = card.createDiv({ cls: "ad-sites" });
    const sites = await this.readSitesFile();
    const tool = body.createDiv({ cls: "ad-sites__tool" });
    const search = tool.createEl("input", { cls: "ad-sites__search", attr: { placeholder: this.t("搜索站点（名称/网址/关键词）…", "Search sites (name / URL / keyword)…") } });
    const addBtn = tool.createEl("button", { cls: "ad-sites__addbtn", text: "＋" });
    addBtn.setAttribute("aria-label", this.t("添加站点", "Add site"));
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openSiteEditor();
    });
    const suggest = tool.createDiv({ cls: "ad-sites__suggest" });
    const list = body.createDiv({ cls: "ad-sites__list" });
    const render = () => {
      list.empty();
      const q = search.value.trim().toLowerCase();
      const filtered = sites.filter((s) => {
        if (!q) return true;
        return [s.name, s.url, s.category ?? "", s.keywords ?? ""].join(" ").toLowerCase().includes(q);
      });
      if (filtered.length === 0) {
        list.createDiv({ cls: "ad-sites__empty", text: sites.length ? this.t("没有匹配的站点", "No matching sites") : this.t("还没有收藏站点，点 ＋ 添加", "No bookmarks yet, tap ＋ to add") });
        return;
      }
      const groups = /* @__PURE__ */ new Map();
      for (const s of filtered) {
        const cat = s.category && s.category.trim() ? s.category.trim() : this.t("未分类", "Uncategorized");
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat).push(s);
      }
      for (const [cat, items] of groups) {
        const collapsed = this.sitesCollapsed.has(cat);
        const group = list.createDiv({ cls: "ad-sites__group" + (collapsed ? " is-collapsed" : "") });
        const catEl = group.createDiv({ cls: "ad-sites__cat", text: cat });
        catEl.setAttribute("title", collapsed ? this.t("点击展开", "Expand") : this.t("点击折叠", "Collapse"));
        catEl.addEventListener("click", () => {
          if (this.sitesCollapsed.has(cat)) this.sitesCollapsed.delete(cat);
          else this.sitesCollapsed.add(cat);
          render();
        });
        if (!collapsed) {
          for (const s of items) this.renderSiteRow(group, s, sites.indexOf(s));
        }
      }
    };
    // 搜索联想补全：输入时下拉显示匹配站点，点击 / 回车 / ↑↓ 选择后补全到搜索框
    let suggestTimer = null;
    let sgIndex = -1;
    const closeSuggest = () => {
      suggest.removeClass("is-open");
      suggest.empty();
      sgIndex = -1;
    };
    const renderSuggest = () => {
      suggest.empty();
      const q = search.value.trim().toLowerCase();
      if (!q) { suggest.removeClass("is-open"); return; }
      const hits = sites.filter((s) => [s.name, s.url, s.category ?? "", s.keywords ?? ""].join(" ").toLowerCase().includes(q)).slice(0, 8);
      if (!hits.length) { suggest.removeClass("is-open"); return; }
      suggest.addClass("is-open");
      hits.forEach((s) => {
        const item = suggest.createDiv({ cls: "ad-sites__sg" });
        item.createSpan({ cls: "ad-sites__sg-icon", text: s.icon || "◈" });
        item.createSpan({ cls: "ad-sites__sg-name", text: s.name || s.url });
        if (s.category) item.createSpan({ cls: "ad-sites__sg-cat", text: s.category });
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
          search.value = s.name || s.url;
          search.dispatchEvent(new Event("input"));
          closeSuggest();
          search.focus();
        });
      });
    };
    search.addEventListener("input", () => {
      render();
      if (suggestTimer !== null) window.clearTimeout(suggestTimer);
      suggestTimer = window.setTimeout(renderSuggest, 120);
    });
    search.addEventListener("keydown", (e) => {
      const items = suggest.querySelectorAll(".ad-sites__sg");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!items.length) return;
        e.preventDefault();
        sgIndex = e.key === "ArrowDown" ? (sgIndex + 1) % items.length : (sgIndex - 1 + items.length) % items.length;
        items.forEach((el, i) => el.toggleClass("is-active", i === sgIndex));
      } else if (e.key === "Enter" && sgIndex >= 0 && items[sgIndex]) {
        e.preventDefault();
        const active = items[sgIndex];
        const name = active.querySelector(".ad-sites__sg-name")?.textContent ?? "";
        search.value = name.trim();
        search.dispatchEvent(new Event("input"));
        closeSuggest();
      } else if (e.key === "Escape") {
        closeSuggest();
      }
    });
    search.addEventListener("blur", () => {
      window.setTimeout(closeSuggest, 150);
    });
    render();
  }
  /** 单个站点行：图标（emoji 或 favicon）+ 名称，点击打开 */

  renderSiteRow(group, site, index) {
    const tile = group.createDiv({ cls: "ad-sites__tile" });
    tile.setAttribute("title", site.url);
    // 图标：取展示名首字符（中文首字 / 英文大写首字母），不再使用 emoji / favicon
    const display = (site.name && site.name.trim()) ? site.name.trim() : site.url;
    const first = display ? String(display).charAt(0).toUpperCase() : "◆";
    tile.createDiv({ cls: "ad-sites__tile-icon", text: first });
    tile.createDiv({ cls: "ad-sites__tile-name", text: display });
    tile.addEventListener("click", () => window.open(site.url, "_blank", "noopener"));
    tile.addEventListener("contextmenu", (e) => this.openSiteMenu(e, index));
    attachTouchMenu(tile, (e) => this.openSiteMenu(e, index));
  }
  /** 新增 / 编辑站点弹窗；保存后写回 settings 并刷新 */

  openSiteEditor(existing?, index = -1) {
    new SiteEditModal(this.app, existing != null ? existing : {}, async (data) => {
      const entry = {
        name: data.name,
        url: data.url,
        category: data.category || void 0,
        keywords: data.keywords || void 0
      };
      const oldUrl = existing ? existing.url : void 0;
      await this.writeSiteMd((content) => {
        if (!oldUrl) {
          const sites = parseSitesMd(content).map((p) => p.site);
          if (sites.some((s) => s.url === entry.url)) {
            this.showToast(this.t("该站点已在收藏中", "This site is already bookmarked"));
            return null;
          }
          return upsertSiteLine(content, entry);
        }
        if (oldUrl === entry.url) return upsertSiteLine(content, entry);
        let cur = removeSiteLine(content, oldUrl);
        if (cur == null) cur = content;
        return upsertSiteLine(cur, entry);
      });
    }).open();
  }

  hostOf(url) {
    try {
      return new URL(url).host;
    } catch (e) {
      return url;
    }
  }
  /** 站点右键菜单：打开 / 编辑 / 上移 / 下移 / 移除 */

  openSiteMenu(e, index) {
    e.preventDefault();
    e.stopPropagation();
    const menu = new Menu();
    menu.addItem((item) => item.setTitle(this.t("打开", "Open")).setIcon("globe").onClick(() => void this.openSiteAt(index)));
    menu.addItem((item) => item.setTitle(this.t("编辑", "Edit")).setIcon("pencil").onClick(() => void this.editSiteAt(index)));
    menu.addItem((item) => item.setTitle(this.t("上移", "Move up")).onClick(() => void this.moveSite(index, -1)));
    menu.addItem((item) => item.setTitle(this.t("下移", "Move down")).onClick(() => void this.moveSite(index, 1)));
    menu.addItem((item) => item.setTitle(this.t("移除", "Remove")).setIcon("trash").onClick(() => void this.removeSite(index)));
    menu.showAtMouseEvent(e);
  }

  /** 打开网站收藏列表中的第 index 条 */
  async openSiteAt(index) {
    const sites = await this.readSitesFile();
    const site = sites[index];
    if (site) window.open(site.url, "_blank", "noopener");
  }
  /** 编辑网站收藏列表中的第 index 条 */
  async editSiteAt(index) {
    const sites = await this.readSitesFile();
    const site = sites[index];
    if (site) this.openSiteEditor(site, index);
  }

  async moveSite(index, delta) {
    const sites = await this.readSitesFile();
    const site = sites[index];
    if (!site) return;
    await this.writeSiteMd((content) => moveSiteLine(content, site.url, delta));
  }

  async removeSite(index) {
    const sites = await this.readSitesFile();
    const site = sites[index];
    if (!site) return;
    await this.writeSiteMd((content) => removeSiteLine(content, site.url));
  }
  /** 重建网站收藏卡（仅首页） */

  refreshSitesCard() {
    if (this.currentPage !== "home" || !this.boardEl) return;
    void this.renderSites(this.boardEl);
  }
  /* ---- Shared card header ---- */

  cardHead(card, icon, title, hint?, hintEl?) {
    const head = card.createDiv({ cls: "ad-card__head" });
    const h3 = head.createEl("h3", { cls: "ad-card__title" });
    h3.createSpan({ cls: "ad-marker", text: icon });
    h3.appendText(title);
    if (hintEl) head.appendChild(hintEl);
    else if (hint) head.createSpan({ cls: "ad-card__hint", text: hint });
  }
}