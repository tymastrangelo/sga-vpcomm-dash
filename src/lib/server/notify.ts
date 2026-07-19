// Daily ntfy digest: what to post + what's due, straight from D1.
// Relative imports only — this file is shared with the standalone
// notifier Worker (notifier/index.ts), which is not a SvelteKit app.
import type { D1Database } from '@cloudflare/workers-types';
import { addDays, fmtDate, fmtTime } from '../dates';
import { PLATFORMS, STATUSES, type ContentItem, type Task } from '../meta';

const MAX_PER_SECTION = 15;

function lines<T>(items: T[], render: (item: T) => string): string[] {
	const out = items.slice(0, MAX_PER_SECTION).map(render);
	if (items.length > MAX_PER_SECTION) out.push(`…and ${items.length - MAX_PER_SECTION} more`);
	return out;
}

function contentLine(c: ContentItem): string {
	const p = PLATFORMS[c.platform] ?? PLATFORMS.other;
	const time = c.post_time ? `${fmtTime(c.post_time)} — ` : '';
	const project = c.project_name ? ` (${c.project_name})` : '';
	return `• ${time}${p.label}: ${c.title}${project} [${(STATUSES[c.status] ?? STATUSES.idea).label}]`;
}

function taskLine(t: Task): string {
	return `• ${t.is_recurring ? '↻ ' : ''}${t.title}`;
}

export interface Digest {
	title: string;
	body: string;
	priority: number;
}

export async function buildDigest(d1: D1Database, today: string): Promise<Digest> {
	const tomorrow = addDays(today, 1);
	const contentSelect = `SELECT c.*, p.name AS project_name, p.color AS project_color
		FROM content_items c LEFT JOIN projects p ON p.id = c.project_id`;

	const [todayContent, todayTasks, overdue, tomorrowContent] = await Promise.all([
		d1.prepare(`${contentSelect} WHERE c.post_date = ?1 ORDER BY c.post_time IS NULL, c.post_time, c.id`).bind(today).all(),
		d1.prepare('SELECT * FROM tasks WHERE due_date = ?1 AND done = 0 ORDER BY id').bind(today).all(),
		d1.prepare('SELECT * FROM tasks WHERE due_date < ?1 AND done = 0 ORDER BY due_date, id').bind(today).all(),
		d1.prepare(`${contentSelect} WHERE c.post_date = ?1 ORDER BY c.post_time IS NULL, c.post_time, c.id`).bind(tomorrow).all()
	]);

	const content = todayContent.results as unknown as ContentItem[];
	const tasks = todayTasks.results as unknown as Task[];
	const late = overdue.results as unknown as Task[];
	const preview = tomorrowContent.results as unknown as ContentItem[];

	const sections: string[] = [];
	if (content.length) sections.push(['📣 To post today:', ...lines(content, contentLine)].join('\n'));
	if (tasks.length) sections.push(['✅ Due today:', ...lines(tasks, taskLine)].join('\n'));
	if (late.length)
		sections.push(
			[`⚠️ Overdue (${late.length}):`, ...lines(late, (t) => `• ${t.title} — was due ${fmtDate(t.due_date!, today)}`)].join('\n')
		);
	if (preview.length)
		sections.push(
			[`👀 Tomorrow (${preview.length}):`, ...lines(preview, (c) => `• ${(PLATFORMS[c.platform] ?? PLATFORMS.other).label}: ${c.title}`)].join('\n')
		);

	const counts: string[] = [];
	if (content.length) counts.push(`${content.length} post${content.length === 1 ? '' : 's'}`);
	if (tasks.length) counts.push(`${tasks.length} task${tasks.length === 1 ? '' : 's'}`);
	if (late.length) counts.push(`${late.length} overdue`);

	return {
		title: counts.length ? `SGA Comms — ${counts.join(' · ')}` : 'SGA Comms — all clear',
		body: sections.length ? sections.join('\n\n').slice(0, 3800) : 'Nothing scheduled or due today. 🎉',
		// high priority when something actually has to go out today
		priority: content.length || late.length ? 4 : 3
	};
}

export async function sendNtfy(topic: string, digest: Digest): Promise<void> {
	if (!topic) throw new Error('NTFY_TOPIC is not set');
	// JSON publishing (POST to the root, topic in the body) — plain header-based
	// publishing chokes on non-Latin-1 characters like em dashes and emoji.
	const res = await fetch('https://ntfy.sh', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			topic,
			title: digest.title,
			message: digest.body,
			priority: digest.priority,
			tags: ['calendar']
		})
	});
	if (!res.ok) throw new Error(`ntfy responded ${res.status}: ${await res.text()}`);
}
