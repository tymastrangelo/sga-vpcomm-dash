// All date strings are YYYY-MM-DD. "Today" means America/New_York (Elon time),
// regardless of where the server runs (Cloudflare = UTC).

export function todayET(): string {
	// en-CA locale formats as YYYY-MM-DD
	return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function addDays(date: string, n: number): string {
	const d = new Date(date + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/**
 * Next due date after completing a recurring task.
 * - weekly: exactly 7 days later (keeps the same weekday as recur_anchor).
 * - monthly: same day-of-month next month, per recur_anchor, clamped to 28.
 *   The clamp-to-28 rule sidesteps month-length bugs entirely: day 1-28
 *   exists in every month, so "the 31st" can never silently skip February.
 */
export function nextDueDate(due: string, interval: string, anchor: string | null): string {
	if (interval === 'weekly') return addDays(due, 7);
	const [y, m] = due.split('-').map(Number);
	const day = Math.min(Number(anchor) || Number(due.slice(8)), 28);
	const ny = m === 12 ? y + 1 : y;
	const nm = m === 12 ? 1 : m + 1;
	return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Sunday-start grid range covering the given YYYY-MM month. */
export function monthGridRange(month: string): { start: string; end: string } {
	const first = month + '-01';
	const [y, m] = month.split('-').map(Number);
	const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month
	const last = `${month}-${String(lastDay).padStart(2, '0')}`;
	const start = addDays(first, -new Date(first + 'T00:00:00Z').getUTCDay());
	const end = addDays(last, 6 - new Date(last + 'T00:00:00Z').getUTCDay());
	return { start, end };
}

export function addMonths(month: string, n: number): string {
	const [y, m] = month.split('-').map(Number);
	const total = y * 12 + (m - 1) + n;
	return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

const FMT = new Intl.DateTimeFormat('en-US', {
	weekday: 'short',
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});

/** "Mon, Jul 20" (append year if not the current one) */
export function fmtDate(date: string, today = todayET()): string {
	const label = FMT.format(new Date(date + 'T00:00:00Z'));
	return date.slice(0, 4) === today.slice(0, 4) ? label : `${label}, ${date.slice(0, 4)}`;
}

/** "3:30 PM" from "15:30" */
export function fmtTime(time: string): string {
	const [h, min] = time.split(':').map(Number);
	const ampm = h >= 12 ? 'PM' : 'AM';
	return `${((h + 11) % 12) + 1}:${String(min).padStart(2, '0')} ${ampm}`;
}
