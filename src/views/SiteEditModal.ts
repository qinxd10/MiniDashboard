import { App, Modal } from 'obsidian';
import type { FavoriteSite } from '../settings';

/** 网站收藏新增/编辑表单数据 */
export interface SiteFormData {
	name: string;
	url: string;
	category: string;
	keywords: string;
}

/** 网站收藏 新增/编辑 弹窗：名称 / 网址 / 分类 / 关键词 */
export class SiteEditModal extends Modal {
	private form!: SiteFormData;
	private onConfirm: (data: SiteFormData) => void;

	/** 按当前语言返回中 / 英文案 */
	private t(zh: string, en: string): string {
		return (this.app as any).plugins?.plugins?.['dashboard-private']?.settings?.language === 'en' ? en : zh;
	}

	constructor(app: App, initial: Partial<FavoriteSite>, onConfirm: (data: SiteFormData) => void) {
		super(app);
		this.onConfirm = onConfirm;
		this.form = {
			name: initial.name ?? '',
			url: initial.url ?? '',
			category: initial.category ?? '',
			keywords: initial.keywords ?? '',
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass('ad-modal');
		contentEl.createEl('h3', { cls: 'ad-modal-title', text: this.form.name ? this.t('编辑站点', 'Edit Site') : this.t('添加站点', 'Add Site') });

		const fields: Array<[keyof SiteFormData, string, string]> = [
			['name', this.t('站点名称', 'Site name'), this.t('如 腾讯云（留空则显示链接）', 'e.g. Tencent Cloud (empty shows the link)')],
			['url', this.t('网址 URL', 'URL'), 'https://…'],
			['category', this.t('分类', 'Category'), this.t('如 工具 / 工作 / 资讯（留空归「未分类」）', 'e.g. Tools / Work / News (empty = Uncategorized)')],
			['keywords', this.t('关键词', 'Keywords'), this.t('逗号分隔，用于搜索，如 云, 服务器', 'Comma separated, for search, e.g. cloud, server')],
		];
		const inputs: Record<string, HTMLInputElement> = {};
		for (const [key, label, ph] of fields) {
			const field = contentEl.createDiv({ cls: 'ad-modal-field' });
			field.createEl('label', { cls: 'ad-modal-label', text: label });
			const input = field.createEl('input', { cls: 'ad-modal-input', type: 'text', value: this.form[key] });
			input.placeholder = ph;
			inputs[key] = input;
		}

		const btns = contentEl.createDiv({ cls: 'ad-modal-btns' });
		const cancelBtn = btns.createEl('button', { cls: 'ad-modal-btn', text: this.t('取消', 'Cancel') });
		const saveBtn = btns.createEl('button', { cls: 'ad-modal-btn ad-modal-btn--primary', text: this.t('保存', 'Save') });
		const submit = () => {
			const rawUrl = inputs['url'].value.trim();
			if (!rawUrl) return;
			this.onConfirm({
				name: inputs['name'].value.trim(),
				url: /^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl,
				category: inputs['category'].value.trim(),
				keywords: inputs['keywords'].value.trim(),
			});
			this.close();
		};
		cancelBtn.addEventListener('click', () => this.close());
		saveBtn.addEventListener('click', submit);
		inputs['url'].addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
		inputs['name'].focus();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
