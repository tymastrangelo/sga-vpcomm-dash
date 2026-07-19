import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { todayET } from '$lib/dates';
import type { Project, Tag } from '$lib/meta';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const d1 = db(platform);
	const [rows, tags] = await Promise.all([
		d1
			.prepare(
				`SELECT p.*, COUNT(c.id) AS item_count,
					MIN(CASE WHEN c.post_date >= ?1 THEN c.post_date END) AS next_date
				FROM projects p
				LEFT JOIN content_items c ON c.project_id = p.id
				GROUP BY p.id
				ORDER BY p.name`
			)
			.bind(todayET())
			.all(),
		d1.prepare('SELECT * FROM tags ORDER BY id').all()
	]);
	return {
		projects: rows.results as unknown as (Project & { item_count: number; next_date: string | null })[],
		tags: tags.results as unknown as Tag[]
	};
};

export const actions: Actions = {
	createProject: async ({ request, platform }) => {
		const d = await request.formData();
		const name = String(d.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Name is required.' });
		const description = String(d.get('description') ?? '').trim() || null;
		const color = String(d.get('color') ?? '').trim() || '#73000a';
		await db(platform)
			.prepare('INSERT INTO projects (name, description, color, created_at) VALUES (?1,?2,?3,?4)')
			.bind(name, description, color, new Date().toISOString())
			.run();
		return { ok: true };
	}
};
