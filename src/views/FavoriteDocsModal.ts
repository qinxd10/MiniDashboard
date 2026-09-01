import { App, Modal, TFile } from 'obsidian';

/** 选中的一条常用文档 */
export interface FavoriteDocPick {
	path: string;
	title: string;
}

/**
 * FavoriteDocsModal — 从库中选择文档加入首页「常用文档」卡片。
 * 列出库内全部 Markdown 文件，支持按文件名/路径搜索、多选；
 * 已在常用文档中的项会以勾选 + 置灰标记（不可重复添加）。
 */
export class FavoriteDocsModal extends Modal {
	private files: TFile[];
	private existing: Set<string>;
	private picked: Set<string>;
	private searchEl: HTMLInputElement;
	private listEl: HTMLElement;
	private onConfirm: (docs: FavoriteDocPick[]) => void;

	/** 按当前语言返回中 / 英文案 */
	private t(zh: string, en: string): string {
		return (this.app as any).plugins?.plugins?.['dashboard-private']?.settings?.language === 'en' ? en : zh;
	}

	constructor(app: App, existingPaths: string[], onConfirm: (docs: FavoriteDocPick[]) => void) {
		super(app);
		this.files = app.vault
			.getFiles()
			.filter((f) => f.extension === 'md')
			.sort((a, b) => a.path.localeCompare(b.path));
		this.existing = new Set(existingPaths);
		this.picked = new Set<string>();
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass('ad-modal');

		contentEl.createEl('h3', { cls: 'ad-modal-title', text: this.t('添加常用文档', 'Add Favorites') });

		this.searchEl = contentEl.createEl('input', {
			cls: 'ad-modal-input ad-fav-search',
			type: 'text',
			attr: { placeholder: this.t('搜索文件名或路径…', 'Search file name or path…') },
		});
		this.searchEl.addEventListener('input', () => this.renderList());

		this.listEl = contentEl.createDiv({ cls: 'ad-fav-list' });
		contentEl.createDiv({ cls: 'ad-modal-hint', text: this.t('勾选一个或多个文档，点击「添加」即可固定到首页常用文档卡片。', 'Check one or more files and click Add to pin them to the home Favorites card.') });

		const btns = contentEl.createDiv({ cls: 'ad-modal-btns' });
		const cancelBtn = btns.createEl('button', { cls: 'ad-modal-btn', text: this.t('取消', 'Cancel') });
		const addBtn = btns.createEl('button', { cls: 'ad-modal-btn ad-modal-btn--primary', text: this.t('添加', 'Add') });
		cancelBtn.addEventListener('click', () => this.close());
		addBtn.addEventListener('click', () => {
			const docs = this.files
				.filter((f) => this.picked.has(f.path))
				.map((f) => ({ path: f.path, title: f.basename }));
			if (docs.length) this.onConfirm(docs);
			this.close();
		});

		this.renderList();
		this.searchEl.focus();
	}

	private renderList(): void {
		const q = this.searchEl.value.trim().toLowerCase();
		this.listEl.empty();
		for (const f of this.files) {
			if (q && !f.path.toLowerCase().includes(q) && !f.basename.toLowerCase().includes(q)) continue;
			const already = this.existing.has(f.path);
			const row = this.listEl.createDiv({ cls: 'ad-fav-item' + (already ? ' is-added' : '') });
			const cb = row.createEl('input', { type: 'checkbox' });
			cb.checked = already || this.picked.has(f.path);
			cb.disabled = already;
			cb.addEventListener('change', () => {
				if (cb.checked) this.picked.add(f.path);
				else this.picked.delete(f.path);
			});
			row.createSpan({ cls: 'ad-fav-name', text: f.basename });
			const parent = f.parent && f.parent.path !== '/' ? f.parent.path : '/';
			row.createSpan({ cls: 'ad-fav-path', text: parent });
			if (already) row.createSpan({ cls: 'ad-fav-tag', text: this.t('已添加', 'Added') });
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
