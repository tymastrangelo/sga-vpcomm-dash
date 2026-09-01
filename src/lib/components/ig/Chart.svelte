<script lang="ts">
	// One SVG chart for the whole dashboard: line, area, bars and stacked bars.
	// No chart library — the shapes are a handful of path strings, and rolling
	// them keeps the marks to spec (2px strokes, 2px gaps between stacked
	// segments, rounded data-ends, recessive grid) instead of fighting defaults.
	import { fmtNum, fmtFull, niceTicks } from '$lib/instagram';

	interface Series {
		key: string;
		label: string;
		color: string;
		values: (number | null)[];
		/** Render as a dashed line — used for reconstructed follower history. */
		dashedFrom?: number;
	}

	let {
		type = 'line',
		series = [],
		labels = [],
		height = 240,
		format = fmtFull,
		yLabel = '',
		legend = true,
		zeroBaseline = true
	}: {
		type?: 'line' | 'area' | 'bar' | 'stacked';
		series: Series[];
		labels: string[];
		height?: number;
		format?: (n: number | null | undefined) => string;
		yLabel?: string;
		legend?: boolean;
		/** Bars must sit on zero; a follower count near 2,400 must not. */
		zeroBaseline?: boolean;
	} = $props();

	let width = $state(720);
	let hover = $state<number | null>(null);

	const PAD = { top: 12, right: 8, bottom: 22, left: 44 };
	const plotW = $derived(Math.max(40, width - PAD.left - PAD.right));
	const plotH = $derived(Math.max(40, height - PAD.top - PAD.bottom));
	const count = $derived(labels.length);

	const extent = $derived.by(() => {
		let hi = 0;
		let lo = Infinity;
		if (type === 'stacked') {
			for (let i = 0; i < count; i++) {
				const total = series.reduce((t, s) => t + (s.values[i] ?? 0), 0);
				if (total > hi) hi = total;
			}
			lo = 0;
		} else {
			for (const s of series)
				for (const v of s.values)
					if (v != null) {
						if (v > hi) hi = v;
						if (v < lo) lo = v;
					}
		}
		return { lo: Number.isFinite(lo) ? lo : 0, hi: hi || 1 };
	});

	const ticks = $derived(niceTicks(zeroBaseline ? 0 : extent.lo, extent.hi));
	const axisMin = $derived(ticks[0]);
	const axisMax = $derived(ticks[ticks.length - 1]);

	const y = (v: number) => PAD.top + plotH - ((v - axisMin) / (axisMax - axisMin || 1)) * plotH;
	const x = (i: number) =>
		count <= 1 ? PAD.left + plotW / 2 : PAD.left + (i / (count - 1)) * plotW;
	const bandW = $derived(count ? plotW / count : plotW);
	const barX = (i: number) => PAD.left + i * bandW;

	/** Break the path at nulls so a gap in the data reads as a gap, not a line. */
	function linePath(values: (number | null)[]): string {
		let d = '';
		let pen = false;
		values.forEach((v, i) => {
			if (v == null) {
				pen = false;
				return;
			}
			d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
			pen = true;
		});
		return d;
	}

	function areaPath(values: (number | null)[]): string {
		const pts = values.map((v, i) => ({ v, i })).filter((p) => p.v != null);
		if (pts.length < 2) return '';
		const top = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v!).toFixed(1)}`).join('');
		return `${top}L${x(pts[pts.length - 1].i).toFixed(1)},${y(axisMin)}L${x(pts[0].i).toFixed(1)},${y(axisMin)}Z`;
	}

	// Stacked segments, bottom-up, with a 2px surface gap between them.
	function stackFor(i: number) {
		let acc = 0;
		return series.map((s) => {
			const v = s.values[i] ?? 0;
			const y0 = y(acc);
			acc += v;
			const y1 = y(acc);
			return { key: s.key, color: s.color, value: v, top: y1, height: Math.max(0, y0 - y1 - 2) };
		});
	}

	const barW = $derived(Math.max(2, Math.min(28, bandW - 4)));

	function onMove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const rel = e.clientX - rect.left - PAD.left;
		if (!count) return;
		hover = Math.max(0, Math.min(count - 1, Math.round((rel / plotW) * (count - 1))));
		if (type === 'bar' || type === 'stacked') hover = Math.max(0, Math.min(count - 1, Math.floor(rel / bandW)));
	}

	const tipLeft = $derived(hover == null ? 0 : Math.min(Math.max(x(hover), 70), width - 70));
	const hoverTotal = $derived(
		hover == null ? 0 : series.reduce((t, s) => t + (s.values[hover!] ?? 0), 0)
	);
	// Only label a handful of x positions — a tick per day is unreadable.
	const xTickEvery = $derived(Math.max(1, Math.ceil(count / Math.max(2, Math.floor(width / 90)))));
</script>

<div class="relative" bind:clientWidth={width}>
	{#if legend && series.length > 1}
		<div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
			{#each series as s (s.key)}
				<span class="inline-flex items-center gap-1.5">
					<span class="size-2.5 rounded-[2px]" style="background:{s.color}"></span>{s.label}
				</span>
			{/each}
		</div>
	{/if}

	<svg
		{width}
		{height}
		role="img"
		aria-label={series.map((s) => s.label).join(', ')}
		onpointermove={onMove}
		onpointerleave={() => (hover = null)}
		class="touch-pan-y select-none"
	>
		<!-- grid + y axis -->
		{#each ticks as t (t)}
			<line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#e7e5e4" stroke-width="1" />
			<text x={PAD.left - 8} y={y(t) + 4} text-anchor="end" class="fill-stone-400 text-[10px] tabular-nums">
				{fmtNum(t)}
			</text>
		{/each}

		{#if type === 'stacked'}
			{#each labels as _, i (i)}
				{#each stackFor(i) as seg (seg.key)}
					{#if seg.height > 0}
						<rect
							x={barX(i) + (bandW - barW) / 2} y={seg.top} width={barW} height={seg.height}
							rx="2" fill={seg.color} opacity={hover == null || hover === i ? 1 : 0.35}
						/>
					{/if}
				{/each}
			{/each}
		{:else if type === 'bar'}
			{#each series as s (s.key)}
				{#each s.values as v, i (i)}
					{#if v != null && v > 0}
						<rect
							x={barX(i) + (bandW - barW) / 2} y={y(v)} width={barW} height={Math.max(1, y(axisMin) - y(v))}
							rx="4" fill={s.color} opacity={hover == null || hover === i ? 1 : 0.35}
						/>
					{/if}
				{/each}
			{/each}
		{:else}
			{#each series as s (s.key)}
				{#if type === 'area'}
					<path d={areaPath(s.values)} fill={s.color} opacity="0.12" />
				{/if}
				<path
					d={linePath(s.values)} fill="none" stroke={s.color} stroke-width="2"
					stroke-linecap="round" stroke-linejoin="round"
				/>
			{/each}
		{/if}

		<!-- axis baseline sits above the marks so bars read as anchored -->
		<line x1={PAD.left} x2={width - PAD.right} y1={y(axisMin)} y2={y(axisMin)} stroke="#d6d3d1" stroke-width="1" />

		{#if hover != null && (type === 'line' || type === 'area')}
			<line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(axisMin)} stroke="#a8a29e" stroke-width="1" stroke-dasharray="3 3" />
			{#each series as s (s.key)}
				{#if s.values[hover] != null}
					<circle cx={x(hover)} cy={y(s.values[hover]!)} r="4.5" fill={s.color} stroke="#fff" stroke-width="2" />
				{/if}
			{/each}
		{/if}

		{#each labels as label, i (i)}
			{#if i % xTickEvery === 0}
				<text
					x={type === 'bar' || type === 'stacked' ? barX(i) + bandW / 2 : x(i)}
					y={height - 6} text-anchor="middle" class="fill-stone-400 text-[10px]"
				>
					{label}
				</text>
			{/if}
		{/each}
	</svg>

	{#if hover != null}
		<div
			class="pointer-events-none absolute top-0 z-10 min-w-32 -translate-x-1/2 rounded-lg border border-stone-200 bg-white/95 px-2.5 py-2 text-xs shadow-lg backdrop-blur"
			style="left:{tipLeft}px"
		>
			<p class="mb-1 font-medium text-stone-900">{labels[hover]}</p>
			{#each series as s (s.key)}
				<p class="flex items-center gap-2 whitespace-nowrap text-stone-600">
					<span class="size-2 rounded-[2px]" style="background:{s.color}"></span>
					<span class="flex-1">{s.label}</span>
					<span class="font-medium tabular-nums text-stone-900">{format(s.values[hover])}</span>
				</p>
			{/each}
			{#if type === 'stacked' && series.length > 1}
				<p class="mt-1 flex justify-between gap-2 border-t border-stone-100 pt-1 font-medium text-stone-900">
					<span>Total</span><span class="tabular-nums">{format(hoverTotal)}</span>
				</p>
			{/if}
		</div>
	{/if}

	{#if yLabel}
		<p class="mt-1 text-[11px] text-stone-400">{yLabel}</p>
	{/if}
</div>
