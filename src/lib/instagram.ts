// Shared Instagram types, metric metadata and pure analytics helpers.
// Nothing here touches the network or the DB, so scripts/check-instagram.ts can
// exercise the maths directly.

/**
 * Demo-mode flag. A cookie rather than a database row on purpose: dev points at
 * the live D1, so a stored setting would flip the real site into demo mode too.
 * Per-browser keeps it to the person who turned it on.
 */
export const MOCK_COOKIE = 'ig_mock';

// Meta offers two login paths to the same data; only the host differs.
export const FB_BASE = 'https://graph.facebook.com';
export const IG_BASE = 'https://graph.instagram.com';

export type IgFormat = 'reel' | 'carousel' | 'image' | 'video' | 'story';

export interface IgMedia {
	id: string;
	media_type: string | null;
	product_type: string | null;
	format: IgFormat;
	caption: string | null;
	permalink: string | null;
	media_url: string | null;
	thumbnail_url: string | null;
	timestamp: string | null;
	posted_date: string | null;
	posted_hour: number | null;
	posted_dow: number | null;
	children_count: number;
	like_count: number | null;
	comments_count: number | null;
	reach: number | null;
	views: number | null;
	saved: number | null;
	shares: number | null;
	total_interactions: number | null;
	follows: number | null;
	profile_visits: number | null;
	replies: number | null;
	navigation: number | null;
	link_clicks: number | null;
	reposts: number | null;
	avg_watch_time: number | null;
	total_watch_time: number | null;
	metrics_json: string | null;
	insights_at: string | null;
	fetched_at: string;
}

export interface IgDay {
	date: string;
	followers: number | null;
	follows_count: number | null;
	media_count: number | null;
	reach: number | null;
	views: number | null;
	total_interactions: number | null;
	likes: number | null;
	comments: number | null;
	shares: number | null;
	saves: number | null;
	replies: number | null;
	reposts: number | null;
	accounts_engaged: number | null;
	profile_links_taps: number | null;
	follows_gained: number | null;
	unfollows: number | null;
	metrics_json: string | null;
	fetched_at: string;
}

export interface IgProfile {
	id: string;
	username: string;
	name?: string;
	biography?: string;
	website?: string;
	profile_picture_url?: string;
	followers_count?: number;
	follows_count?: number;
	media_count?: number;
}

export interface IgSyncRun {
	id: number;
	started_at: string;
	finished_at: string | null;
	ok: number;
	media_seen: number;
	media_refreshed: number;
	days_synced: number;
	calls: number;
	message: string | null;
}

export interface AudienceRow {
	breakdown: string;
	bucket: string;
	value: number;
}

// ---------------------------------------------------------------- palette ---
// Validated with the dataviz palette checker (light surface, --pairs all):
// lightness band, chroma floor, CVD separation and normal-vision floor all pass.
// Slot 1 is brand maroon-red; aqua and yellow sit under 3:1 on the light surface,
// so every chart using them ships direct labels or a table view alongside.
export const SERIES = ['#a8102a', '#2a78d6', '#1baf7a', '#eda100', '#4a3aa7'] as const;

/** Single-hue maroon ramp for magnitude (the posting heatmap). Light → dark. */
export const RAMP = ['#fbe9eb', '#f2c2c9', '#e28e9c', '#cc5568', '#ad2338', '#8a0b1d', '#73000a'];

export const FORMATS: Record<IgFormat, { label: string; plural: string; color: string }> = {
	reel: { label: 'Reel', plural: 'Reels', color: SERIES[0] },
	carousel: { label: 'Carousel', plural: 'Carousels', color: SERIES[1] },
	image: { label: 'Photo', plural: 'Photos', color: SERIES[2] },
	video: { label: 'Video', plural: 'Videos', color: SERIES[3] },
	story: { label: 'Story', plural: 'Stories', color: SERIES[4] }
};

export const FORMAT_KEYS = Object.keys(FORMATS) as IgFormat[];

/** Feed formats — everything that stays on the grid. Stories are reported apart. */
export const FEED_FORMATS: IgFormat[] = ['reel', 'carousel', 'image', 'video'];

export function formatOf(mediaType: string | null, productType: string | null): IgFormat {
	if (productType === 'STORY') return 'story';
	if (productType === 'REELS') return 'reel';
	if (mediaType === 'CAROUSEL_ALBUM') return 'carousel';
	if (mediaType === 'VIDEO') return 'video';
	return 'image';
}

// ------------------------------------------------------- metric catalogue ---
// Drives the post detail view: any metric the API returns gets a human label and
// the right formatter, and anything not listed still renders under its raw name.
export type MetricKind = 'count' | 'ms' | 'percent';

