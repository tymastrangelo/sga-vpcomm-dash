import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { monthGridRange, nextDueDate, todayET } from '$lib/dates';
import { PLATFORMS, STATUSES, type ContentItem, type Link, type Project, type Tag, type Task } from '$lib/meta';
import type { Actions, PageServerLoad } from './$types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function str(d: FormData, k: string): string | null {
	const v = d.get(k);
	const s = typeof v === 'string' ? v.trim() : '';
	return s === '' ? null : s;
}

function id(d: FormData): number | null {
	const n = Number(d.get('id'));
	return Number.isInteger(n) && n > 0 ? n : null;
}

export const load: PageServerLoad = async ({ platform, url }) => {
	const today = todayET();
	const monthParam = url.searchParams.get('month') ?? '';
	const month = MONTH_RE.test(monthParam) ? monthParam : today.slice(0, 7);
	const { start, end } = monthGridRange(month);
	const d1 = db(platform);

	const contentSelect = `SELECT c.*, p.name AS project_name, p.color AS project_color
		FROM content_items c LEFT JOIN projects p ON p.id = c.project_id`;

	const [tasks, content, undatedContent, noDate, overdue, completed, projects, tags, links] =
		await Promise.all([
			d1.prepare('SELECT * FROM tasks WHERE due_date BETWEEN ?1 AND ?2 ORDER BY due_date, id').bind(start, end).all(),
			d1.prepare(`${contentSelect} WHERE c.post_date BETWEEN ?1 AND ?2 ORDER BY c.post_date, c.post_time, c.id`).bind(start, end).all(),
			d1.prepare(`${contentSelect} WHERE c.post_date IS NULL ORDER BY c.id`).all(),
			d1.prepare('SELECT * FROM tasks WHERE due_date IS NULL AND done = 0 ORDER BY sort_order, id DESC').all(),
			d1.prepare('SELECT * FROM tasks WHERE due_date < ?1 AND done = 0 ORDER BY due_date, id').bind(today).all(),
			d1.prepare('SELECT * FROM tasks WHERE done = 1 ORDER BY done_at DESC LIMIT 100').all(),
			d1.prepare('SELECT * FROM projects ORDER BY name').all(),
			d1.prepare('SELECT * FROM tags ORDER BY id').all(),
			d1.prepare('SELECT * FROM links ORDER BY id').all()
		]);

	return {
		today,
		month,
		gridStart: start,
		gridEnd: end,
		tasks: tasks.results as unknown as Task[],
		content: content.results as unknown as ContentItem[],
		undatedContent: undatedContent.results as unknown as ContentItem[],
		noDate: noDate.results as unknown as Task[],
		overdue: overdue.results as unknown as Task[],
		completed: completed.results as unknown as Task[],
		projects: projects.results as unknown as Project[],
		tags: tags.results as unknown as Tag[],
		links: links.results as unknown as Link[]
	};
};

type FieldResult<T> = { ok: false; error: string } | { ok: true; fields: T };

function taskFields(d: FormData): FieldResult<{
	title: string;
	notes: string | null;
	due_date: string | null;
	is_recurring: number;
	recur_interval: string | null;
	recur_anchor: string | null;
	color: string | null;
}> {
	const title = str(d, 'title');
	if (!title) return { ok: false, error: 'Title is required.' };
	const due_date = str(d, 'due_date');
	if (due_date && !DATE_RE.test(due_date)) return { ok: false, error: 'Date must be YYYY-MM-DD.' };
	const recur = str(d, 'recur_interval');
	if (recur && recur !== 'weekly' && recur !== 'monthly') return { ok: false, error: 'Bad recurrence.' };
	if (recur && !due_date) return { ok: false, error: 'A recurring task needs a due date.' };

	// Anchor is derived from the chosen due date, not typed by hand:
	// weekly → that date's weekday (0-6); monthly → that day-of-month clamped to 28.
	let recur_anchor: string | null = null;
	if (recur === 'weekly') recur_anchor = String(new Date(due_date + 'T00:00:00Z').getUTCDay());
	if (recur === 'monthly') recur_anchor = String(Math.min(Number(due_date!.slice(8)), 28));

	return {
		ok: true,
		fields: {
			title,
			notes: str(d, 'notes'),
			due_date,
			is_recurring: recur ? 1 : 0,
			recur_interval: recur,
			recur_anchor,
			color: str(d, 'color')
		}
	};
}

