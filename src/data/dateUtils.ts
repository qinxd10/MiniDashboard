/* ============================================================
   纯日期工具（无 Obsidian 依赖，可 node:test 单测）
   ============================================================ */

/** YYYY-MM-DD from a Date. */
export function fmtDate(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today as YYYY-MM-DD. */
export function todayStr(today: Date = new Date()): string {
	return fmtDate(today);
}

/** Current datetime as YYYY-MM-DD HH:mm (precise to minute). */
export function nowFmt(today: Date = new Date()): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())} ${p(today.getHours())}:${p(today.getMinutes())}`;
}
