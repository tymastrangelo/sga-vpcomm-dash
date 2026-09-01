// Instagram Graph API client + sync.
//
// Works against either login path Meta offers, because the endpoint shapes are
// the same and only the host differs:
//   • Instagram API with Facebook Login   → graph.facebook.com   (adds Story insights)
//   • Instagram API with Instagram Login  → graph.instagram.com  (no Facebook Page needed)
//
// Everything the API returns is stored: the columns we chart, plus the whole
// response in metrics_json so a post's detail view is complete whatever its format.
//
// Relative imports only — this file is shared with the standalone notifier
// Worker (notifier/index.ts), which is not a SvelteKit app.

import type { D1Database } from '@cloudflare/workers-types';
import { FB_BASE, IG_BASE, formatOf, type IgFormat } from '../instagram.ts';

export const API_VERSION = 'v25.0';
export { FB_BASE, IG_BASE };

export interface IgConfig {
	token: string;
	userId: string;
	base: string;
}

export class IgError extends Error {
	// Plain fields rather than constructor parameter properties: scripts/ runs
	// these modules through Node's type-stripping, which rejects those.
	code?: number;
	subcode?: number;

	constructor(message: string, code?: number, subcode?: number) {
		super(message);
		this.name = 'IgError';
		this.code = code;
		this.subcode = subcode;
	}

	/** An expired/revoked token needs a human, not a retry. */
	get needsReauth(): boolean {
		return this.code === 190 || this.code === 102 || this.subcode === 463;
	}
}

// ------------------------------------------------------------- settings ----
export async function getSetting(d1: D1Database, key: string): Promise<string | null> {
	const row = await d1.prepare('SELECT value FROM app_settings WHERE key = ?1').bind(key).first<{ value: string }>();
	return row?.value ?? null;
}

export async function setSetting(d1: D1Database, key: string, value: string): Promise<void> {
	await d1
		.prepare(
			`INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
		)
		.bind(key, value, new Date().toISOString())
		.run();
}

/**
 * Credentials live in D1 rather than env vars so the token can be pasted (and
 * later auto-refreshed) without a redeploy. Env vars still win as a bootstrap.
 */
export async function loadConfig(
	d1: D1Database,
	env: Record<string, string | undefined> = {}
): Promise<IgConfig | null> {
	const [token, userId, base] = await Promise.all([
		getSetting(d1, 'ig_access_token'),
		getSetting(d1, 'ig_user_id'),
		getSetting(d1, 'ig_api_base')
	]);
	const t = token || env.IG_ACCESS_TOKEN || '';
	const u = userId || env.IG_USER_ID || '';
	if (!t || !u) return null;
	return { token: t, userId: u, base: base || env.IG_API_BASE || FB_BASE };
}

// ------------------------------------------------------------ transport ----
interface CallBudget {
	remaining: number;
	used: number;
}

function url(cfg: IgConfig, path: string, params: Record<string, string | number | undefined>): string {
	const u = new URL(`${cfg.base}/${API_VERSION}/${path.replace(/^\//, '')}`);
	for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, String(v));
	u.searchParams.set('access_token', cfg.token);
	return u.toString();
}

function throwApiError(body: unknown): never {
	const err = (body as { error?: { message?: string; code?: number; error_subcode?: number } })?.error;
	throw new IgError(err?.message ?? 'Instagram API request failed.', err?.code, err?.error_subcode);
}

async function get<T>(cfg: IgConfig, path: string, params: Record<string, string | number | undefined>, budget: CallBudget): Promise<T> {
	if (budget.remaining <= 0) throw new IgError('Call budget for this sync is used up.');
	budget.remaining--;
	budget.used++;
	const res = await fetch(url(cfg, path, params), { headers: { accept: 'application/json' } });
	const body = await res.json().catch(() => null);
	if (!res.ok || (body as { error?: unknown })?.error) throwApiError(body);
	return body as T;
}

/**
 * Fan out many independent GETs.
 *
 * graph.facebook.com takes up to 50 sub-requests in one HTTP call, which matters
 * twice over: it keeps us inside Cloudflare's per-request subrequest cap, and it
 * counts as one call against Meta's rate limit instead of fifty. graph.instagram.com
 * has no batch endpoint, so there we just run a small number in parallel — hence
 * the tighter budget the caller passes for that host.
 */
async function getMany<T>(
	cfg: IgConfig,
	reqs: { key: string; path: string; params: Record<string, string | number | undefined> }[],
	budget: CallBudget
): Promise<Map<string, T | IgError>> {
	const out = new Map<string, T | IgError>();
	if (!reqs.length) return out;

	if (cfg.base === FB_BASE) {
		for (let i = 0; i < reqs.length; i += 50) {
			if (budget.remaining <= 0) break;
			const chunk = reqs.slice(i, i + 50);
			budget.remaining--;
			budget.used++;
			const relative = chunk.map((r) => {
				const q = new URLSearchParams();
				for (const [k, v] of Object.entries(r.params)) if (v !== undefined) q.set(k, String(v));
				return { method: 'GET', relative_url: `${API_VERSION}/${r.path.replace(/^\//, '')}?${q}` };
			});
			const res = await fetch(`${cfg.base}/${API_VERSION}/`, {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					access_token: cfg.token,
					include_headers: 'false',
					batch: JSON.stringify(relative)
				})
			});
			const body = await res.json().catch(() => null);
			// A failure of the batch envelope itself (bad token, throttling) is fatal.
			if (!res.ok || (body as { error?: unknown })?.error) throwApiError(body);
			(body as ({ code: number; body: string } | null)[]).forEach((part, j) => {
				const key = chunk[j].key;
				if (!part) return out.set(key, new IgError('No response for this item.'));
				try {
					const parsed = JSON.parse(part.body);
					if (part.code >= 400 || parsed?.error) {
						const e = parsed?.error ?? {};
						out.set(key, new IgError(e.message ?? `HTTP ${part.code}`, e.code, e.error_subcode));
					} else out.set(key, parsed as T);
				} catch {
					out.set(key, new IgError('Unreadable response.'));
				}
			});
		}
		return out;
	}

	const CONCURRENCY = 4;
	for (let i = 0; i < reqs.length; i += CONCURRENCY) {
		if (budget.remaining <= 0) break;
		const chunk = reqs.slice(i, i + CONCURRENCY);
		const settled = await Promise.all(
			chunk.map((r) => get<T>(cfg, r.path, r.params, budget).catch((e) => (e instanceof IgError ? e : new IgError(String(e)))))
		);
		// A dead token fails every item identically — stop rather than burn the budget.
		const fatal = settled.find((s): s is IgError => s instanceof IgError && s.needsReauth);
		chunk.forEach((r, j) => out.set(r.key, settled[j]));
		if (fatal) throw fatal;
	}
	return out;
}

