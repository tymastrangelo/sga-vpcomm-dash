import { error, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import {
	FB_BASE, IG_BASE, IgError, loadConfig, refreshToken, setSetting, syncInstagram, verifyCredentials
} from '$lib/server/instagram';
import { todayET, addDays } from '$lib/dates';
import { MOCK_COOKIE } from '$lib/instagram';
import { mockAudience, mockDays, mockMedia, mockProfile } from '$lib/mockInstagram';
import type { AudienceRow, IgDay, IgMedia, IgProfile, IgSyncRun } from '$lib/instagram';
import type { Actions, PageServerLoad } from './$types';

const RANGES = [7, 30, 90, 365] as const;

export const load: PageServerLoad = async ({ platform, url, cookies }) => {
	const to = todayET();
	const requested = Number(url.searchParams.get('range'));
	const range = (RANGES as readonly number[]).includes(requested) ? requested : 30;
	const from = addDays(to, -(range - 1));
	// Pull the preceding window in the same queries so every tile can show a
	// like-for-like change instead of a bare number.
	const prevFrom = addDays(from, -range);

	// Demo mode short-circuits before touching D1 or the API, so it works with
	// no account connected and can't accidentally spend the sync's call budget.
	if (cookies.get(MOCK_COOKIE) === '1') {
		return {
			connected: true, mock: true, range, from, to, prevFrom, apiBase: FB_BASE,
			profile: mockProfile(to),
			days: mockDays(prevFrom, to),
			media: mockMedia(prevFrom, to, to),
			audience: mockAudience(),
			lastSync: null, pending: 0, cachedMedia: null, envConfigured: false
		};
	}

	const d1 = db(platform);

	try {
		const cfg = await loadConfig(d1, env);

		if (!cfg) {
			return {
				connected: false, mock: false, range, from, to, prevFrom, profile: null, days: [], media: [],
				audience: [], lastSync: null, pending: 0, cachedMedia: 0, apiBase: FB_BASE,
				envConfigured: Boolean(env.IG_ACCESS_TOKEN && env.IG_USER_ID)
			};
		}

		const [profileRow, days, media, audience, lastSync, pending, cached] = await Promise.all([
			d1.prepare("SELECT value FROM app_settings WHERE key = 'ig_profile'").first<{ value: string }>(),
			d1.prepare('SELECT * FROM ig_day WHERE date >= ?1 AND date <= ?2 ORDER BY date').bind(prevFrom, to).all(),
			d1.prepare('SELECT * FROM ig_media WHERE posted_date >= ?1 AND posted_date <= ?2 ORDER BY timestamp DESC').bind(prevFrom, to).all(),
			d1.prepare('SELECT breakdown, bucket, value FROM ig_audience ORDER BY value DESC').all(),
			d1.prepare('SELECT * FROM ig_sync ORDER BY id DESC LIMIT 1').first<IgSyncRun>(),
			d1.prepare('SELECT COUNT(*) AS n FROM ig_media WHERE insights_at IS NULL').first<{ n: number }>(),
			d1.prepare("SELECT COUNT(*) AS n FROM ig_media WHERE format != 'story'").first<{ n: number }>()
		]);

		let profile: IgProfile | null = null;
		try {
			profile = profileRow ? (JSON.parse(profileRow.value) as IgProfile) : null;
		} catch {
			profile = null;
		}

		return {
			connected: true,
			mock: false,
			range, from, to, prevFrom,
			apiBase: cfg.base,
			profile,
			days: days.results as unknown as IgDay[],
			media: media.results as unknown as IgMedia[],
			audience: audience.results as unknown as AudienceRow[],
			lastSync: lastSync ?? null,
			pending: pending?.n ?? 0,
			cachedMedia: cached?.n ?? 0,
			envConfigured: Boolean(env.IG_ACCESS_TOKEN && env.IG_USER_ID)
		};
	} catch (e) {
		// The Instagram tables arrive in migration 004. Until it has been applied to
		// whichever database is bound — and dev binds the live one — say so plainly
		// rather than surfacing a raw "no such table" stack trace.
		if (/no such table: (ig_|app_settings)/.test(e instanceof Error ? e.message : String(e)))
			error(
				503,
				'Instagram tables are missing. Apply migrations/004-instagram.sql to this database (npx wrangler d1 execute sga-calendar-db --remote --file=./migrations/004-instagram.sql).'
			);
		throw e;
	}
};

export const actions: Actions = {
	connect: async ({ request, platform }) => {
		const d = await request.formData();
		const token = String(d.get('token') ?? '').trim();
		const userId = String(d.get('user_id') ?? '').trim();
		const base = String(d.get('base') ?? FB_BASE) === IG_BASE ? IG_BASE : FB_BASE;
		if (!token || !userId) return fail(400, { error: 'Access token and Instagram account ID are both required.' });
		if (!/^\d+$/.test(userId)) return fail(400, { error: 'The Instagram account ID should be all digits.' });

		try {
			// Prove the credentials work before storing them — a saved-but-broken
			// token turns every later screen into a mystery error.
			const profile = await verifyCredentials({ token, userId, base });
			const d1 = db(platform);
			await setSetting(d1, 'ig_access_token', token);
			await setSetting(d1, 'ig_user_id', userId);
			await setSetting(d1, 'ig_api_base', base);
			await setSetting(d1, 'ig_profile', JSON.stringify(profile));
			return { ok: true, connected: `@${profile.username ?? userId}` };
		} catch (e) {
			return fail(400, { error: e instanceof IgError ? e.message : 'Could not reach the Instagram API.' });
		}
	},

	sync: async ({ request, platform, cookies }) => {
		if (cookies.get(MOCK_COOKIE) === '1')
			return fail(400, { error: 'Demo data is on — turn it off in Settings before syncing.' });
		const d1 = db(platform);
		const cfg = await loadConfig(d1, env);
		if (!cfg) return fail(400, { error: 'Connect an Instagram account first.' });
		const d = await request.formData();
		const days = Math.min(730, Math.max(7, Number(d.get('days')) || 90));
		const result = await syncInstagram(d1, cfg, { days });
		if (!result.ok) return fail(502, { error: result.message, needsReauth: result.needsReauth });
		return { ok: true, synced: result.message, pending: result.mediaPending };
	},

	/**
	 * One-off full import: the entire post history plus a re-read of account
	 * metrics. Resumable — anything the call budget or the request clock can't
	 * reach stays pending and the next run continues from there.
	 */
	importAll: async ({ platform, cookies }) => {
		if (cookies.get(MOCK_COOKIE) === '1')
			return fail(400, { error: 'Demo data is on — turn it off in Settings before importing.' });
		const d1 = db(platform);
		const cfg = await loadConfig(d1, env);
		if (!cfg) return fail(400, { error: 'Connect an Instagram account first.' });
		const result = await syncInstagram(d1, cfg, { days: 365, full: true, freshFor: 0 });
		if (!result.ok) return fail(502, { error: result.message, needsReauth: result.needsReauth });
		return { ok: true, synced: result.message, pending: result.mediaPending };
	},

	refreshToken: async ({ platform }) => {
		const d1 = db(platform);
		const cfg = await loadConfig(d1, env);
		if (!cfg) return fail(400, { error: 'Connect an Instagram account first.' });
		try {
			await refreshToken(d1, cfg);
			return { ok: true, tokenRefreshed: true };
		} catch (e) {
			return fail(400, { error: e instanceof IgError ? e.message : 'Token refresh failed.' });
		}
	},

	disconnect: async ({ platform }) => {
		await db(platform)
			.prepare("DELETE FROM app_settings WHERE key IN ('ig_access_token','ig_user_id','ig_api_base','ig_profile','ig_token_refreshed_at')")
			.run();
		return { ok: true, disconnected: true };
	}
};