function contentFields(d: FormData): FieldResult<{
	title: string;
	notes: string | null;
	post_date: string | null;
	post_time: string | null;
	platform: string;
	status: string;
	project_id: number | null;
}> {
	const title = str(d, 'title');
	if (!title) return { ok: false, error: 'Title is required.' };
	const post_date = str(d, 'post_date');
	if (post_date && !DATE_RE.test(post_date)) return { ok: false, error: 'Date must be YYYY-MM-DD.' };
	const post_time = str(d, 'post_time');
	if (post_time && !TIME_RE.test(post_time)) return { ok: false, error: 'Time must be HH:MM.' };
	const platform = str(d, 'platform') ?? 'other';
	if (!(platform in PLATFORMS)) return { ok: false, error: 'Unknown platform.' };
	const status = str(d, 'status') ?? 'idea';
	if (!(status in STATUSES)) return { ok: false, error: 'Unknown status.' };
	const rawProject = str(d, 'project_id');
	const project_id = rawProject ? Number(rawProject) : null;
	if (project_id !== null && !Number.isInteger(project_id)) return { ok: false, error: 'Bad project.' };
	return { ok: true, fields: { title, notes: str(d, 'notes'), post_date, post_time, platform, status, project_id } };
}

export const actions: Actions = {
	createTask: async ({ request, platform }) => {
		const d = await request.formData();
		const r = taskFields(d);
		if (!r.ok) return fail(400, { error: r.error });
		const f = r.fields;
		await db(platform)
			.prepare(
				'INSERT INTO tasks (title, notes, due_date, is_recurring, recur_interval, recur_anchor, color, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)'
			)
			.bind(f.title, f.notes, f.due_date, f.is_recurring, f.recur_interval, f.recur_anchor, f.color, new Date().toISOString())
			.run();
		return { ok: true };
	},

	updateTask: async ({ request, platform }) => {
		const d = await request.formData();
		const taskId = id(d);
		if (!taskId) return fail(400, { error: 'Bad id.' });
		const r = taskFields(d);
		if (!r.ok) return fail(400, { error: r.error });
		const f = r.fields;
		await db(platform)
			.prepare(
				'UPDATE tasks SET title=?2, notes=?3, due_date=?4, is_recurring=?5, recur_interval=?6, recur_anchor=?7, color=?8 WHERE id=?1'
			)
			.bind(taskId, f.title, f.notes, f.due_date, f.is_recurring, f.recur_interval, f.recur_anchor, f.color)
			.run();
		return { ok: true };
	},

	// Marking a recurring task done spawns the next occurrence (§7 of the build manual).
	// The completed row stays (history); a fresh row is inserted at the next date.
	toggleTask: async ({ request, platform }) => {
		const d = await request.formData();
		const taskId = id(d);
		if (!taskId) return fail(400, { error: 'Bad id.' });
		const d1 = db(platform);
		const task = await d1.prepare('SELECT * FROM tasks WHERE id = ?1').bind(taskId).first<Task>();
		if (!task) return fail(404, { error: 'Task not found.' });

		if (task.done) {
			await d1.prepare('UPDATE tasks SET done = 0, done_at = NULL WHERE id = ?1').bind(taskId).run();
			return { ok: true };
		}

		const now = new Date().toISOString();
		await d1.prepare('UPDATE tasks SET done = 1, done_at = ?2 WHERE id = ?1').bind(taskId, now).run();

		if (task.is_recurring && task.recur_interval && task.due_date) {
			const next = nextDueDate(task.due_date, task.recur_interval, task.recur_anchor);
			await d1
				.prepare(
					'INSERT INTO tasks (title, notes, due_date, is_recurring, recur_interval, recur_anchor, color, created_at) VALUES (?1,?2,?3,1,?4,?5,?6,?7)'
				)
				.bind(task.title, task.notes, next, task.recur_interval, task.recur_anchor, task.color, now)
				.run();
		}
		return { ok: true };
	},

	deleteTask: async ({ request, platform }) => {
		const d = await request.formData();
		const taskId = id(d);
		if (!taskId) return fail(400, { error: 'Bad id.' });
		await db(platform).prepare('DELETE FROM tasks WHERE id = ?1').bind(taskId).run();
		return { ok: true };
	},

	createContent: async ({ request, platform }) => {
		const d = await request.formData();
		const r = contentFields(d);
		if (!r.ok) return fail(400, { error: r.error });
		const f = r.fields;
		await db(platform)
			.prepare(
				'INSERT INTO content_items (project_id, title, notes, post_date, post_time, platform, status, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)'
			)
			.bind(f.project_id, f.title, f.notes, f.post_date, f.post_time, f.platform, f.status, new Date().toISOString())
			.run();
		return { ok: true };
	},

	updateContent: async ({ request, platform }) => {
		const d = await request.formData();
		const itemId = id(d);
		if (!itemId) return fail(400, { error: 'Bad id.' });
		const r = contentFields(d);
		if (!r.ok) return fail(400, { error: r.error });
		const f = r.fields;
		await db(platform)
			.prepare(
				'UPDATE content_items SET project_id=?2, title=?3, notes=?4, post_date=?5, post_time=?6, platform=?7, status=?8 WHERE id=?1'
			)
			.bind(itemId, f.project_id, f.title, f.notes, f.post_date, f.post_time, f.platform, f.status)
			.run();
		return { ok: true };
	},

	deleteContent: async ({ request, platform }) => {
		const d = await request.formData();
		const itemId = id(d);
		if (!itemId) return fail(400, { error: 'Bad id.' });
		await db(platform).prepare('DELETE FROM content_items WHERE id = ?1').bind(itemId).run();
		return { ok: true };
	},

	// Persist the sidebar drag order: ids arrive as "3,7,1" in the desired top-to-bottom order.
	reorderTasks: async ({ request, platform }) => {
		const d = await request.formData();
		const ids = String(d.get('ids') ?? '')
			.split(',')
			.map(Number)
			.filter((n) => Number.isInteger(n) && n > 0);
		if (!ids.length) return fail(400, { error: 'No ids.' });
		const d1 = db(platform);
		await d1.batch(
			ids.map((taskId, i) => d1.prepare('UPDATE tasks SET sort_order = ?2 WHERE id = ?1').bind(taskId, i))
		);
		return { ok: true };
	},

	createLink: async ({ request, platform }) => {
		const d = await request.formData();
		const title = String(d.get('title') ?? '').trim();
		let url = String(d.get('url') ?? '').trim();
		if (!title || !url) return fail(400, { error: 'Title and URL are required.' });
		if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
		try {
			new URL(url);
		} catch {
			return fail(400, { error: 'That URL doesn’t look valid.' });
		}
		await db(platform)
			.prepare('INSERT INTO links (title, url, created_at) VALUES (?1,?2,?3)')
			.bind(title, url, new Date().toISOString())
			.run();
		return { ok: true };
	},

	deleteLink: async ({ request, platform }) => {
		const d = await request.formData();
		const linkId = id(d);
		if (!linkId) return fail(400, { error: 'Bad id.' });
		await db(platform).prepare('DELETE FROM links WHERE id = ?1').bind(linkId).run();
		return { ok: true };
	}
};
