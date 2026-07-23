import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { FundedEvent } from '$lib/meta';
import { parseFundedEvents } from '$lib/parseFunded';
import type { Actions, PageServerLoad } from './$types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const load: PageServerLoad = async ({ platform }) => {
	const rows = await db(platform)
		.prepare('SELECT * FROM funded_events ORDER BY event_date, organization, id')
		.all();
	return { events: rows.results as unknown as FundedEvent[] };
};

export const actions: Actions = {
	importEvents: async ({ request, platform }) => {
		const d = await request.formData();
		const text = String(d.get('text') ?? '');
		const parsed = parseFundedEvents(text);
		if (!parsed.length) return fail(400, { error: 'Couldn’t find any events in that paste.' });

		const d1 = db(platform);
		// Skip rows already in the table so re-pasting an email doesn't duplicate.
		const existing = await d1
			.prepare('SELECT organization, description, event_date FROM funded_events')
			.all<{ organization: string; description: string; event_date: string }>();
		const seen = new Set(existing.results.map((e) => `${e.organization}|${e.description}|${e.event_date}`));
		const fresh = parsed.filter((e) => !seen.has(`${e.organization}|${e.description}|${e.event_date}`));

		if (fresh.length) {
			const now = new Date().toISOString();
			await d1.batch(
				fresh.map((e) =>
					d1
						.prepare('INSERT INTO funded_events (organization, description, event_date, created_at) VALUES (?1,?2,?3,?4)')
						.bind(e.organization, e.description, e.event_date, now)
				)
			);
		}
		return { ok: true, imported: fresh.length, skipped: parsed.length - fresh.length };
	},

	addEvent: async ({ request, platform }) => {
		const d = await request.formData();
		const organization = String(d.get('organization') ?? '').trim();
		const description = String(d.get('description') ?? '').trim();
		const event_date = String(d.get('event_date') ?? '').trim();
		if (!organization || !description) return fail(400, { error: 'Organization and event are required.' });
		if (!DATE_RE.test(event_date)) return fail(400, { error: 'Date must be YYYY-MM-DD.' });
		await db(platform)
			.prepare('INSERT INTO funded_events (organization, description, event_date, created_at) VALUES (?1,?2,?3,?4)')
			.bind(organization, description, event_date, new Date().toISOString())
			.run();
		return { ok: true };
	},

	toggleApproved: async ({ request, platform }) => {
		const d = await request.formData();
		const eventId = Number(d.get('id'));
		if (!Number.isInteger(eventId) || eventId <= 0) return fail(400, { error: 'Bad id.' });
		await db(platform)
			.prepare('UPDATE funded_events SET approved = 1 - approved WHERE id = ?1')
			.bind(eventId)
			.run();
		return { ok: true };
	},

	deleteEvent: async ({ request, platform }) => {
		const d = await request.formData();
		const eventId = Number(d.get('id'));
		if (!Number.isInteger(eventId) || eventId <= 0) return fail(400, { error: 'Bad id.' });
		await db(platform).prepare('DELETE FROM funded_events WHERE id = ?1').bind(eventId).run();
		return { ok: true };
	}
};
