// Smallest check that fails if the Instagram parsing/analytics math breaks.
// Run: node scripts/check-instagram.ts
import assert from 'node:assert/strict';
import { parseInsights, etParts, etMidnight } from '../src/lib/server/instagram.ts';
import {
	byFormat, deltaPct, engagementRate, followerSeries, formatOf, interactions, postingHeatmap, niceTicks
} from '../src/lib/instagram.ts';
import { mockAudience, mockDays, mockMedia } from '../src/lib/mockInstagram.ts';

// --- the three shapes insights come back in --------------------------------
assert.deepEqual(
	parseInsights({
		data: [
			{ name: 'reach', values: [{ value: 120 }] },                          // classic
			{ name: 'views', total_value: { value: 340 } },                        // total_value
			{ name: 'likes', total_value: { value: 0 } },                          // zero is a value
			{
				name: 'navigation',                                                 // breakdown
				total_value: {
					breakdowns: [
						{ results: [{ dimension_values: ['TAP_FORWARD'], value: 9 }, { dimension_values: ['TAP_BACK'], value: 2 }] }
					]
				}
			}
		]
	}),
	{ reach: 120, views: 340, likes: 0, navigation: { TAP_FORWARD: 9, TAP_BACK: 2 } }
);
// A metric with no data at all is omitted, not reported as 0.
assert.deepEqual(parseInsights({ data: [{ name: 'saved', values: [] }] }), {});
assert.deepEqual(parseInsights({ error: { message: 'nope' } }), {});

// --- posts are bucketed in Elon time, not UTC ------------------------------
// 2026-07-21T01:30Z is still Monday evening 9:30pm in New York.
assert.deepEqual(etParts('2026-07-21T01:30:00+0000'), { date: '2026-07-20', hour: 21, dow: 1 });
// Midnight ET exactly.
assert.equal(etParts('2026-07-20T04:00:00+0000').hour, 0);

// --- since/until windows follow ET, including across the DST switch ---------
assert.equal(etMidnight('2026-07-20'), Date.parse('2026-07-20T04:00:00Z') / 1000); // EDT, UTC-4
assert.equal(etMidnight('2026-01-20'), Date.parse('2026-01-20T05:00:00Z') / 1000); // EST, UTC-5
assert.equal(etMidnight('2026-03-08'), Date.parse('2026-03-08T05:00:00Z') / 1000); // spring forward: midnight is still EST
assert.equal(etMidnight('2026-11-01'), Date.parse('2026-11-01T04:00:00Z') / 1000); // fall back: midnight is still EDT

// --- format derivation -----------------------------------------------------
assert.equal(formatOf('VIDEO', 'REELS'), 'reel');
assert.equal(formatOf('IMAGE', 'STORY'), 'story');
assert.equal(formatOf('CAROUSEL_ALBUM', 'FEED'), 'carousel');
assert.equal(formatOf('VIDEO', 'FEED'), 'video');
assert.equal(formatOf('IMAGE', 'FEED'), 'image');

// --- engagement ------------------------------------------------------------
const post = (over = {}) =>
	({
		id: 'x', format: 'image', reach: 200, like_count: 10, comments_count: 4, saved: 5,
		shares: 1, total_interactions: null, posted_dow: 2, posted_hour: 13, ...over
	}) as never;

assert.equal(interactions(post()), 20);              // summed when the API omits the total
assert.equal(interactions(post({ total_interactions: 33 })), 33); // the API's total wins
assert.equal(engagementRate(post()), 10);            // 20 / 200
assert.equal(engagementRate(post({ reach: 0 })), null); // never divide by zero reach
assert.equal(deltaPct(150, 100), 50);
assert.equal(deltaPct(150, 0), null);                // no infinite growth from nothing

// --- per-format rollup -----------------------------------------------------
const rollup = byFormat([post(), post({ format: 'reel', reach: 1000, saved: 0, shares: 0 })], ['image', 'reel']);
assert.deepEqual(rollup.map((r) => [r.format, r.count, r.avgReach]), [['image', 1, 200], ['reel', 1, 1000]]);

// --- posting heatmap -------------------------------------------------------
const heat = postingHeatmap([post(), post({ reach: 400 }), post({ posted_dow: 5, posted_hour: 20, reach: 50 })]);
assert.equal(heat.cells[2][4].count, 2);             // Tue, 12–3pm block
assert.equal(heat.cells[2][4].avgReach, 300);        // (200 + 400) / 2
assert.equal(heat.cells[5][6].avgReach, 50);         // Fri, 6–9pm
assert.equal(heat.max, 300);
assert.equal(heat.cells[0][0].avgReach, null);       // nothing posted → blank, not zero