export const METRIC_LABELS: Record<string, { label: string; kind: MetricKind; help?: string }> = {
	reach: { label: 'Reach', kind: 'count', help: 'Unique accounts that saw this.' },
	views: { label: 'Views', kind: 'count', help: 'Times it was played or shown, repeats included.' },
	likes: { label: 'Likes', kind: 'count' },
	comments: { label: 'Comments', kind: 'count' },
	saved: { label: 'Saves', kind: 'count' },
	shares: { label: 'Shares', kind: 'count' },
	reposts: { label: 'Reposts', kind: 'count' },
	total_interactions: { label: 'Interactions', kind: 'count', help: 'Likes + comments + saves + shares.' },
	follows: { label: 'Follows', kind: 'count', help: 'Accounts that followed you from this.' },
	profile_visits: { label: 'Profile visits', kind: 'count' },
	profile_activity: { label: 'Profile activity', kind: 'count' },
	replies: { label: 'Replies', kind: 'count' },
	navigation: { label: 'Story navigation', kind: 'count' },
	link_clicks: { label: 'Link clicks', kind: 'count' },
	facebook_views: { label: 'Facebook views', kind: 'count' },
	crossposted_views: { label: 'Crossposted views', kind: 'count' },
	ig_reels_avg_watch_time: { label: 'Avg watch time', kind: 'ms' },
	ig_reels_video_view_total_time: { label: 'Total watch time', kind: 'ms' },
	reels_skip_rate: { label: 'Skip rate', kind: 'percent' },
	total_views: { label: 'Total views', kind: 'count' },
	total_likes: { label: 'Total likes', kind: 'count' },
	total_comments: { label: 'Total comments', kind: 'count' }
};

