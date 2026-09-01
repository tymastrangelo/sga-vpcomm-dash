<script lang="ts">
	// Everything the API knows about one post. The typed columns drive the top
	// grid; metrics_json fills the rest, so a format with metrics we never
	// modelled (new Meta metric, story navigation breakdowns) still shows up.
	import {
		FORMATS, fmtFull, fmtDuration, fmtPct, formatMetric, metricLabel, METRIC_LABELS,
		engagementRate, engagementByFollowers, interactions, type IgMedia
	} from '$lib/instagram';

	let { media, followers, onclose }: { media: IgMedia; followers: number | null; onclose: () => void } = $props();

	const meta = $derived(FORMATS[media.format]);
	const extra = $derived.by(() => {
		let parsed: Record<string, unknown> = {};
		try {
			parsed = media.metrics_json ? JSON.parse(media.metrics_json) : {};
		} catch {
			parsed = {};
		}
		return Object.entries(parsed).filter(([, v]) => v != null);
	});

	const posted = $derived(
		media.timestamp
			? new Date(media.timestamp).toLocaleString('en-US', {
					timeZone: 'America/New_York', weekday: 'short', month: 'short',
					day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
				})
			: '—'
	);

	const headline = $derived([
		{ label: 'Reach', value: fmtFull(media.reach) },
		{ label: 'Views', value: fmtFull(media.views) },
		{ label: 'Interactions', value: fmtFull(interactions(media)) },
		{ label: 'Engagement', value: fmtPct(engagementRate(media)), sub: 'of reach' }
	]);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-[2px]" onclick={onclose}></div>
<aside
	class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-stone-200 bg-white shadow-2xl sm:max-w-lg"
	aria-label="Post detail"
>
	<header class="flex items-start gap-3 border-b border-stone-200 p-4">
		<span
			class="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-white"
			style="background:{meta.color}"
		>
			{meta.label}
		</span>
		<div class="min-w-0 flex-1">
			<p class="text-sm text-stone-500">{posted}</p>
			{#if media.permalink}
				<a href={media.permalink} target="_blank" rel="noreferrer" class="text-sm text-maroon hover:underline">
					Open on Instagram ↗
				</a>
			{/if}
		</div>
		<button type="button" onclick={onclose} aria-label="Close" class="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700">✕</button>
	</header>

	<div class="flex-1 overflow-y-auto p-4">
		<div class="flex gap-4">
			{#if media.thumbnail_url || media.media_url}
				<img
					src={media.thumbnail_url || media.media_url}
					alt=""
					class="size-24 shrink-0 rounded-lg border border-stone-200 object-cover"
					loading="lazy"
				/>
			{/if}
			<p class="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
				{media.caption?.slice(0, 400) || 'No caption.'}{(media.caption?.length ?? 0) > 400 ? '…' : ''}
			</p>
		</div>

		<div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
			{#each headline as h (h.label)}
				<div class="rounded-lg bg-stone-50 p-2.5">
					<p class="text-[11px] uppercase tracking-wide text-stone-500">{h.label}</p>
					<p class="text-lg font-semibold tabular-nums text-stone-900">{h.value}</p>
					{#if h.sub}<p class="text-[11px] text-stone-400">{h.sub}</p>{/if}
				</div>
			{/each}
		</div>

		{#if media.avg_watch_time != null || media.total_watch_time != null}
			<div class="mt-3 grid grid-cols-2 gap-2">
				<div class="rounded-lg bg-stone-50 p-2.5">
					<p class="text-[11px] uppercase tracking-wide text-stone-500">Avg watch time</p>
					<p class="text-lg font-semibold text-stone-900">{fmtDuration(media.avg_watch_time)}</p>
				</div>
				<div class="rounded-lg bg-stone-50 p-2.5">
					<p class="text-[11px] uppercase tracking-wide text-stone-500">Total watch time</p>
					<p class="text-lg font-semibold text-stone-900">{fmtDuration(media.total_watch_time)}</p>
				</div>
			</div>
		{/if}

		<h3 class="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">All metrics</h3>
		<dl class="divide-y divide-stone-100 text-sm">
			<div class="flex justify-between gap-4 py-1.5">
				<dt class="text-stone-600">Likes</dt>
				<dd class="tabular-nums font-medium">{fmtFull(media.like_count)}</dd>
			</div>
			<div class="flex justify-between gap-4 py-1.5">
				<dt class="text-stone-600">Comments</dt>
				<dd class="tabular-nums font-medium">{fmtFull(media.comments_count)}</dd>
			</div>
			{#each extra as [key, value] (key)}
				{#if typeof value === 'number'}
					<div class="flex justify-between gap-4 py-1.5">
						<dt class="text-stone-600" title={METRIC_LABELS[key]?.help ?? ''}>{metricLabel(key)}</dt>
						<dd class="tabular-nums font-medium">{formatMetric(key, value)}</dd>
					</div>
				{:else if value && typeof value === 'object'}
					<div class="py-1.5">
						<dt class="mb-1 text-stone-600">{metricLabel(key)}</dt>
						<dd class="space-y-0.5 pl-3">
							{#each Object.entries(value as Record<string, number>) as [bucket, n] (bucket)}
								<p class="flex justify-between gap-4 text-stone-500">
									<span>{bucket.toLowerCase().replace(/_/g, ' ')}</span>
									<span class="tabular-nums font-medium text-stone-800">{fmtFull(n)}</span>
								</p>
							{/each}
						</dd>
					</div>
				{/if}
			{/each}
			{#if followers}
				<div class="flex justify-between gap-4 py-1.5">
					<dt class="text-stone-600">Engagement (of followers)</dt>
					<dd class="tabular-nums font-medium">{fmtPct(engagementByFollowers(media, followers))}</dd>
				</div>
			{/if}
			{#if media.children_count}
				<div class="flex justify-between gap-4 py-1.5">
					<dt class="text-stone-600">Slides</dt>
					<dd class="tabular-nums font-medium">{media.children_count}</dd>
				</div>
			{/if}
		</dl>

		<p class="mt-4 text-[11px] text-stone-400">
			{media.insights_at ? `Metrics last refreshed ${new Date(media.insights_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}.` : 'Insights not fetched yet — run a sync.'}
		</p>
	</div>
</aside>
