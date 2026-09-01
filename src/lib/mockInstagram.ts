// Deterministic sample data for the Instagram dashboard's demo mode.
//
// Every number is derived from a hash of its own date, so the same day always
// produces the same figures no matter which range is being viewed — switching
// 7d → 90d widens the window instead of reshuffling history.

import { formatOf, type AudienceRow, type IgDay, type IgMedia, type IgProfile } from './instagram.ts';

const EPOCH = '2026-01-01';

/** FNV-1a — small, stable, and good enough to spread a date string over 32 bits. */
function hash(seed: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/** A stable pseudo-random float in [0,1) for a given key. */
function rand(key: string): number {
	return hash(key) / 0xffffffff;
}

function pick<T>(key: string, options: readonly T[]): T {
	return options[Math.floor(rand(key) * options.length) % options.length];
}

function between(key: string, lo: number, hi: number): number {
	return Math.round(lo + rand(key) * (hi - lo));
}

function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000);
}

function eachDate(from: string, to: string): string[] {
	const out: string[] = [];
	for (let d = from; d <= to; ) {
		out.push(d);
		const next = new Date(d + 'T00:00:00Z');
		next.setUTCDate(next.getUTCDate() + 1);
		d = next.toISOString().slice(0, 10);
	}
	return out;
}

/** Steady growth plus a little wobble, so the follower line trends up but isn't a ruler. */
function followersOn(date: string): number {
	return 2410 + Math.round(daysBetween(EPOCH, date) * 1.4) + between(`f${date}`, -6, 6);
}

const CAPTIONS = [
	'Senate meeting recap — everything we voted on this week 🗳️',
	'Meet your Exec Board: VP of Communications',
	'Elon SGA x Campus Safety: Guider’s Guide, Ep. 1',
	'What does SGA actually do? A 60-second explainer',
	'Homecoming week is here — full schedule in our bio',
	'Congrats to this year’s organization funding recipients 🎉',
	'Behind the scenes at last night’s Senate session',
	'Your student fee, explained in 5 slides',
	'Office hours are open all week in Moseley 🐦',
	'Spring elections: how to run, how to vote',
	'Thank you to everyone who came out to the town hall',
	'Three things Senate passed this month'
];

/** A gradient tile in brand colours — the mock grid should look like the real one. */
function thumbnail(seed: string): string {
	const hue = between(`h${seed}`, 340, 375) % 360;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 60% 32%)"/><stop offset="1" stop-color="hsl(${(hue + 28) % 360} 45% 58%)"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const MOCK_PROFILE: IgProfile = {
	id: '17841400000000000',
	username: 'elonsga',
	name: 'Elon Student Government (demo)',
	biography: 'Sample data — no Instagram account is connected.',
	followers_count: 0, // replaced per-request with followersOn(today)
	follows_count: 312,
	media_count: 248
};

export function mockProfile(today: string): IgProfile {
	return { ...MOCK_PROFILE, followers_count: followersOn(today) };
}

export function mockDays(from: string, to: string): IgDay[] {
	return eachDate(from, to).map((date) => {
		const dow = new Date(date + 'T00:00:00Z').getUTCDay();
		// Weekends are quieter, which is what makes the heatmap and the daily
		// charts show a shape rather than uniform noise.
		const weekend = dow === 0 || dow === 6 ? 0.55 : 1;
		const reach = Math.round(between(`r${date}`, 900, 3400) * weekend);
		const views = Math.round(reach * (1.3 + rand(`v${date}`) * 0.9));
		const likes = Math.round(reach * (0.05 + rand(`l${date}`) * 0.05));
		const comments = Math.round(likes * (0.03 + rand(`c${date}`) * 0.06));
		const saves = Math.round(likes * (0.06 + rand(`s${date}`) * 0.1));
		const shares = Math.round(likes * (0.04 + rand(`sh${date}`) * 0.09));
		const gained = between(`g${date}`, 2, 22);
		return {
			date,
			followers: followersOn(date),
			follows_count: 312,
			media_count: 248,
			reach,
			views,
			total_interactions: likes + comments + saves + shares,
			likes,
			comments,
			shares,
			saves,
			replies: between(`rp${date}`, 0, 9),
			reposts: between(`rs${date}`, 0, 4),
			accounts_engaged: Math.round(reach * (0.07 + rand(`ae${date}`) * 0.05)),
			profile_links_taps: between(`t${date}`, 1, 24),
			follows_gained: gained,
			unfollows: Math.max(0, gained - between(`u${date}`, 1, 14)),
			metrics_json: null,
			fetched_at: date + 'T12:00:00Z'
		};
	});
}

const FORMAT_MIX = [
	{ media_type: 'VIDEO', product_type: 'REELS', weight: 3, reachBoost: 2.1 },
	{ media_type: 'CAROUSEL_ALBUM', product_type: 'FEED', weight: 3, reachBoost: 1.15 },
	{ media_type: 'IMAGE', product_type: 'FEED', weight: 3, reachBoost: 1 },
	{ media_type: 'VIDEO', product_type: 'FEED', weight: 1, reachBoost: 1.4 }
] as const;

function weightedFormat(key: string): (typeof FORMAT_MIX)[number] {
	const total = FORMAT_MIX.reduce((t, f) => t + f.weight, 0);
	let roll = rand(key) * total;
	for (const f of FORMAT_MIX) {
		roll -= f.weight;
		if (roll <= 0) return f;
	}
	return FORMAT_MIX[FORMAT_MIX.length - 1];
}

