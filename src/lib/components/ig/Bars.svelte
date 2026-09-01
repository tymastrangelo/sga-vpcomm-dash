<script lang="ts">
	// Horizontal bars for ranked categories. Every bar is directly labelled with
	// its value, which is also the relief the palette's lighter hues require.
	let {
		rows = [],
		format = (n: number) => n.toLocaleString('en-US'),
		color = '#a8102a',
		max: fixedMax = null,
		empty = 'No data yet.'
	}: {
		rows: { label: string; value: number; color?: string; sub?: string }[];
		format?: (n: number) => string;
		color?: string;
		max?: number | null;
		empty?: string;
	} = $props();

	const max = $derived(fixedMax ?? Math.max(1, ...rows.map((r) => r.value)));
</script>

{#if rows.length}
	<ul class="space-y-2.5">
		{#each rows as row (row.label)}
			<li>
				<div class="flex items-baseline justify-between gap-3 text-sm">
					<span class="truncate text-stone-700">{row.label}</span>
					<span class="shrink-0 tabular-nums font-medium text-stone-900">{format(row.value)}</span>
				</div>
				<div class="mt-1 flex items-center gap-2">
					<div class="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
						<div
							class="h-full rounded-full"
							style="width:{Math.max(1.5, (row.value / max) * 100)}%;background:{row.color ?? color}"
						></div>
					</div>
					{#if row.sub}<span class="w-16 shrink-0 text-right text-xs text-stone-400">{row.sub}</span>{/if}
				</div>
			</li>
		{/each}
	</ul>
{:else}
	<p class="text-sm text-stone-500">{empty}</p>
{/if}