// -------------------------------------------------------------- parsing ----
/**
 * Insights come back in three shapes depending on the metric and API version:
 * `values: [{value}]`, `total_value: {value}`, and `total_value: {breakdowns:[…]}`.
 * Flatten all three to a number, keeping breakdowns as a nested record.
 */
export type MetricValue = number | Record<string, number>;

export function parseInsights(payload: unknown): Record<string, MetricValue> {
	const out: Record<string, MetricValue> = {};
	const data = (payload as { data?: unknown[] })?.data;
	if (!Array.isArray(data)) return out;

	for (const raw of data) {
		const m = raw as {
			name?: string;
			total_value?: { value?: number; breakdowns?: { results?: { dimension_values?: string[]; value?: number }[] }[] };
			values?: { value?: number }[];
		};
		if (!m.name) continue;
		const breakdowns = m.total_value?.breakdowns;
		if (breakdowns?.length) {
			const bucket: Record<string, number> = {};
			for (const b of breakdowns)
				for (const r of b.results ?? []) {
					const key = (r.dimension_values ?? []).join(' · ');
					if (key) bucket[key] = (bucket[key] ?? 0) + (r.value ?? 0);
				}
			out[m.name] = bucket;
			continue;
		}
		if (typeof m.total_value?.value === 'number') {
			out[m.name] = m.total_value.value;
			continue;
		}
		if (Array.isArray(m.values)) {
			const total = m.values.reduce((t, v) => t + (v.value ?? 0), 0);
			if (m.values.length) out[m.name] = total;
		}
	}
	return out;
}

const num = (v: MetricValue | undefined): number | null => (typeof v === 'number' ? v : null);