// --- follower curve --------------------------------------------------------
// Only the last day has a real snapshot; the days before it are rebuilt from
// gross follows/unfollows, walking backwards from the anchor.
const curve = followerSeries([
	{ date: '2026-08-01', follows_gained: 10, unfollows: 2 },
	{ date: '2026-08-02', follows_gained: 5, unfollows: 0 },
	{ date: '2026-08-03', followers: 1000, follows_gained: 3, unfollows: 1 }
]);
assert.deepEqual(curve.map((c) => c.value), [993, 998, 1000]);
assert.deepEqual(curve.map((c) => c.estimated), [true, true, false]);

// A day with no delta data must not break the walk. The regression: the newest
// day is the anchor but its follows/unfollows aren't in yet, which used to leave
// the entire reconstructed history empty.
const gappy = followerSeries([
	{ date: '2026-08-01', follows_gained: 10, unfollows: 2 },
	{ date: '2026-08-02', follows_gained: 5, unfollows: 0 },
	{ date: '2026-08-03', followers: 1000 } // anchor, deltas not reported yet
]);
// The anchor's own net is unknown, so it counts as no change: the day before it
// reads 1000 too, and the walk carries on to 995 from there.
assert.deepEqual(gappy.map((c) => c.value), [995, 1000, 1000]);
assert.ok(gappy.every((c) => c.value != null), 'no point may be left null behind the anchor');

// A later day with no snapshot is carried forward by its net change.
const forward = followerSeries([
	{ date: '2026-08-01', followers: 500 },
	{ date: '2026-08-02', follows_gained: 7, unfollows: 2 }
]);
assert.deepEqual(forward.map((c) => c.value), [500, 505]);

// No data at all stays null rather than inventing a flat line.
assert.deepEqual(followerSeries([{ date: '2026-08-01' }]).map((c) => c.value), [null]);

// --- axis ticks must CONTAIN the data, or lines paint outside the chart ------
// The regression: max 4500 with step 2000 used to stop the axis at 4000.
assert.equal(niceTicks(0, 4500).at(-1), 6000);
assert.ok(niceTicks(0, 4500).at(-1)! >= 4500);
for (const max of [1, 7, 99, 4500, 14264, 60398, 999999]) {
	const t = niceTicks(0, max);
	assert.equal(t[0], 0, `zero baseline for ${max}`);
	assert.ok(t.at(-1)! >= max, `axis top ${t.at(-1)} must cover ${max}`);
}
// Fitted (non-zero) domains must bracket the data on both sides — the follower
// chart, where a zero baseline would flatten 2,425 ± 20 into a straight line.
const fitted = niceTicks(2405, 2425);
assert.ok(fitted[0] <= 2405 && fitted.at(-1)! >= 2425);
assert.ok(fitted.length >= 2);
// Ticks stay evenly spaced and free of float drift.
const spaced = niceTicks(0, 3000);
assert.deepEqual(spaced, spaced.map((_, i) => spaced[0] + i * (spaced[1] - spaced[0])));

// --- demo data is deterministic and widening-safe ---------------------------
// The same date must produce the same numbers whichever window asks for it,
// otherwise switching 7d → 90d silently rewrites history on screen.
const narrow = mockDays('2026-08-25', '2026-08-31');
const wide = mockDays('2026-06-01', '2026-08-31');
assert.deepEqual(narrow, wide.slice(-7));
assert.deepEqual(mockDays('2026-08-25', '2026-08-31'), narrow); // stable across calls

const wideMedia = mockMedia('2026-06-01', '2026-08-31', '2026-08-31');
const narrowMedia = mockMedia('2026-08-25', '2026-08-31', '2026-08-31');
assert.deepEqual(
	narrowMedia.map((m) => m.id),
	wideMedia.filter((m) => (m.posted_date ?? '') >= '2026-08-25').map((m) => m.id)
);

// Enough of a spread that every panel on the dashboard has something to draw.
const posted = new Set(wideMedia.map((m) => m.format));
assert.ok(posted.has('reel') && posted.has('carousel') && posted.has('image'), 'needs a format mix');
assert.ok(wideMedia.some((m) => m.format === 'story'), 'needs stories for today');
assert.ok(wideMedia.every((m) => m.reach && m.reach > 0), 'every mock post needs reach');
assert.ok(wideMedia.filter((m) => m.format !== 'story').every((m) => (m.views ?? 0) >= (m.reach ?? 0)), 'views >= reach');

// Followers must climb, or the growth chart is nonsense.
assert.ok(wide[wide.length - 1].followers! > wide[0].followers!);
assert.equal(new Set(mockAudience().map((a) => a.breakdown)).size, 4);

console.log('instagram checks pass');