export function mockMedia(from: string, to: string, today: string): IgMedia[] {
	const out: IgMedia[] = [];

	for (const date of eachDate(from, to)) {
		const dow = new Date(date + 'T00:00:00Z').getUTCDay();
		// 0–2 posts a day, and rarely anything at the weekend.
		const posts = rand(`n${date}`) > (dow === 0 || dow === 6 ? 0.82 : 0.42) ? (rand(`n2${date}`) > 0.78 ? 2 : 1) : 0;

		for (let i = 0; i < posts; i++) {
			const seed = `${date}#${i}`;
			const mix = weightedFormat(seed);
			const format = formatOf(mix.media_type, mix.product_type);
			const hour = between(`hr${seed}`, 9, 20);
			const base = between(`br${seed}`, 700, 2600);
			const reach = Math.round(base * mix.reachBoost);
			const views = format === 'reel' || format === 'video' ? Math.round(reach * (1.8 + rand(`vv${seed}`) * 1.6)) : Math.round(reach * (1.1 + rand(`vv${seed}`) * 0.4));
			const likes = Math.round(reach * (0.06 + rand(`lk${seed}`) * 0.06));
			const comments = Math.round(likes * (0.02 + rand(`cm${seed}`) * 0.07));
			// Carousels get saved, reels get shared — the format panel should show
			// a difference worth reading, not four identical bars.
			const saved = Math.round(likes * (format === 'carousel' ? 0.22 : 0.07) * (0.6 + rand(`sv${seed}`)));
			const shares = Math.round(likes * (format === 'reel' ? 0.2 : 0.06) * (0.6 + rand(`sr${seed}`)));
			const isVideo = format === 'reel' || format === 'video';

			out.push({
				id: `mock_${date.replace(/-/g, '')}_${i}`,
				media_type: mix.media_type,
				product_type: mix.product_type,
				format,
				caption: pick(`cap${seed}`, CAPTIONS),
				permalink: null,
				media_url: null,
				thumbnail_url: thumbnail(seed),
				timestamp: `${date}T${String(hour + 4).padStart(2, '0')}:${String(between(`mn${seed}`, 0, 59)).padStart(2, '0')}:00+0000`,
				posted_date: date,
				posted_hour: hour,
				posted_dow: dow,
				children_count: format === 'carousel' ? between(`ch${seed}`, 3, 9) : 0,
				like_count: likes,
				comments_count: comments,
				reach,
				views,
				saved,
				shares,
				total_interactions: likes + comments + saved + shares,
				follows: between(`fl${seed}`, 0, 12),
				profile_visits: between(`pv${seed}`, 5, 90),
				replies: null,
				navigation: null,
				link_clicks: null,
				reposts: between(`rp${seed}`, 0, 5),
				avg_watch_time: isVideo ? between(`aw${seed}`, 3200, 14000) : null,
				total_watch_time: isVideo ? between(`tw${seed}`, 900_000, 9_000_000) : null,
				metrics_json: null,
				insights_at: `${date}T23:00:00Z`,
				fetched_at: `${date}T23:00:00Z`
			});
		}
	}

	// Stories only live 24h in the real API, so the demo shows a handful from today.
	if (today >= from && today <= to) {
		const count = between(`st${today}`, 3, 6);
		for (let i = 0; i < count; i++) {
			const seed = `story${today}#${i}`;
			const reach = between(`sr${seed}`, 400, 1500);
			out.push({
				id: `mock_story_${today.replace(/-/g, '')}_${i}`,
				media_type: 'IMAGE',
				product_type: 'STORY',
				format: 'story',
				caption: null,
				permalink: null,
				media_url: null,
				thumbnail_url: thumbnail(seed),
				timestamp: `${today}T${String(between(`sh${seed}`, 13, 22)).padStart(2, '0')}:00:00+0000`,
				posted_date: today,
				posted_hour: between(`shh${seed}`, 9, 18),
				posted_dow: new Date(today + 'T00:00:00Z').getUTCDay(),
				children_count: 0,
				like_count: null,
				comments_count: null,
				reach,
				views: Math.round(reach * (1.05 + rand(`sv${seed}`) * 0.2)),
				saved: null,
				shares: between(`ssh${seed}`, 0, 8),
				total_interactions: between(`si${seed}`, 4, 40),
				follows: between(`sf${seed}`, 0, 5),
				profile_visits: between(`spv${seed}`, 2, 40),
				replies: between(`srp${seed}`, 0, 12),
				navigation: between(`snv${seed}`, 20, 300),
				link_clicks: between(`slc${seed}`, 0, 25),
				reposts: null,
				avg_watch_time: null,
				total_watch_time: null,
				metrics_json: null,
				insights_at: `${today}T23:00:00Z`,
				fetched_at: `${today}T23:00:00Z`
			});
		}
	}

	return out.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));
}

const AUDIENCE: Record<string, [string, number][]> = {
	age: [['18-24', 2180], ['25-34', 341], ['13-17', 118], ['35-44', 96], ['45-54', 51], ['55-64', 22], ['65+', 9]],
	gender: [['F', 1642], ['M', 1108], ['U', 67]],
	country: [['US', 2705], ['CA', 41], ['GB', 28], ['IN', 19], ['DE', 11], ['MX', 9]],
	city: [
		['Elon, North Carolina', 1418], ['Burlington, North Carolina', 402], ['Greensboro, North Carolina', 188],
		['Raleigh, North Carolina', 121], ['Charlotte, North Carolina', 97], ['Durham, North Carolina', 74]
	]
};

export function mockAudience(): AudienceRow[] {
	return Object.entries(AUDIENCE).flatMap(([breakdown, rows]) =>
		rows.map(([bucket, value]) => ({ breakdown, bucket, value }))
	);
}