// -------------------------------------------------------------- metrics ----
// Requested per format. Meta rejects the whole request if one metric is invalid
// for that media, so each list has a CORE fallback that every format supports.
const MEDIA_METRICS: Record<IgFormat, string[]> = {
	image: ['reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'follows', 'profile_visits'],
	carousel: ['reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'follows', 'profile_visits'],
	reel: ['reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'],
	video: ['reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'],
	story: ['reach', 'views', 'replies', 'shares', 'total_interactions', 'follows', 'profile_visits', 'navigation', 'link_clicks']
};
const MEDIA_CORE = ['reach', 'views', 'total_interactions'];

const DAY_METRICS = [
	'views', 'reach', 'total_interactions', 'likes', 'comments',
	'shares', 'saves', 'replies', 'accounts_engaged', 'profile_links_taps'
];
const DAY_CORE = ['views', 'reach', 'total_interactions'];

const MEDIA_FIELDS =
	'id,media_type,media_product_type,caption,permalink,media_url,thumbnail_url,timestamp,like_count,comments_count,children{id}';
const PROFILE_FIELDS = 'id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count';

// --------------------------------------------------------------- helpers ---
const ET = 'America/New_York';
const ET_PARTS = new Intl.DateTimeFormat('en-US', {
	timeZone: ET, weekday: 'short', hour: 'numeric', hour12: false,
	year: 'numeric', month: '2-digit', day: '2-digit'
});
const DOW_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Post timestamps are UTC; the team thinks in Elon time, so bucket in ET. */
export function etParts(iso: string): { date: string; hour: number; dow: number } {
	const parts = Object.fromEntries(ET_PARTS.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
	return {
		date: `${parts.year}-${parts.month}-${parts.day}`,
		hour: Number(parts.hour) % 24,
		dow: DOW_INDEX[parts.weekday as string] ?? 0
	};
}

function todayET(): string {
	return new Date().toLocaleDateString('en-CA', { timeZone: ET });
}

function shiftDate(date: string, days: number): string {
	const d = new Date(date + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/** Unix seconds for midnight ET on a date — what since/until expect. */
export function etMidnight(date: string): number {
	const guess = Date.parse(date + 'T05:00:00Z'); // ET is UTC-5/-4
	const offset = new Date(guess).toLocaleString('en-US', { timeZone: ET, timeZoneName: 'longOffset' }).match(/GMT([+-]\d{2}):(\d{2})/);
	const hours = offset ? Number(offset[1]) : -5;
	return Math.floor(Date.parse(date + 'T00:00:00Z') / 1000) - hours * 3600;
}

// ----------------------------------------------------------------- sync ----
export interface SyncOptions {
	/** How far back to pull posts and backfill daily metrics. */
	days?: number;
	/** Hard ceiling on API calls; guards Meta's rate limit and CF's subrequest cap. */
	maxCalls?: number;
	/** Skip re-fetching insights for posts refreshed more recently than this (hours). */
	freshFor?: number;
	/**
	 * Import the entire back catalogue rather than the recent window, and re-read
	 * account metrics for days already stored. Used by the one-off full import;
	 * routine syncs leave settled history alone.
	 */
	full?: boolean;
}

export interface SyncResult {
	ok: boolean;
	mediaSeen: number;
	mediaRefreshed: number;
	mediaPending: number;
	daysSynced: number;
	calls: number;
	message: string;
	needsReauth: boolean;
}

export async function syncInstagram(d1: D1Database, cfg: IgConfig, opts: SyncOptions = {}): Promise<SyncResult> {
	const days = opts.days ?? 90;
	const freshFor = opts.freshFor ?? 12;
	// graph.instagram.com has no batch endpoint, so each call is its own
	// subrequest and the ceiling has to stay well under Cloudflare's.
	const budget: CallBudget = { remaining: opts.maxCalls ?? (cfg.base === FB_BASE ? 400 : 35), used: 0 };

	const started = new Date().toISOString();
	const run = await d1
		.prepare('INSERT INTO ig_sync (started_at) VALUES (?1) RETURNING id')
		.bind(started)
		.first<{ id: number }>();

	const result: SyncResult = {
		ok: false, mediaSeen: 0, mediaRefreshed: 0, mediaPending: 0,
		daysSynced: 0, calls: 0, message: '', needsReauth: false
	};

	try {
		const today = todayET();
		const since = shiftDate(today, -days);

		// 1. Profile — also today's follower/media snapshot.
		const profile = await get<Record<string, unknown>>(cfg, cfg.userId, { fields: PROFILE_FIELDS }, budget);
		await setSetting(d1, 'ig_profile', JSON.stringify(profile));

		// 2. Media list (paginated) + live stories.
		const media = await fetchMediaList(cfg, opts.full ? null : since, budget);
		const stories = await fetchStories(cfg, budget);
		const all = [...media, ...stories];
		result.mediaSeen = all.length;
		await upsertMedia(d1, all);

		// 3. Insights for whatever is new or stale, newest first.
		const { refreshed, pending } = await refreshInsights(d1, cfg, budget, freshFor);
		result.mediaRefreshed = refreshed;
		result.mediaPending = pending;

		// 4. Daily account metrics for days we don't have yet.
		result.daysSynced = await syncDays(d1, cfg, since, today, budget, Boolean(opts.full), {
			followers: profile.followers_count as number | undefined,
			follows: profile.follows_count as number | undefined,
			mediaCount: profile.media_count as number | undefined
		});

		// 5. Audience demographics (one snapshot, cheap, best-effort).
		await syncAudience(d1, cfg, budget);

		result.ok = true;
		result.message = `${result.mediaSeen} posts seen, ${refreshed} refreshed${pending ? `, ${pending} still pending` : ''}, ${result.daysSynced} days of account metrics.`;
	} catch (e) {
		const err = e instanceof IgError ? e : new IgError(e instanceof Error ? e.message : String(e));
		result.message = err.message;
		result.needsReauth = err.needsReauth;
	}

	result.calls = budget.used;
	if (run?.id) {
		await d1
			.prepare('UPDATE ig_sync SET finished_at=?1, ok=?2, media_seen=?3, media_refreshed=?4, days_synced=?5, calls=?6, message=?7 WHERE id=?8')
			.bind(new Date().toISOString(), result.ok ? 1 : 0, result.mediaSeen, result.mediaRefreshed, result.daysSynced, result.calls, result.message, run.id)
			.run();
	}
	return result;
}

interface RawMedia {
	id: string;
	media_type?: string;
	media_product_type?: string;
	caption?: string;
	permalink?: string;
	media_url?: string;
	thumbnail_url?: string;
	timestamp?: string;
	like_count?: number;
	comments_count?: number;
	children?: { data?: { id: string }[] };
}

/** `since = null` walks the whole history; otherwise it stops once past the cutoff. */
async function fetchMediaList(cfg: IgConfig, since: string | null, budget: CallBudget): Promise<RawMedia[]> {
	const out: RawMedia[] = [];
	const path = `${cfg.userId}/media`;
	let params: Record<string, string | number | undefined> = { fields: MEDIA_FIELDS, limit: 100 };
	// Bounded either way: 100 posts a page, so 40 pages is 4,000 posts.
	const maxPages = since === null ? 40 : 6;
	for (let page = 0; page < maxPages; page++) {
		const res = await get<{ data?: RawMedia[]; paging?: { cursors?: { after?: string } } }>(cfg, path, params, budget);
		const batch = res.data ?? [];
		out.push(...batch);
		const oldest = batch[batch.length - 1]?.timestamp;
		const after = res.paging?.cursors?.after;
		if (!after || !batch.length) break;
		if (since !== null && oldest && oldest.slice(0, 10) < since) break;
		params = { ...params, after };
	}
	return since === null ? out : out.filter((m) => !m.timestamp || m.timestamp.slice(0, 10) >= since);
}

/**
 * Stories only exist in the API for 24 hours, so this is the one thing the sync
 * genuinely cannot backfill — miss a night and that story's numbers are gone.
 * Not every token can read them (Instagram Login has no story insights), so a
 * failure here is logged, not fatal.
 */
async function fetchStories(cfg: IgConfig, budget: CallBudget): Promise<RawMedia[]> {
	try {
		const res = await get<{ data?: RawMedia[] }>(cfg, `${cfg.userId}/stories`, { fields: MEDIA_FIELDS, limit: 50 }, budget);
		return (res.data ?? []).map((m) => ({ ...m, media_product_type: 'STORY' }));
	} catch {
		return [];
	}
}

async function upsertMedia(d1: D1Database, rows: RawMedia[]): Promise<void> {
	if (!rows.length) return;
	const now = new Date().toISOString();
	const stmts = rows.map((m) => {
		const format = formatOf(m.media_type ?? null, m.media_product_type ?? null);
		const parts = m.timestamp ? etParts(m.timestamp) : null;
		return d1
			.prepare(
				`INSERT INTO ig_media (id, media_type, product_type, format, caption, permalink, media_url,
					thumbnail_url, timestamp, posted_date, posted_hour, posted_dow, children_count,
					like_count, comments_count, fetched_at)
				 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)
				 ON CONFLICT(id) DO UPDATE SET
					caption=excluded.caption, permalink=excluded.permalink, media_url=excluded.media_url,
					thumbnail_url=excluded.thumbnail_url, like_count=excluded.like_count,
					comments_count=excluded.comments_count, children_count=excluded.children_count,
					fetched_at=excluded.fetched_at`
			)
			.bind(
				m.id, m.media_type ?? null, m.media_product_type ?? null, format,
				m.caption ?? null, m.permalink ?? null, m.media_url ?? null, m.thumbnail_url ?? null,
				m.timestamp ?? null, parts?.date ?? null, parts?.hour ?? null, parts?.dow ?? null,
				m.children?.data?.length ?? 0, m.like_count ?? null, m.comments_count ?? null, now
			);
	});
	for (let i = 0; i < stmts.length; i += 20) await d1.batch(stmts.slice(i, i + 20));
}

/**
 * Refresh order is deliberate: never-fetched posts first, then the freshest
 * posts, because a week-old post's numbers have all but settled while yesterday's
 * are still moving. Whatever the budget can't reach stays pending for next run.
 */
async function refreshInsights(d1: D1Database, cfg: IgConfig, budget: CallBudget, freshFor: number): Promise<{ refreshed: number; pending: number }> {
	const cutoff = new Date(Date.now() - freshFor * 3600_000).toISOString();
	const stale = await d1
		.prepare(
			`SELECT id, format FROM ig_media
			 WHERE insights_at IS NULL OR insights_at < ?1
			 ORDER BY insights_at IS NOT NULL, timestamp DESC`
		)
		.bind(cutoff)
		.all<{ id: string; format: IgFormat }>();

	const rows = stale.results ?? [];
	// Leave headroom for the daily-metrics and demographics steps that follow.
	// Without batching the budget is tight, so hold back enough calls for the
	// daily-metrics step that follows — otherwise posts starve the account trend.
	const capacity = cfg.base === FB_BASE ? Math.max(0, budget.remaining - 3) * 50 : Math.max(0, budget.remaining - 14);
	const take = rows.slice(0, capacity);
	if (!take.length) return { refreshed: 0, pending: rows.length };

	const results = await getMany<unknown>(
		cfg,
		take.map((r) => ({ key: r.id, path: `${r.id}/insights`, params: { metric: MEDIA_METRICS[r.format].join(',') } })),
		budget
	);

	// One bad metric fails that whole media, so retry the failures on the core set
	// every format supports rather than losing the post's numbers entirely.
	const failed = take.filter((r) => !results.has(r.id) || results.get(r.id) instanceof IgError);
	if (failed.length) {
		const retry = await getMany<unknown>(
			cfg,
			failed.map((r) => ({ key: r.id, path: `${r.id}/insights`, params: { metric: MEDIA_CORE.join(',') } })),
			budget
		);
		for (const [k, v] of retry) if (!(v instanceof IgError)) results.set(k, v);
	}

	const now = new Date().toISOString();
	const stmts: ReturnType<D1Database['prepare']>[] = [];
	let refreshed = 0;
	for (const row of take) {
		const payload = results.get(row.id);
		if (!payload || payload instanceof IgError) continue;
		const m = parseInsights(payload);
		refreshed++;
		stmts.push(
			d1
				.prepare(
					`UPDATE ig_media SET reach=?2, views=?3, saved=?4, shares=?5, total_interactions=?6,
						follows=?7, profile_visits=?8, replies=?9, navigation=?10, link_clicks=?11, reposts=?12,
						avg_watch_time=?13, total_watch_time=?14, metrics_json=?15, insights_at=?16 WHERE id=?1`
				)
				.bind(
					row.id, num(m.reach), num(m.views), num(m.saved), num(m.shares), num(m.total_interactions),
					num(m.follows), num(m.profile_visits), num(m.replies), num(m.navigation), num(m.link_clicks),
					num(m.reposts), num(m.ig_reels_avg_watch_time), num(m.ig_reels_video_view_total_time),
					JSON.stringify(m), now
				)
		);
	}
	for (let i = 0; i < stmts.length; i += 20) await d1.batch(stmts.slice(i, i + 20));
	return { refreshed, pending: rows.length - refreshed };
}

/**
 * Account insights are per-day totals with no multi-day series (only `reach`
 * offers one), so each missing day is its own query. Today is always re-fetched
 * because it is still accumulating; earlier days are written once and left alone.
 */
async function syncDays(
	d1: D1Database, cfg: IgConfig, since: string, today: string, budget: CallBudget, full: boolean,
	snapshot: { followers?: number; follows?: number; mediaCount?: number }
): Promise<number> {
	const have = full
		? { results: [] }
		: await d1
				.prepare('SELECT date FROM ig_day WHERE date >= ?1 AND date < ?2 AND reach IS NOT NULL')
				.bind(since, today)
				.all<{ date: string }>();
	const known = new Set((have.results ?? []).map((r) => r.date));

	const wanted: string[] = [];
	for (let d = since; d <= today; d = shiftDate(d, 1)) if (d === today || !known.has(d)) wanted.push(d);

	const capacity = cfg.base === FB_BASE ? Math.max(0, budget.remaining - 2) * 25 : Math.max(0, budget.remaining - 2);
	const take = wanted.slice(-capacity); // newest days matter most
	if (!take.length) {
		await snapshotToday(d1, today, snapshot);
		return 0;
	}

	const totals = await getMany<unknown>(
		cfg,
		take.map((date) => ({
			key: date,
			path: `${cfg.userId}/insights`,
			params: { metric: DAY_METRICS.join(','), period: 'day', metric_type: 'total_value', since: etMidnight(date), until: etMidnight(shiftDate(date, 1)) }
		})),
		budget
	);
	const failed = take.filter((d) => !totals.has(d) || totals.get(d) instanceof IgError);
	if (failed.length) {
		const retry = await getMany<unknown>(
			cfg,
			failed.map((date) => ({
				key: date,
				path: `${cfg.userId}/insights`,
				params: { metric: DAY_CORE.join(','), period: 'day', metric_type: 'total_value', since: etMidnight(date), until: etMidnight(shiftDate(date, 1)) }
			})),
			budget
		);
		for (const [k, v] of retry) if (!(v instanceof IgError)) totals.set(k, v);
	}

	// Gross follows/unfollows, which is what lets the follower curve be rebuilt
	// for days before this dashboard existed. Best-effort: older tokens lack it.
	const follows = await getMany<unknown>(
		cfg,
		take.map((date) => ({
			key: date,
			path: `${cfg.userId}/insights`,
			params: { metric: 'follows_and_unfollows', period: 'day', metric_type: 'total_value', breakdown: 'follow_type', since: etMidnight(date), until: etMidnight(shiftDate(date, 1)) }
		})),
		budget
	).catch(() => new Map<string, unknown>());

	const now = new Date().toISOString();
	const stmts = [];
	let written = 0;
	for (const date of take) {
		const payload = totals.get(date);
		if (!payload || payload instanceof IgError) continue;
		const m = parseInsights(payload);
		const f = follows.get(date);
		const fm = f && !(f instanceof IgError) ? parseInsights(f) : {};
		const breakdown = (fm.follows_and_unfollows ?? {}) as Record<string, number>;
		// follow_type comes back as FOLLOWER (gained) / NON_FOLLOWER (lost). The
		// other spellings are older variants kept as a fallback.
		const gained = pickBreakdown(breakdown, ['FOLLOWER', 'FOLLOWS', 'FOLLOWS_AND_UNFOLLOWS_FOLLOWS']);
		const lost = pickBreakdown(breakdown, ['NON_FOLLOWER', 'UNFOLLOWS', 'UNFOLLOWER', 'FOLLOWS_AND_UNFOLLOWS_UNFOLLOWS']);
		const isToday = date === today;
		written++;
		stmts.push(
			d1
				.prepare(
					`INSERT INTO ig_day (date, followers, follows_count, media_count, reach, views, total_interactions,
						likes, comments, shares, saves, replies, accounts_engaged, profile_links_taps,
						follows_gained, unfollows, metrics_json, fetched_at)
					 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)
					 ON CONFLICT(date) DO UPDATE SET
						followers=COALESCE(excluded.followers, ig_day.followers),
						follows_count=COALESCE(excluded.follows_count, ig_day.follows_count),
						media_count=COALESCE(excluded.media_count, ig_day.media_count),
						reach=excluded.reach, views=excluded.views, total_interactions=excluded.total_interactions,
						likes=excluded.likes, comments=excluded.comments, shares=excluded.shares, saves=excluded.saves,
						replies=excluded.replies, accounts_engaged=excluded.accounts_engaged,
						profile_links_taps=excluded.profile_links_taps,
						follows_gained=COALESCE(excluded.follows_gained, ig_day.follows_gained),
						unfollows=COALESCE(excluded.unfollows, ig_day.unfollows),
						metrics_json=excluded.metrics_json, fetched_at=excluded.fetched_at`
				)
				.bind(
					date,
					isToday ? (snapshot.followers ?? null) : null,
					isToday ? (snapshot.follows ?? null) : null,
					isToday ? (snapshot.mediaCount ?? null) : null,
					num(m.reach), num(m.views), num(m.total_interactions), num(m.likes), num(m.comments),
					num(m.shares), num(m.saves), num(m.replies), num(m.accounts_engaged), num(m.profile_links_taps),
					gained, lost, JSON.stringify(m), now
				)
		);
	}
	for (let i = 0; i < stmts.length; i += 20) await d1.batch(stmts.slice(i, i + 20));
	if (!take.includes(today)) await snapshotToday(d1, today, snapshot);
	return written;
}

function pickBreakdown(breakdown: Record<string, number>, keys: string[]): number | null {
	for (const k of keys) if (typeof breakdown[k] === 'number') return breakdown[k];
	return null;
}

async function snapshotToday(d1: D1Database, today: string, s: { followers?: number; follows?: number; mediaCount?: number }): Promise<void> {
	await d1
		.prepare(
			`INSERT INTO ig_day (date, followers, follows_count, media_count, fetched_at) VALUES (?1,?2,?3,?4,?5)
			 ON CONFLICT(date) DO UPDATE SET followers=excluded.followers, follows_count=excluded.follows_count,
				media_count=excluded.media_count, fetched_at=excluded.fetched_at`
		)
		.bind(today, s.followers ?? null, s.follows ?? null, s.mediaCount ?? null, new Date().toISOString())
		.run();
}

/** Demographics need ~100 followers before Meta will return anything. */
async function syncAudience(d1: D1Database, cfg: IgConfig, budget: CallBudget): Promise<void> {
	const breakdowns = ['age', 'gender', 'country', 'city'];
	const results = await getMany<unknown>(
		cfg,
		breakdowns.map((b) => ({
			key: b,
			path: `${cfg.userId}/insights`,
			params: { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', timeframe: 'last_30_days', breakdown: b }
		})),
		budget
	).catch(() => new Map<string, unknown>());

	const now = new Date().toISOString();
	const stmts = [];
	for (const b of breakdowns) {
		const payload = results.get(b);
		if (!payload || payload instanceof IgError) continue;
		const parsed = parseInsights(payload).follower_demographics;
		if (typeof parsed !== 'object') continue;
		stmts.push(d1.prepare('DELETE FROM ig_audience WHERE breakdown = ?1').bind(b));
		for (const [bucket, value] of Object.entries(parsed))
			stmts.push(
				d1.prepare('INSERT OR REPLACE INTO ig_audience (breakdown, bucket, value, fetched_at) VALUES (?1,?2,?3,?4)').bind(b, bucket, value, now)
			);
	}
	for (let i = 0; i < stmts.length; i += 20) await d1.batch(stmts.slice(i, i + 20));
}

// ---------------------------------------------------------------- tokens ---
/**
 * Long-lived tokens last 60 days. graph.instagram.com refreshes with just the
 * token; the Facebook path needs the app secret, which this dashboard doesn't
 * hold — so there the UI tells you to paste a new one.
 */
export async function refreshToken(d1: D1Database, cfg: IgConfig): Promise<string> {
	if (cfg.base !== IG_BASE) throw new IgError('Facebook-login tokens must be regenerated in Meta’s dashboard and pasted in.');
	const res = await fetch(`${IG_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(cfg.token)}`);
	const body = (await res.json().catch(() => null)) as { access_token?: string; error?: unknown } | null;
	if (!res.ok || !body?.access_token) throwApiError(body);
	await setSetting(d1, 'ig_access_token', body.access_token!);
	await setSetting(d1, 'ig_token_refreshed_at', new Date().toISOString());
	return body.access_token!;
}

/** Confirm a pasted token works and report which account it belongs to. */
export async function verifyCredentials(cfg: IgConfig): Promise<Record<string, unknown>> {
	return get<Record<string, unknown>>(cfg, cfg.userId, { fields: PROFILE_FIELDS }, { remaining: 1, used: 0 });
}
