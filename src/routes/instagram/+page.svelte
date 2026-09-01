<script lang="ts">
	import { enhance } from '$app/forms';
	import Chart from '$lib/components/ig/Chart.svelte';
	import Stat from '$lib/components/ig/Stat.svelte';
	import Bars from '$lib/components/ig/Bars.svelte';
	import Heatmap from '$lib/components/ig/Heatmap.svelte';
	import PostDrawer from '$lib/components/ig/PostDrawer.svelte';
	import {
		FEED_FORMATS, FORMATS, FORMAT_KEYS, SERIES, avg, byFormat, deltaPct, engagementRate,
		fillDays, fmtFull, fmtNum, fmtPct, fmtDuration, followerSeries, interactions, postingHeatmap,
		sum, FB_BASE, IG_BASE, type IgDay, type IgFormat, type IgMedia
	} from '$lib/instagram';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Only the sync action reports this, so it isn't on every ActionData branch.
	const needsReauth = $derived(Boolean((form as { needsReauth?: boolean } | null)?.needsReauth));

	let syncing = $state(false);
	let importing = $state(false);
	let showSettings = $state(false);
	let replacingToken = $state(false);
	let selected = $state<IgMedia | null>(null);
	let trendMetric = $state<'reach' | 'views' | 'total_interactions' | 'accounts_engaged'>('reach');
	let leaderMetric = $state<'reach' | 'views' | 'engagement' | 'saved' | 'shares'>('reach');
	let tableFormat = $state<'all' | IgFormat>('all');
	let tableSort = $state<'date' | 'reach' | 'views' | 'interactions' | 'engagement'>('date');
	let query = $state('');

	// ------------------------------------------------------------ windows ---
	const inRange = (d: string | null) => !!d && d >= data.from && d <= data.to;
	const inPrev = (d: string | null) => !!d && d >= (data.prevFrom ?? data.from) && d < data.from;

	const days = $derived(fillDays((data.days as IgDay[]).filter((d) => inRange(d.date)), data.from, data.to) as IgDay[]);
	const prevDays = $derived((data.days as IgDay[]).filter((d) => inPrev(d.date)));
	const media = $derived((data.media as IgMedia[]).filter((m) => inRange(m.posted_date)));
	const prevMedia = $derived((data.media as IgMedia[]).filter((m) => inPrev(m.posted_date)));

	const feed = $derived(media.filter((m) => m.format !== 'story'));
	const prevFeed = $derived(prevMedia.filter((m) => m.format !== 'story'));
	const stories = $derived(media.filter((m) => m.format === 'story'));

	const labels = $derived(days.map((d) => shortDate(d.date)));
	function shortDate(date: string): string {
		const [, m, d] = date.split('-');
		return `${Number(m)}/${Number(d)}`;
	}

	// ------------------------------------------------------------- totals ---
	const followers = $derived(followerSeries(days));
	const followerNow = $derived(
		data.profile?.followers_count ?? [...followers].reverse().find((f) => f.value != null)?.value ?? null
	);
	const followerStart = $derived(followers.find((f) => f.value != null)?.value ?? null);
	const followerGain = $derived(followerNow != null && followerStart != null ? followerNow - followerStart : null);

	const total = $derived({
		reach: sum(days, (d) => d.reach),
		views: sum(days, (d) => d.views),
		interactions: sum(days, (d) => d.total_interactions),
		engaged: sum(days, (d) => d.accounts_engaged),
		taps: sum(days, (d) => d.profile_links_taps)
	});
	/**
	 * A previous window we barely have data for produces absurd percentages
	 * (+644900%), which is noise dressed as insight. Only compare like with like.
	 */
	const comparable = $derived(
		prevDays.filter((d) => d.reach != null).length >= Math.max(3, (data.range ?? 30) * 0.5)
	);
	const change = (current: number | null, previous: number | null) =>
		comparable ? deltaPct(current, previous) : null;

	const prevTotal = $derived({
		reach: sum(prevDays, (d) => d.reach),
		views: sum(prevDays, (d) => d.views),
		interactions: sum(prevDays, (d) => d.total_interactions),
		engaged: sum(prevDays, (d) => d.accounts_engaged),
		taps: sum(prevDays, (d) => d.profile_links_taps)
	});

	// Post-level reach is the honest denominator for engagement rate: account
	// reach counts people who never saw a post at all.
	const postReach = $derived(sum(feed, (m) => m.reach));
	const postInteractions = $derived(sum(feed, interactions));
	const engagement = $derived(postReach ? (postInteractions / postReach) * 100 : null);
	const prevEngagement = $derived.by(() => {
		const r = sum(prevFeed, (m) => m.reach);
		return r ? (sum(prevFeed, interactions) / r) * 100 : null;
	});

	const tiles = $derived([
		{
			label: 'Followers', value: fmtFull(followerNow),
			delta: followerGain ? deltaPct(followerNow, followerStart) : null,
			sub: followerGain == null ? '' : `${followerGain >= 0 ? '+' : ''}${fmtFull(followerGain)} this period`,
			spark: followers.map((f) => f.value), color: SERIES[0]
		},
		{
			label: 'Reach', value: fmtFull(total.reach), delta: change(total.reach, prevTotal.reach),
			sub: 'accounts reached', spark: days.map((d) => d.reach), color: SERIES[1]
		},
		{
			label: 'Views', value: fmtFull(total.views), delta: change(total.views, prevTotal.views),
			sub: 'incl. repeats', spark: days.map((d) => d.views), color: SERIES[2]
		},
		{
			label: 'Interactions', value: fmtFull(total.interactions),
			delta: change(total.interactions, prevTotal.interactions),
			sub: 'likes, comments, saves, shares', spark: days.map((d) => d.total_interactions), color: SERIES[3]
		},
		{
			label: 'Engagement rate', value: fmtPct(engagement), delta: change(engagement, prevEngagement),
			sub: 'of reach, per post', spark: [], color: SERIES[4]
		},
		{
			label: 'Posts published', value: String(feed.length),
			delta: change(feed.length, prevFeed.length),
			sub: stories.length ? `+ ${stories.length} stor${stories.length === 1 ? 'y' : 'ies'}` : '', spark: [], color: SERIES[0]
		}
	]);

	// -------------------------------------------------------------- charts ---
	const TREND = {
		reach: { label: 'Reach', color: SERIES[1], pick: (d: IgDay) => d.reach },
		views: { label: 'Views', color: SERIES[2], pick: (d: IgDay) => d.views },
		total_interactions: { label: 'Interactions', color: SERIES[3], pick: (d: IgDay) => d.total_interactions },
		accounts_engaged: { label: 'Accounts engaged', color: SERIES[4], pick: (d: IgDay) => d.accounts_engaged }
	} as const;

	const trendSeries = $derived([
		{
			key: trendMetric, label: TREND[trendMetric].label, color: TREND[trendMetric].color,
			values: days.map(TREND[trendMetric].pick)
		}
	]);

	const followerChart = $derived([
		{ key: 'followers', label: 'Followers', color: SERIES[0], values: followers.map((f) => f.value) }
	]);
	const hasEstimatedFollowers = $derived(followers.some((f) => f.estimated && f.value != null));

	const interactionSeries = $derived([
		{ key: 'likes', label: 'Likes', color: SERIES[0], values: days.map((d) => d.likes) },
		{ key: 'comments', label: 'Comments', color: SERIES[1], values: days.map((d) => d.comments) },
		{ key: 'saves', label: 'Saves', color: SERIES[2], values: days.map((d) => d.saves) },
		{ key: 'shares', label: 'Shares', color: SERIES[3], values: days.map((d) => d.shares) }
	]);
	const hasInteractionSplit = $derived(interactionSeries.some((s) => s.values.some((v) => v != null && v > 0)));

	const formats = $derived(byFormat(feed, FEED_FORMATS).filter((f) => f.count > 0));
	const heat = $derived(postingHeatmap(feed));

	// ---------------------------------------------------------- leaderboard ---
	const LEADER = {
		reach: { label: 'Reach', pick: (m: IgMedia) => m.reach, fmt: fmtFull },
		views: { label: 'Views', pick: (m: IgMedia) => m.views, fmt: fmtFull },
		engagement: { label: 'Engagement rate', pick: engagementRate, fmt: (n: number | null) => fmtPct(n) },
		saved: { label: 'Saves', pick: (m: IgMedia) => m.saved, fmt: fmtFull },
		shares: { label: 'Shares', pick: (m: IgMedia) => m.shares, fmt: fmtFull }
	} as const;

	const topPosts = $derived(
		[...feed]
			.filter((m) => LEADER[leaderMetric].pick(m) != null)
			.sort((a, b) => (LEADER[leaderMetric].pick(b) ?? 0) - (LEADER[leaderMetric].pick(a) ?? 0))
			.slice(0, 8)
	);

	// ---------------------------------------------------------------- table ---
	const rows = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const list = media.filter(
			(m) =>
				(tableFormat === 'all' || m.format === tableFormat) &&
				(!q || (m.caption ?? '').toLowerCase().includes(q))
		);
		const key = {
			date: (m: IgMedia) => (m.timestamp ? Date.parse(m.timestamp) : 0),
			reach: (m: IgMedia) => m.reach ?? -1,
			views: (m: IgMedia) => m.views ?? -1,
			interactions: (m: IgMedia) => interactions(m),
			engagement: (m: IgMedia) => engagementRate(m) ?? -1
		}[tableSort];
		return [...list].sort((a, b) => key(b) - key(a));
	});

	// -------------------------------------------------------------- audience ---
	const audienceOf = (b: string, limit = 8) =>
		data.audience
			.filter((a) => a.breakdown === b)
			.slice(0, limit)
			.map((a) => ({ label: prettyBucket(b, a.bucket), value: a.value }));

	const REGION = new Intl.DisplayNames(['en'], { type: 'region' });
	function prettyBucket(breakdown: string, bucket: string): string {
		if (breakdown === 'country') {
			try {
				return REGION.of(bucket) ?? bucket;
			} catch {
				return bucket;
			}
		}
		if (breakdown === 'gender') return { F: 'Women', M: 'Men', U: 'Not specified' }[bucket] ?? bucket;
		return bucket;
	}
	const hasAudience = $derived(data.audience.length > 0);

	// ---------------------------------------------------------------- misc ---
	const storyStats = $derived({
		count: stories.length,
		reach: avg(stories, (s) => s.reach),
		replies: sum(stories, (s) => s.replies),
		taps: sum(stories, (s) => s.link_clicks),
		follows: sum(stories, (s) => s.follows)
	});

	const reelStats = $derived.by(() => {
		const reels = feed.filter((m) => m.format === 'reel' || m.format === 'video');
		return { count: reels.length, avgWatch: avg(reels, (r) => r.avg_watch_time), totalWatch: sum(reels, (r) => r.total_watch_time) };
	});

	const lastSyncAt = $derived(
		data.lastSync?.finished_at
			? new Date(data.lastSync.finished_at).toLocaleString('en-US', {
					timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
				})
			: null
	);

	const RANGES = [
		{ v: 7, label: '7d' },
		{ v: 30, label: '30d' },
		{ v: 90, label: '90d' },
		{ v: 365, label: '1y' }
	];
