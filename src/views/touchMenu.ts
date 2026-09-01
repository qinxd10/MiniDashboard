/**
 * 移动端适配工具：触摸设备上「长按 500ms」触发右键菜单。
 * 桌面端保留原生 contextmenu（此函数自动跳过非触摸设备）。
 * - 长按期间移动 >10px 视为滚动而取消；
 * - 触发后拦截一次 click，避免同时触发点击行为（如打开链接）。
 */

export function attachTouchMenu(el: HTMLElement, onMenu: (e: PointerEvent) => void): void {
	if (!window.matchMedia('(hover: none)').matches) return;
	let timer: number | null = null;
	let sx = 0;
	let sy = 0;
	const cancel = (): void => { if (timer !== null) { window.clearTimeout(timer); timer = null; } };
	el.addEventListener('pointerdown', (e) => {
		if (e.pointerType !== 'touch') return;
		sx = e.clientX; sy = e.clientY;
		cancel();
		timer = window.setTimeout(() => {
			timer = null;
			const block = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
			el.addEventListener('click', block, { capture: true, once: true });
			onMenu(e);
		}, 500);
	});
	el.addEventListener('pointermove', (e) => {
		if (timer !== null && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) cancel();
	});
	el.addEventListener('pointerup', cancel);
	el.addEventListener('pointercancel', cancel);
	el.addEventListener('pointerleave', cancel);
}
