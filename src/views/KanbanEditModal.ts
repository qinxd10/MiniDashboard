import { App, Modal } from 'obsidian';

/** 待办快速编辑弹窗：双击条目打开，修改内容后保存写回 Kanban 文件 */
export class KanbanEditModal extends Modal {
	/** 按当前语言返回中 / 英文案 */
	private t(zh: string, en: string): string {
		return (this.app as any).plugins?.plugins?.['dashboard-private']?.settings?.language === 'en' ? en : zh;
	}

	constructor(
		app: App,
		private current: string,
		private onConfirm: (text: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass('ad-modal');
		contentEl.createEl('h3', { cls: 'ad-modal-title', text: this.t('编辑待办', 'Edit To-do') });

		const input = contentEl.createEl('input', {
			cls: 'ad-modal-input',
			type: 'text',
			value: this.current,
			attr: { placeholder: this.t('待办内容…', 'To-do content…') },
		});
		input.select();

		const btns = contentEl.createDiv({ cls: 'ad-modal-btns' });
		const cancelBtn = btns.createEl('button', { cls: 'ad-modal-btn', text: this.t('取消', 'Cancel') });
		const saveBtn = btns.createEl('button', { cls: 'ad-modal-btn ad-modal-btn--primary', text: this.t('保存', 'Save') });
		const submit = () => {
			const text = input.value.trim();
			if (!text) return;
			this.onConfirm(text);
			this.close();
		};
		cancelBtn.addEventListener('click', () => this.close());
		saveBtn.addEventListener('click', submit);
		input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
