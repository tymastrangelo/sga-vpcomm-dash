import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { ContentItem, Project, Tag } from '$lib/meta';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, params }) => {
	const d1 = db(platform);
	const projectId = Number(params.id);
	if (!Number.isInteger(projectId)) error(404, 'Not found');

	const [project, items, projects, tags] = await Promise.all([
		d1.prepare('SELECT * FROM projects WHERE id = ?1').bind(projectId).first<Project>(),
		d1
			.prepare(
				`SELECT c.*, p.name AS project_name, p.color AS project_color
				FROM content_items c LEFT JOIN projects p ON p.id = c.project_id
				WHERE c.project_id = ?1
				ORDER BY c.post_date IS NULL, c.post_date, c.post_time, c.id`
			)
			.bind(projectId)
			.all(),
		d1.prepare('SELECT * FROM projects ORDER BY name').all(),
		d1.prepare('SELECT * FROM tags ORDER BY id').all()
	]);

	if (!project) error(404, 'Project not found');

	return {
		project,
		items: items.results as unknown as ContentItem[],
		projects: projects.results as unknown as Project[],
		tags: tags.results as unknown as Tag[]
	};
};

export const actions: Actions = {
	updateProject: async ({ request, platform, params }) => {
		const d = await request.formData();
		const name = String(d.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Name is required.' });
		const description = String(d.get('description') ?? '').trim() || null;
		const color = String(d.get('color') ?? '').trim() || '#73000a';
		await db(platform)
			.prepare('UPDATE projects SET name=?2, description=?3, color=?4 WHERE id=?1')
			.bind(Number(params.id), name, description, color)
			.run();
		return { ok: true };
	},

	// mode=cascade deletes the project's items too; mode=keep detaches them
	// (FK is ON DELETE SET NULL, so keeping is just deleting the project row).
	deleteProject: async ({ request, platform, params }) => {
		const d = await request.formData();
		const mode = String(d.get('mode') ?? 'keep');
		const d1 = db(platform);
		const projectId = Number(params.id);
		if (mode === 'cascade') {
			await d1.prepare('DELETE FROM content_items WHERE project_id = ?1').bind(projectId).run();
		}
		await d1.prepare('DELETE FROM projects WHERE id = ?1').bind(projectId).run();
		redirect(303, '/projects');
	}
};
