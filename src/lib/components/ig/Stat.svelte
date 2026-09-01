<script lang="ts">
	// Headline number + its trend. The sparkline carries shape only (no axis, no
	// hover) — the full chart below the tiles is where you read exact values.
	import { fmtDelta } from '$lib/instagram';

	let {
		label,
		value,
		delta = null,
		sub = '',
		spark = [],
		color = '#73000a',
		invert = false
	}: {
		label: string;
		value: string;
		delta?: number | null;
		sub?: string;
		spark?: (number | null)[];
		color?: string;
		/** For metrics where down is good (unfollows). */
		invert?: boolean;
	} = $props();

	const good = $derived(delta == null ? null : invert ? delta < 0 : delta > 0);

	// Inset by half the stroke width on every side, so a 2px line at the very
	// edge of the data range still paints fully inside the box.
	const W = 72;
	const H = 26;
	const INSET = 1.5;

	const path = $derived.by(() => {
		const pts = spark.map((v, i) => ({ v, i })).filter((p) => p.v != null) as { v: number; i: number }[];
		if (pts.length < 2) return '';
		const lo = Math.min(...pts.map((p) => p.v));
		const hi = Math.max(...pts.map((p) => p.v));
		const span = hi - lo || 1;
		const n = spark.length - 1 || 1;
		const x = (i: number) => INSET + (i / n) * (W - INSET * 2);
		const y = (v: number) => H - INSET - ((v - lo) / span) * (H - INSET * 2);
		return pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
	});
</script>

<div class="flex h-full flex-col rounded-xl border border-stone-200 bg-white p-4">
	<p class="truncate text-xs font-medium uppercase tracking-wide text-stone-500" title={label}>{label}</p>

	<!-- The number owns the full width; the sparkline gets its own row underneath.
	     Side by side, a six-figure value and a fixed 72px spark fought over ~170px
	     of card and the value lost. -->
	<p class="mt-1.5 text-2xl font-semibold tabular-nums whitespace-nowrap text-stone-900">{value}</p>

	{#if path}
		<svg
			viewBox="0 0 {W} {H}" preserveAspectRatio="none"
			class="mt-1.5 h-6 w-full" aria-hidden="true"
		>
			<!-- non-scaling-stroke keeps the 2px line even after the horizontal stretch -->
			<path
				d={path} fill="none" stroke={color} stroke-width="2"
				stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"
			/>
		</svg>
	{/if}

	<div class="mt-auto flex items-center gap-2 pt-1.5 text-xs">
		{#if delta != null}
			<span
				class="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium
					{good ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}"
			>
				<span aria-hidden="true">{delta > 0 ? '\u25b2' : delta < 0 ? '\u25bc' : '\u00b7'}</span>{fmtDelta(delta)}
			</span>
		{/if}
		{#if sub}<span class="min-w-0 truncate text-stone-500" title={sub}>{sub}</span>{/if}
	</div>
</div>