export function metricLabel(key: string): string {
	return METRIC_LABELS[key]?.label ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function formatMetric(key: string, value: number): string {
	const kind = METRIC_LABELS[key]?.kind ?? 'count';
	if (kind === 'ms') return fmtDuration(value);
	if (kind === 'percent') return fmtPct(value);
	return fmtNum(value);
}

// ------------------------------------------------------------ formatting ---
export function fmtNum(n: number | null | undefined): string {
	if (n == null || !Number.isFinite(n)) return '—';
	const abs = Math.abs(n);
	if (abs >= 1_000_000) return (n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, '') + 'M';
	if (abs >= 10_000) return (n / 1000).toFixed(0) + 'k';
	if (abs >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
	return String(Math.round(n));
}

export function fmtFull(n: number | null | undefined): string {
	return n == null || !Number.isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US');
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
	return n == null || !Number.isFinite(n) ? '—' : `${n.toFixed(digits)}%`;
}

/** Watch times come back in milliseconds. */
export function fmtDuration(ms: number | null | undefined): string {
	if (ms == null || !Number.isFinite(ms)) return '—';
	const s = ms / 1000;
	if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
	const m = Math.floor(s / 60);
	return `${m}m ${Math.round(s - m * 60)}s`;
}

export function fmtDelta(pct: number | null): string {
	if (pct == null || !Number.isFinite(pct)) return '—';
	const rounded = Math.abs(pct) >= 100 ? pct.toFixed(0) : pct.toFixed(1);
	return `${pct > 0 ? '+' : ''}${rounded}%`;
}

/** Percent change, or null when the baseline is zero/absent (∞% helps nobody). */
export function deltaPct(current: number | null, previous: number | null): number | null {
	if (current == null || previous == null || previous === 0) return null;
	return ((current - previous) / Math.abs(previous)) * 100;
}

export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Axis ticks at 1/2/5×10ⁿ intervals that always *contain* the data.
 *
 * The subtle part is rounding the ends outward: a max of 4,500 with a step of
 * 2,000 has to produce a 6,000 top, not stop at 4,000 — otherwise the highest
 * point plots above the plot area and the line escapes the chart box.
 */
export function niceTicks(min: number, max: number, target = 4): number[] {
	const span = max - min || Math.abs(max) || 1;
	const mag = Math.pow(10, Math.floor(Math.log10(span / target)));
	const step = [1, 2, 5, 10].map((s) => s * mag).find((s) => s >= span / target) ?? mag * 10;
	const lo = Math.floor(min / step) * step;
	const hi = Math.ceil(max / step) * step;
	const out: number[] = [];
	// Rebuild each tick by multiplication rather than accumulating, so long runs
	// don't drift into 1999.9999999 territory.
	for (let i = 0; lo + i * step <= hi + step * 1e-9; i++) out.push(lo + i * step);
	return out;
}

// -------------------------------------------------------------- analytics ---
const n = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? 0 : v);

/** Interactions on a post, falling back to its parts when the API omits the total. */
export function interactions(m: IgMedia): number {
	if (m.total_interactions != null) return m.total_interactions;
	return n(m.like_count) + n(m.comments_count) + n(m.saved) + n(m.shares);
}

/**
 * Engagement rate by reach — interactions ÷ accounts reached. This is the number
 * Instagram itself reports; rate-by-followers is a different (usually smaller)
 * figure, so `engagementByFollowers` keeps them separate rather than conflated.
 */
export function engagementRate(m: IgMedia): number | null {
	const r = m.reach;
	if (!r) return null;
	return (interactions(m) / r) * 100;
}

export function engagementByFollowers(m: IgMedia, followers: number | null): number | null {
	if (!followers) return null;
	return (interactions(m) / followers) * 100;
}

export function sum<T>(rows: T[], pick: (r: T) => number | null | undefined): number {
	return rows.reduce((t, r) => t + n(pick(r)), 0);
}

export function avg<T>(rows: T[], pick: (r: T) => number | null | undefined): number | null {
	const vals = rows.map(pick).filter((v): v is number => v != null && Number.isFinite(v));
	return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Per-format rollup, ordered by the fixed FORMAT_KEYS so colours never shuffle. */
export function byFormat(media: IgMedia[], formats: IgFormat[] = FEED_FORMATS) {
	return formats.map((format) => {
		const rows = media.filter((m) => m.format === format);
		return {
			format,
			label: FORMATS[format].plural,
			color: FORMATS[format].color,
			count: rows.length,
			reach: sum(rows, (r) => r.reach),
			views: sum(rows, (r) => r.views),
			interactions: sum(rows, interactions),
			avgReach: avg(rows, (r) => r.reach),
			avgViews: avg(rows, (r) => r.views),
			avgInteractions: rows.length ? sum(rows, interactions) / rows.length : null,
			engagement: avg(rows, engagementRate)
		};
	});
}

/**
 * Day-of-week × 3-hour-block grid of average reach, for "when should we post".
 * Blocks rather than 24 columns: a club account posts a few hundred times a year,
 * and one post per cell is noise, not a signal.
 */
export const HOUR_BLOCKS = [
	{ start: 0, label: '12–3a' },
	{ start: 3, label: '3–6a' },
	{ start: 6, label: '6–9a' },
	{ start: 9, label: '9–12p' },
	{ start: 12, label: '12–3p' },
	{ start: 15, label: '3–6p' },
	{ start: 18, label: '6–9p' },
	{ start: 21, label: '9–12a' }
];

export function postingHeatmap(media: IgMedia[]) {
	const cells = DOW.map((_, dow) =>
		HOUR_BLOCKS.map((_, block) => ({ dow, block, count: 0, reach: 0, avgReach: null as number | null }))
	);
	for (const m of media) {
		if (m.posted_dow == null || m.posted_hour == null || m.reach == null) continue;
		const cell = cells[m.posted_dow]?.[Math.floor(m.posted_hour / 3)];
		if (!cell) continue;
		cell.count++;
		cell.reach += m.reach;
	}
	let max = 0;
	for (const row of cells)
		for (const cell of row) {
			if (cell.count) cell.avgReach = cell.reach / cell.count;
			if ((cell.avgReach ?? 0) > max) max = cell.avgReach!;
		}
	return { cells, max };
}

/** Densify a date range so charts show real gaps instead of joining across them. */
export function fillDays(days: IgDay[], from: string, to: string): (IgDay | { date: string })[] {
	const found = new Map(days.map((d) => [d.date, d]));
	const out: (IgDay | { date: string })[] = [];
	for (let date = from; date <= to; date = nextDate(date)) out.push(found.get(date) ?? { date });
	return out;
}

function nextDate(date: string): string {
	const d = new Date(date + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString().slice(0, 10);
}

/**
 * A continuous follower curve from sparse data.
 *
 * `followers` is only a snapshot for days the sync actually ran, but account
 * insights give gross follows/unfollows per day, which backfills the rest:
 * followers(D-1) = followers(D) - net(D). So we anchor on the newest real
 * snapshot, walk backwards to reconstruct history the dashboard never saw live,
 * then walk forwards to fill any later gap. A real snapshot always wins over a
 * reconstructed value.
 */
export function followerSeries(days: { date: string; followers?: number | null; follows_gained?: number | null; unfollows?: number | null }[]): { date: string; value: number | null; estimated: boolean }[] {
	const net = (d: (typeof days)[number]) =>
		d.follows_gained == null && d.unfollows == null ? null : n(d.follows_gained) - n(d.unfollows);

	const out = days.map((d) => ({ date: d.date, value: d.followers ?? null, estimated: false }));
	const anchor = out.findLastIndex((p) => p.value != null);
	if (anchor === -1) return out;

	for (let i = anchor; i > 0; i--) {
		if (out[i - 1].value != null) continue;
		if (out[i].value == null) continue;
		// A day whose deltas we don't have yet (today, still in progress) must not
		// break the chain — carry the value across it and keep walking, or one
		// unknown day wipes out every reconstructed day behind it.
		out[i - 1] = { date: out[i - 1].date, value: out[i].value! - (net(days[i]) ?? 0), estimated: true };
	}
	for (let i = anchor + 1; i < out.length; i++) {
		if (out[i].value != null) continue;
		const change = net(days[i]);
		if (out[i - 1].value == null) continue;
		out[i] = { date: out[i].date, value: out[i - 1].value! + n(change), estimated: true };
	}
	return out;
}