</script>

<svelte:head><title>Instagram — SGA Comms</title></svelte:head>

{#if !data.connected}
	<!-- ------------------------------------------------------------ setup -->
	<div class="mx-auto max-w-2xl">
		<h1 class="text-lg font-semibold">Instagram stats</h1>
		<p class="mt-1 text-sm text-stone-500">
			Connect the SGA Instagram account once and this page tracks every post, reel, carousel and
			story it publishes from then on.
		</p>

		<div class="mt-5 rounded-xl border border-stone-200 bg-white p-5">
			<h2 class="text-sm font-semibold text-stone-900">What you need</h2>
			<ol class="mt-2 space-y-1.5 text-sm text-stone-600">
				<li>1. The Instagram account must be a <strong>Business or Creator</strong> account — personal accounts have no stats API.</li>
				<li>2. A Meta app at <a class="text-maroon hover:underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a> with the Instagram product added.</li>
				<li>3. A <strong>long-lived access token</strong> with <code class="rounded bg-stone-100 px-1 text-xs">instagram_basic</code> and <code class="rounded bg-stone-100 px-1 text-xs">instagram_manage_insights</code>.</li>
				<li>4. The numeric <strong>Instagram account ID</strong> that token belongs to.</li>
			</ol>
			<p class="mt-3 text-xs text-stone-500">
				Facebook Login gives you story insights but needs the account linked to a Facebook Page.
				Instagram Login skips the Page and refreshes its own token, but has no story insights.
			</p>
		</div>

		{#if form?.error}
			<p class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
		{/if}

		<form method="POST" action="?/connect" use:enhance class="mt-4 space-y-3 rounded-xl border border-stone-200 bg-white p-5">
			<div>
				<label class="block text-sm font-medium text-stone-700" for="ig-base">Login path</label>
				<select id="ig-base" name="base" class="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-maroon focus:outline-none">
					<option value={FB_BASE}>Facebook Login — full insights incl. stories</option>
					<option value={IG_BASE}>Instagram Login — no Facebook Page needed</option>
				</select>
			</div>
			<div>
				<label class="block text-sm font-medium text-stone-700" for="ig-id">Instagram account ID</label>
				<input id="ig-id" name="user_id" inputmode="numeric" required placeholder="17841400000000000"
					class="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-sm focus:border-maroon focus:outline-none" />
			</div>
			<div>
				<label class="block text-sm font-medium text-stone-700" for="ig-token">Long-lived access token</label>
				<textarea id="ig-token" name="token" rows="3" required
					class="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-xs focus:border-maroon focus:outline-none"></textarea>
				<p class="mt-1 text-xs text-stone-500">Stored in the dashboard database, never shown again after saving.</p>
			</div>
			<button type="submit" class="rounded-md bg-maroon px-4 py-2 text-sm font-medium text-white hover:bg-maroon/90">
				Connect and verify
			</button>
		</form>
	</div>
{:else}
	<!-- ----------------------------------------------------------- header -->
	<div class="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
		{#if data.profile?.profile_picture_url}
			<img src={data.profile.profile_picture_url} alt="" class="size-12 rounded-full border border-stone-200 object-cover" />
		{/if}
		<div class="min-w-0">
			<h1 class="truncate text-lg font-semibold leading-tight">
				{data.profile?.name || 'Instagram'}
			</h1>
			<p class="text-sm text-stone-500">
				{#if data.profile?.username}
					<a href="https://instagram.com/{data.profile.username}" target="_blank" rel="noreferrer" class="hover:text-maroon">@{data.profile.username}</a>
					·
				{/if}
				{fmtFull(data.profile?.followers_count)} followers · {fmtFull(data.profile?.media_count)} posts
				{#if !data.mock && data.cachedMedia != null}
					· <span class="text-stone-400">{fmtFull(data.cachedMedia)} cached</span>
				{/if}
			</p>
		</div>

		<div class="ml-auto flex flex-wrap items-center gap-2">
			<div class="flex rounded-lg border border-stone-300 bg-white p-0.5" role="group" aria-label="Date range">
				{#each RANGES as r (r.v)}
					<a
						href="?range={r.v}"
						class="rounded-md px-2.5 py-1 text-sm {data.range === r.v ? 'bg-maroon font-medium text-white' : 'text-stone-600 hover:bg-stone-100'}"
						aria-current={data.range === r.v ? 'true' : undefined}
					>
						{r.label}
					</a>
				{/each}
			</div>
			{#if !data.mock}
			<form
				method="POST" action="?/sync"
				use:enhance={() => {
					syncing = true;
					return async ({ update }) => {
						await update();
						syncing = false;
					};
				}}
			>
				<input type="hidden" name="days" value={Math.max(90, data.range)} />
				<button type="submit" disabled={syncing}
					class="rounded-md bg-maroon px-3 py-1.5 text-sm font-medium text-white hover:bg-maroon/90 disabled:opacity-60">
					{syncing ? 'Syncing…' : 'Sync now'}
				</button>
			</form>
			<form
				method="POST" action="?/importAll"
				use:enhance={() => {
					importing = true;
					return async ({ update }) => {
						await update();
						importing = false;
					};
				}}
			>
				<button
					type="submit" disabled={importing || syncing}
					title="Pull the entire post history, then keep it fresh with Sync now"
					class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-60"
				>
					{importing ? 'Importing…' : 'Import all'}
				</button>
			</form>
			<button type="button" onclick={() => (showSettings = !showSettings)}
				class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100">
				Connection
			</button>
			{/if}
		</div>
	</div>

	{#if data.mock}
		<p class="mb-4 flex flex-wrap items-center gap-x-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
			<strong>Demo data.</strong> These numbers are generated, not from Instagram.
			<a href="/settings" class="font-medium underline">Turn it off in Settings</a>
			to see the real account.
		</p>
	{/if}

	<!-- ---------------------------------------------------------- notices -->
	{#if form?.error}
		<p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
			{form.error}
			{#if needsReauth}
				<span class="block text-xs">The access token has expired or been revoked — reconnect under “Connection”.</span>
			{/if}
		</p>
	{/if}
	{#if form?.ok && 'synced' in form}
		<p class="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{form.synced}</p>
	{/if}
	{#if data.lastSync && !data.lastSync.ok && data.lastSync.finished_at}
		<p class="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
			Last sync failed: {data.lastSync.message}
		</p>
	{/if}
	{#if data.pending > 0}
		<p class="mb-4 rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-600">
			{data.pending} post{data.pending === 1 ? '' : 's'} still waiting for metrics — the API is rate-limited, so
			they fill in over the next syncs.
		</p>
	{/if}

	{#if showSettings}
		<div class="mb-6 rounded-xl border border-stone-200 bg-white p-4 text-sm">
			<div class="flex flex-wrap items-center gap-x-6 gap-y-2">
				<p class="text-stone-600">
					Connected to <strong>@{data.profile?.username ?? '—'}</strong> via
					{data.apiBase === IG_BASE ? 'Instagram Login' : 'Facebook Login'}.
				</p>
				<p class="text-stone-500">
					{lastSyncAt ? `Last sync ${lastSyncAt} · ${data.lastSync?.calls ?? 0} API calls` : 'Never synced.'}
				</p>
				<div class="ml-auto flex gap-2">
					{#if data.apiBase === IG_BASE}
						<form method="POST" action="?/refreshToken" use:enhance>
							<button type="submit" class="rounded-md border border-stone-300 px-3 py-1.5 hover:bg-stone-100">Refresh token</button>
						</form>
					{/if}
					<button
						type="button"
						onclick={() => (replacingToken = !replacingToken)}
						class="rounded-md border border-stone-300 px-3 py-1.5 hover:bg-stone-100"
					>
						{replacingToken ? 'Cancel' : 'Replace token'}
					</button>
					<form method="POST" action="?/disconnect" use:enhance>
						<button type="submit" class="rounded-md border border-stone-300 px-3 py-1.5 text-red-700 hover:bg-red-50">Disconnect</button>
					</form>
				</div>
			</div>

			{#if replacingToken}
				<!-- Tokens expire every 60 days, so swapping one in has to be a normal
				     thing you can do, not a disconnect-and-set-up-again. -->
				<form
					method="POST" action="?/connect"
					use:enhance={() => async ({ update }) => {
						await update();
						replacingToken = false;
					}}
					class="mt-3 border-t border-stone-100 pt-3"
				>
					<input type="hidden" name="user_id" value={data.profile?.id ?? ''} />
					<input type="hidden" name="base" value={data.apiBase} />
					<label class="block text-sm font-medium text-stone-700" for="ig-new-token">
						New access token
					</label>
					<p class="mt-0.5 text-xs text-stone-500">
						Paste the long-lived token. It's verified against the API before it replaces the old
						one, and the account stays the same ({data.profile?.username ? '@' + data.profile.username : data.profile?.id}).
					</p>
					<textarea
						id="ig-new-token" name="token" rows="3" required
						class="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-xs focus:border-maroon focus:outline-none"
					></textarea>
					<button type="submit" class="mt-2 rounded-md bg-maroon px-4 py-1.5 text-sm font-medium text-white hover:bg-maroon/90">
						Verify and save
					</button>
				</form>
			{/if}
			<p class="mt-2 text-xs text-stone-400">
				Long-lived tokens expire after 60 days.
				{data.apiBase === IG_BASE
					? 'Refresh it here at least once every two months.'
					: 'Regenerate it in the Meta dashboard and reconnect before then.'}
			</p>
		</div>
	{/if}

	<!-- ------------------------------------------------------------ tiles -->
	<section class="grid grid-cols-2 gap-3 lg:grid-cols-6">
		{#each tiles as t (t.label)}
			<Stat label={t.label} value={t.value} delta={t.delta} sub={t.sub} spark={t.spark} color={t.color} />
		{/each}
	</section>

	<!-- ----------------------------------------------------------- trends -->
	<section class="mt-4 grid gap-4 lg:grid-cols-3">
		<div class="rounded-xl border border-stone-200 bg-white p-4 lg:col-span-2">
			<div class="mb-3 flex flex-wrap items-center gap-2">
				<h2 class="text-sm font-semibold text-stone-900">Daily performance</h2>
				<div class="ml-auto flex flex-wrap gap-1">
					{#each Object.entries(TREND) as [key, meta] (key)}
						<button type="button" onclick={() => (trendMetric = key as typeof trendMetric)}
							class="rounded-md px-2 py-1 text-xs {trendMetric === key ? 'bg-stone-900 font-medium text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}">
							{meta.label}
						</button>
					{/each}
				</div>
			</div>
			<Chart type="area" series={trendSeries} {labels} height={260} />
		</div>

		<div class="rounded-xl border border-stone-200 bg-white p-4">
			<h2 class="mb-1 text-sm font-semibold text-stone-900">Follower growth</h2>
			<p class="mb-2 text-xs text-stone-500">
				{followerGain == null ? 'No follower history yet.' : `${followerGain >= 0 ? '+' : ''}${fmtFull(followerGain)} over ${data.range} days`}
			</p>
			<Chart type="line" series={followerChart} {labels} height={214} legend={false} zeroBaseline={false} />
			{#if hasEstimatedFollowers}
				<p class="mt-1 text-[11px] text-stone-400">
					Days before this dashboard started syncing are reconstructed from daily follows and unfollows.
				</p>
			{/if}
		</div>
	</section>

	<!-- ---------------------------------------------- interactions + format -->
	<section class="mt-4 grid gap-4 lg:grid-cols-2">
		<div class="rounded-xl border border-stone-200 bg-white p-4">
			<h2 class="mb-3 text-sm font-semibold text-stone-900">What people did</h2>
			{#if hasInteractionSplit}
				<Chart type="stacked" series={interactionSeries} {labels} height={240} />
			{:else}
				<p class="text-sm text-stone-500">
					No interaction split yet — run a sync to pull daily account metrics.
				</p>
			{/if}
		</div>

		<div class="rounded-xl border border-stone-200 bg-white p-4">
			<h2 class="mb-1 text-sm font-semibold text-stone-900">Which format works</h2>
			<p class="mb-3 text-xs text-stone-500">Average reach per post, this period</p>
			<Bars
				rows={formats.map((f) => ({
					label: f.label,
					value: Math.round(f.avgReach ?? 0),
					color: f.color,
					sub: `${f.count} post${f.count === 1 ? '' : 's'}`
				}))}
				empty="Nothing published in this range."
			/>
			{#if formats.length}
				<!-- The table is also the relief for the lighter palette slots: every
				     bar's number is readable without relying on its colour. -->
				<table class="mt-4 w-full text-sm">
					<thead>
						<tr class="border-b border-stone-100 text-left text-[11px] uppercase tracking-wide text-stone-400">
							<th class="pb-1 font-medium">Format</th>
							<th class="pb-1 text-right font-medium">Posts</th>
							<th class="pb-1 text-right font-medium">Avg reach</th>
							<th class="pb-1 text-right font-medium">Avg eng.</th>
						</tr>
					</thead>
					<tbody>
						{#each formats as f (f.format)}
							<tr class="border-b border-stone-50 last:border-0">
								<td class="py-1.5">
									<span class="mr-1.5 inline-block size-2 rounded-[2px] align-middle" style="background:{f.color}"></span>{f.label}
								</td>
								<td class="py-1.5 text-right tabular-nums">{f.count}</td>
								<td class="py-1.5 text-right tabular-nums">{fmtFull(f.avgReach)}</td>
								<td class="py-1.5 text-right tabular-nums">{fmtPct(f.engagement)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</section>

	<!-- ------------------------------------------------- timing + audience -->
	<section class="mt-4 grid gap-4 lg:grid-cols-2">
		<div class="rounded-xl border border-stone-200 bg-white p-4">
			<h2 class="mb-1 text-sm font-semibold text-stone-900">When to post</h2>
			<p class="mb-3 text-xs text-stone-500">Every post in range, bucketed by when it went up (Elon time)</p>
			{#if heat.max > 0}
				<Heatmap cells={heat.cells} max={heat.max} />
			{:else}
				<p class="text-sm text-stone-500">Not enough posts with reach data yet.</p>
			{/if}
		</div>

		<div class="rounded-xl border border-stone-200 bg-white p-4">
			<h2 class="mb-3 text-sm font-semibold text-stone-900">Audience</h2>
			{#if hasAudience}
				<div class="grid gap-5 sm:grid-cols-2">
					<div>
						<h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Age</h3>
						<Bars rows={audienceOf('age')} color={SERIES[1]} />
					</div>
					<div>
						<h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Gender</h3>
						<Bars rows={audienceOf('gender', 3)} color={SERIES[4]} />
					</div>
					<div>
						<h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Top cities</h3>
						<Bars rows={audienceOf('city', 6)} color={SERIES[2]} />
					</div>
					<div>
						<h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Top countries</h3>
						<Bars rows={audienceOf('country', 6)} color={SERIES[3]} />
					</div>
				</div>
			{:else}
				<p class="text-sm text-stone-500">
					Meta only returns demographics once the account passes roughly 100 followers, and only for
					the Facebook Login path. Nothing to show yet.
				</p>
			{/if}
		</div>
	</section>

	<!-- --------------------------------------------------- stories + reels -->
	{#if stories.length || reelStats.count}
		<section class="mt-4 grid gap-4 sm:grid-cols-2">
			{#if stories.length}
				<div class="rounded-xl border border-stone-200 bg-white p-4">
					<h2 class="mb-1 text-sm font-semibold text-stone-900">Stories</h2>
					<p class="mb-3 text-xs text-stone-500">
						Story metrics only exist for 24 hours — these are the ones a sync caught in time.
					</p>
					<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{#each [['Stories', String(storyStats.count)], ['Avg reach', fmtFull(storyStats.reach)], ['Replies', fmtFull(storyStats.replies)], ['Link taps', fmtFull(storyStats.taps)]] as [k, v] (k)}
							<div class="rounded-lg bg-stone-50 p-2.5">
								<dt class="text-[11px] uppercase tracking-wide text-stone-500">{k}</dt>
								<dd class="text-lg font-semibold tabular-nums text-stone-900">{v}</dd>
							</div>
						{/each}
					</dl>
				</div>
			{/if}
			{#if reelStats.count}
				<div class="rounded-xl border border-stone-200 bg-white p-4">
					<h2 class="mb-1 text-sm font-semibold text-stone-900">Video watch time</h2>
					<p class="mb-3 text-xs text-stone-500">Across {reelStats.count} reel{reelStats.count === 1 ? '' : 's'} and videos</p>
					<dl class="grid grid-cols-2 gap-3">
						<div class="rounded-lg bg-stone-50 p-2.5">
							<dt class="text-[11px] uppercase tracking-wide text-stone-500">Avg watch time</dt>
							<dd class="text-lg font-semibold text-stone-900">{fmtDuration(reelStats.avgWatch)}</dd>
						</div>
						<div class="rounded-lg bg-stone-50 p-2.5">
							<dt class="text-[11px] uppercase tracking-wide text-stone-500">Total watch time</dt>
							<dd class="text-lg font-semibold text-stone-900">{fmtDuration(reelStats.totalWatch)}</dd>
						</div>
					</dl>
				</div>
			{/if}
		</section>
	{/if}

	<!-- ------------------------------------------------------- leaderboard -->
	<section class="mt-4 rounded-xl border border-stone-200 bg-white p-4">
		<div class="mb-3 flex flex-wrap items-center gap-2">
			<h2 class="text-sm font-semibold text-stone-900">Top posts</h2>
			<div class="ml-auto flex flex-wrap gap-1">
				{#each Object.entries(LEADER) as [key, meta] (key)}
					<button type="button" onclick={() => (leaderMetric = key as typeof leaderMetric)}
						class="rounded-md px-2 py-1 text-xs {leaderMetric === key ? 'bg-stone-900 font-medium text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}">
						{meta.label}
					</button>
				{/each}
			</div>
		</div>
		{#if topPosts.length}
			<ul class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
				{#each topPosts as post, i (post.id)}
					<li>
						<button type="button" onclick={() => (selected = post)} class="group w-full text-left">
							<div class="relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
								{#if post.thumbnail_url || post.media_url}
									<img src={post.thumbnail_url || post.media_url} alt="" loading="lazy"
										class="size-full object-cover transition group-hover:scale-105" />
								{/if}
								<span class="absolute left-1.5 top-1.5 rounded bg-stone-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
									#{i + 1}
								</span>
								<span class="absolute bottom-1.5 right-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
									style="background:{FORMATS[post.format].color}">
									{FORMATS[post.format].label}
								</span>
							</div>
							<p class="mt-1.5 text-sm font-semibold tabular-nums text-stone-900">
								{LEADER[leaderMetric].fmt(LEADER[leaderMetric].pick(post) as number)}
							</p>
							<p class="truncate text-xs text-stone-500">{post.caption || 'No caption'}</p>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-stone-500">No posts with metrics in this range yet.</p>
		{/if}
	</section>

	<!-- ------------------------------------------------------- every post -->
	<section class="mt-4 rounded-xl border border-stone-200 bg-white">
		<div class="flex flex-wrap items-center gap-2 border-b border-stone-100 p-4">
			<h2 class="text-sm font-semibold text-stone-900">Every post <span class="font-normal text-stone-400">({rows.length})</span></h2>
			<div class="ml-auto flex flex-wrap items-center gap-2">
				<input bind:value={query} placeholder="Search captions" aria-label="Search captions"
					class="w-40 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm focus:border-maroon focus:outline-none" />
				<select bind:value={tableFormat} aria-label="Filter by format"
					class="rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-maroon focus:outline-none">
					<option value="all">All formats</option>
					{#each FORMAT_KEYS as f (f)}<option value={f}>{FORMATS[f].plural}</option>{/each}
				</select>
				<select bind:value={tableSort} aria-label="Sort by"
					class="rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-maroon focus:outline-none">
					<option value="date">Newest</option>
					<option value="reach">Reach</option>
					<option value="views">Views</option>
					<option value="interactions">Interactions</option>
					<option value="engagement">Engagement</option>
				</select>
			</div>
		</div>

		{#if rows.length}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left text-[11px] uppercase tracking-wide text-stone-400">
							<th class="py-2 pl-4 pr-2 font-medium">Post</th>
							<th class="hidden px-2 py-2 font-medium sm:table-cell">Date</th>
							<th class="px-2 py-2 text-right font-medium">Reach</th>
							<th class="hidden px-2 py-2 text-right font-medium sm:table-cell">Views</th>
							<th class="hidden px-2 py-2 text-right font-medium md:table-cell">Likes</th>
							<th class="hidden px-2 py-2 text-right font-medium md:table-cell">Comments</th>
							<th class="hidden px-2 py-2 text-right font-medium lg:table-cell">Saves</th>
							<th class="hidden px-2 py-2 text-right font-medium lg:table-cell">Shares</th>
							<th class="py-2 pl-2 pr-4 text-right font-medium">Eng.</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as post (post.id)}
							<tr class="cursor-pointer border-t border-stone-100 hover:bg-stone-50" onclick={() => (selected = post)}>
								<td class="py-2 pl-4 pr-2">
									<div class="flex items-center gap-2.5">
										<div class="size-9 shrink-0 overflow-hidden rounded border border-stone-200 bg-stone-100">
											{#if post.thumbnail_url || post.media_url}
												<img src={post.thumbnail_url || post.media_url} alt="" loading="lazy" class="size-full object-cover" />
											{/if}
										</div>
										<div class="min-w-0">
											<p class="max-w-56 truncate text-stone-800">{post.caption || 'No caption'}</p>
											<p class="text-xs text-stone-400">
												<span class="mr-1 inline-block size-1.5 rounded-full align-middle" style="background:{FORMATS[post.format].color}"></span>
												{FORMATS[post.format].label}
												<span class="sm:hidden"> · {post.posted_date ? shortDate(post.posted_date) : '—'}</span>
											</p>
										</div>
									</div>
								</td>
								<td class="hidden whitespace-nowrap px-2 py-2 text-stone-500 sm:table-cell">
									{post.posted_date ? shortDate(post.posted_date) : '—'}
								</td>
								<td class="px-2 py-2 text-right tabular-nums">{fmtNum(post.reach)}</td>
								<td class="hidden px-2 py-2 text-right tabular-nums sm:table-cell">{fmtNum(post.views)}</td>
								<td class="hidden px-2 py-2 text-right tabular-nums md:table-cell">{fmtNum(post.like_count)}</td>
								<td class="hidden px-2 py-2 text-right tabular-nums md:table-cell">{fmtNum(post.comments_count)}</td>
								<td class="hidden px-2 py-2 text-right tabular-nums lg:table-cell">{fmtNum(post.saved)}</td>
								<td class="hidden px-2 py-2 text-right tabular-nums lg:table-cell">{fmtNum(post.shares)}</td>
								<td class="py-2 pl-2 pr-4 text-right tabular-nums font-medium">{fmtPct(engagementRate(post))}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="p-4 text-sm text-stone-500">
				{data.media.length ? 'Nothing matches those filters.' : 'No posts synced yet — hit “Sync now”.'}
			</p>
		{/if}
	</section>

	{#if selected}
		<PostDrawer media={selected} followers={followerNow} onclose={() => (selected = null)} />
	{/if}
{/if}
