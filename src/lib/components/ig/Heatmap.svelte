<script lang="ts">
	// Average reach by weekday × 3-hour block. Sequential single-hue ramp: light
	// means low, dark means high — never a rainbow.
	import { DOW, HOUR_BLOCKS, RAMP, fmtNum } from '$lib/instagram';

	let { cells, max }: { cells: { dow: number; block: number; count: number; avgReach: number | null }[][]; max: number } = $props();

	function fill(v: number | null): string {
		if (v == null) return '#fafaf9';
		const step = Math.min(RAMP.length - 1, Math.round((v / (max || 1)) * (RAMP.length - 1)));
		return RAMP[step];
	}
	// The top two ramp steps are dark enough that black text on them fails.
	const light = (v: number | null) => v == null || v / (max || 1) < 0.6;
</script>

<div class="overflow-x-auto">
	<table class="w-full min-w-105 border-separate border-spacing-1 text-center text-[11px]">
		<thead>
			<tr>
				<th class="w-10"></th>
				{#each HOUR_BLOCKS as b (b.start)}
					<th class="pb-0.5 font-medium text-stone-400">{b.label}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each cells as row, dow (dow)}
				<tr>
					<th class="pr-1 text-right font-medium text-stone-500">{DOW[dow]}</th>
					{#each row as cell (cell.block)}
						<td
							class="h-9 rounded-md tabular-nums {light(cell.avgReach) ? 'text-stone-600' : 'text-white'}"
							style="background:{fill(cell.avgReach)}"
							title={cell.count
								? `${DOW[dow]} ${HOUR_BLOCKS[cell.block].label} — ${cell.count} post${cell.count === 1 ? '' : 's'}, avg reach ${Math.round(cell.avgReach ?? 0).toLocaleString('en-US')}`
								: `${DOW[dow]} ${HOUR_BLOCKS[cell.block].label} — nothing posted`}
						>
							{cell.count ? fmtNum(cell.avgReach) : ''}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
<p class="mt-2 flex items-center gap-2 text-[11px] text-stone-400">
	Avg reach per post
	<span class="flex items-center gap-0.5">
		{#each RAMP as step (step)}<span class="size-3 rounded-[2px]" style="background:{step}"></span>{/each}
	</span>
	low → high · blank means nothing posted then
</p>
