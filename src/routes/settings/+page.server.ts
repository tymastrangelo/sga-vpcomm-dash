import { fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { buildDigest, sendNtfy } from '$lib/server/notify';
import { todayET } from '$lib/dates';
import type { Tag } from '$lib/meta';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const tags = await db(platform).prepare('SELECT * FROM tags ORDER BY id').all();
	return {
		tags: tags.results as unknown as Tag[],
		ntfyTopic: env.NTFY_TOPIC ?? ''
	};
};

export const actions: Actions = {
	createTag: async ({ request, platform }) => {
		const d = await request.formData();
		const label = String(d.get('label') ?? '').trim();
		if (!label) return fail(400, { error: 'Label is required.' });
		const color = String(d.get('color') ?? '').trim() || '#475569';
		const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
		if (!key) return fail(400, { error: 'Label needs at least one letter or number.' });
		try {
			await db(platform)
				.prepare('INSERT INTO tags (key, label, color) VALUES (?1,?2,?3)')
				.bind(key, label, color)
				.run();
		} catch {
			return fail(400, { error: 'A tag with that name already exists.' });
		}
		return { ok: true };
	},

	sendTestNotification: async ({ platform }) => {
		try {
			const digest = await buildDigest(db(platform), todayET());
			await sendNtfy(env.NTFY_TOPIC ?? '', digest);
			return { sent: true };
		} catch (e) {
			return fail(500, { notifyError: e instanceof Error ? e.message : 'Failed to send.' });
		}
	}
};
