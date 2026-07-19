<script lang="ts">
	import type { Tag } from '$lib/meta';

	let {
		name = 'color',
		value = '',
		tags,
		allowNone = true
	}: {
		name?: string;
		value?: string;
		tags: Tag[];
		allowNone?: boolean;
	} = $props();

	// svelte-ignore state_referenced_locally -- initial value only; swatch clicks own it after
	let current = $state(value ?? '');
	const isPreset = $derived(tags.some((t) => t.color.toLowerCase() === current.toLowerCase()));
</script>

<input type="hidden" {name} value={current} />

<div class="mt-1 flex flex-wrap items-center gap-1.5">
	{#if allowNone}
		<button
			type="button"
			title="No color"
			aria-label="No color"
			onclick={() => (current = '')}
			class="grid size-7 place-items-center rounded-full border text-xs text-stone-400
				{current === '' ? 'border-maroon ring-2 ring-maroon/40' : 'border-stone-300'}"
		>
			—
		</button>
	{/if}

	{#each tags as tag (tag.id)}
		<button
			type="button"
			title={tag.label}
			aria-label={tag.label}
			onclick={() => (current = tag.color)}
			class="size-7 rounded-full border border-black/10
				{current.toLowerCase() === tag.color.toLowerCase() ? 'ring-2 ring-maroon/60 ring-offset-1' : ''}"
			style="background: {tag.color}"
		></button>
	{/each}

	<label
		title="Custom color"
		class="relative grid size-7 cursor-pointer place-items-center overflow-hidden rounded-full border text-xs
			{current && !isPreset ? 'ring-2 ring-maroon/60 ring-offset-1' : 'border-stone-300'}"
		style={current && !isPreset ? `background: ${current}` : 'background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red)'}
	>
		<input
			type="color"
			value={current && !isPreset ? current : '#73000a'}
			oninput={(e) => (current = e.currentTarget.value)}
			class="absolute inset-0 cursor-pointer opacity-0"
			aria-label="Pick a custom color"
		/>
	</label>
</div>
