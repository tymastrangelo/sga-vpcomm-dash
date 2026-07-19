<script lang="ts">
	import { enhance } from '$app/forms';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import { fmtDate } from '$lib/dates';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let adding = $state(false);
</script>

<svelte:head><title>Projects — SGA Comms</title></svelte:head>

<div class="mb-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold">Content Projects</h1>
	<button
		type="button"
		onclick={() => (adding = !adding)}
		class="rounded-md bg-maroon px-3 py-1.5 text-sm font-medium text-white hover:bg-maroon/90"
	>
		{adding ? 'Cancel' : '+ New Project'}
	</button>
</div>

{#if adding}
	<form
		method="POST"
		action="?/createProject"
		use:enhance={() => async ({ update }) => {
			await update();
			adding = false;
		}}
		class="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4"
	>
		<div class="min-w-48 flex-1">
			<label class="block text-sm font-medium text-stone-700" for="p-name">Name</label>
			<input
				id="p-name" name="name" required
				class="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-maroon focus:outline-none"
			/>
		</div>
		<div class="min-w-64 flex-[2]">
			<label class="block text-sm font-medium text-stone-700" for="p-desc">Description</label>
			<input
				id="p-desc" name="description"
				class="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-maroon focus:outline-none"
			/>
		</div>
		<div>
			<span class="block text-sm font-medium text-stone-700">Color</span>
			<ColorPicker name="color" value="#73000a" tags={data.tags} allowNone={false} />
		</div>
		<button type="submit" class="rounded-md bg-maroon px-4 py-1.5 text-sm font-medium text-white hover:bg-maroon/90">
			Create
		</button>
	</form>
{/if}

{#if data.projects.length}
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.projects as project (project.id)}
			<a
				href="/projects/{project.id}"
				class="rounded-lg border border-stone-200 bg-white p-4 hover:border-stone-300 hover:shadow-sm"
			>
				<div class="flex items-center gap-2">
					<span class="size-3 shrink-0 rounded-full" style="background: {project.color ?? '#73000a'}"></span>
					<h2 class="min-w-0 flex-1 truncate font-medium">{project.name}</h2>
				</div>
				{#if project.description}
					<p class="mt-2 line-clamp-2 text-sm text-stone-500">{project.description}</p>
				{/if}
				<p class="mt-3 text-xs text-stone-400">
					{project.item_count} item{project.item_count === 1 ? '' : 's'}
					{#if project.next_date}
						· next: {fmtDate(project.next_date)}
					{/if}
				</p>
			</a>
		{/each}
	</div>
{:else}
	<p class="text-sm text-stone-500">No projects yet. Create one for your first video series.</p>
{/if}
